import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { computeGenerationHash, getCachedFile, storeCachedFile } from '../engines/assetCache.ts';

const execFileAsync = promisify(execFile);

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt: string;
  referenceImages: string[];
  width: number;
  height: number;
  seed: number;
  outputPath: string;
  label?: string;
  palette?: string[];
  settings?: Record<string, unknown>;
}

export interface ImageGenerationResult {
  success: boolean;
  modelUsed: string;
  durationMs: number;
  outputFile: string;
  fromCache: boolean;
  errorMessage?: string;
}

export interface ImageProvider {
  readonly id: string;
  isAvailable(): Promise<boolean>;
  generate(req: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

/**
 * Optional local ComfyUI HTTP provider (works when user runs ComfyUI locally on port 8188).
 */
export class ComfyUIImageProvider implements ImageProvider {
  readonly id = 'comfyui';
  private baseUrl: string;

  constructor(baseUrl = process.env.COMFYUI_API_URL || 'http://127.0.0.1:8188') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${this.baseUrl}/system_stats`, { signal: controller.signal });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  }

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const start = Date.now();
    const available = await this.isAvailable();
    if (!available) {
      return {
        success: false,
        modelUsed: 'comfyui-unavailable',
        durationMs: Date.now() - start,
        outputFile: req.outputPath,
        fromCache: false,
        errorMessage: `ComfyUI server not reachable at ${this.baseUrl}. Falling back to procedural/imported asset pipeline.`,
      };
    }

    // Standard SD 1.5 low-VRAM workflow payload compatible with ComfyUI /prompt API
    const workflow = {
      '3': {
        class_type: 'KSampler',
        inputs: {
          seed: req.seed,
          steps: 20,
          cfg: 7.0,
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise: 1,
          model: ['4', 0],
          positive: ['6', 0],
          negative: ['7', 0],
          latent_image: ['5', 0],
        },
      },
      '4': {
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'v1-5-pruned-emaonly.safetensors' },
      },
      '5': {
        class_type: 'EmptyLatentImage',
        inputs: { width: Math.min(768, req.width), height: Math.min(768, req.height), batch_size: 1 },
      },
      '6': {
        class_type: 'CLIPTextEncode',
        inputs: { text: req.prompt, clip: ['4', 1] },
      },
      '7': {
        class_type: 'CLIPTextEncode',
        inputs: { text: req.negativePrompt, clip: ['4', 1] },
      },
      '8': {
        class_type: 'VAEDecode',
        inputs: { samples: ['3', 0], vae: ['4', 2] },
      },
      '9': {
        class_type: 'SaveImage',
        inputs: { filename_prefix: 'frameforge', images: ['8', 0] },
      },
    };

    try {
      const submitRes = await fetch(`${this.baseUrl}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow }),
      });
      if (!submitRes.ok) {
        throw new Error(`ComfyUI rejected prompt (${submitRes.status})`);
      }
      const { prompt_id } = (await submitRes.json()) as { prompt_id: string };

      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const histRes = await fetch(`${this.baseUrl}/history/${prompt_id}`);
        if (!histRes.ok) continue;
        const hist = (await histRes.json()) as Record<string, { outputs?: Record<string, { images?: Array<{ filename: string; subfolder: string; type: string }> }> }>;
        const item = hist[prompt_id];
        const img = item?.outputs?.['9']?.images?.[0];
        if (img) {
          const viewUrl = `${this.baseUrl}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${encodeURIComponent(img.type)}`;
          const imgBuf = Buffer.from(await (await fetch(viewUrl)).arrayBuffer());
          fs.mkdirSync(path.dirname(req.outputPath), { recursive: true });
          fs.writeFileSync(req.outputPath, imgBuf);
          return {
            success: true,
            modelUsed: 'comfyui-sd15',
            durationMs: Date.now() - start,
            outputFile: req.outputPath,
            fromCache: false,
          };
        }
      }
      throw new Error('ComfyUI generation timed out.');
    } catch (err) {
      return {
        success: false,
        modelUsed: 'comfyui-sd15',
        durationMs: Date.now() - start,
        outputFile: req.outputPath,
        fromCache: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

/**
 * Deterministic Zero-VRAM Procedural Scene & Storyboard Compositor.
 * Composites user-uploaded reference images onto richly layered atmospheric backdrops
 * using ImageMagick `convert` + FFmpeg, ensuring 100% offline ₹0 reliability.
 */
export class ProceduralPlateImageProvider implements ImageProvider {
  readonly id = 'procedural';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const start = Date.now();
    fs.mkdirSync(path.dirname(req.outputPath), { recursive: true });

    const validRef = req.referenceImages.find((p) => p && fs.existsSync(p));
    const hash = computeGenerationHash({
      provider: this.id,
      prompt: req.prompt,
      ref: validRef ? path.basename(validRef) : 'none',
      w: req.width,
      h: req.height,
      seed: req.seed,
      palette: req.palette || [],
    });

    const cached = getCachedFile(hash, 'png');
    if (cached) {
      fs.copyFileSync(cached, req.outputPath);
      return {
        success: true,
        modelUsed: 'procedural-compositor-v1',
        durationMs: Date.now() - start,
        outputFile: req.outputPath,
        fromCache: true,
      };
    }

    try {
      const palette = derivePalette(req.seed, req.palette);
      const args: string[] = [
        '-size',
        `${req.width}x${req.height}`,
        `gradient:${palette.top}-${palette.bottom}`,
        // Radial atmospheric glow
        '(',
        '-size',
        `${req.width}x${req.height}`,
        `radial-gradient:${palette.accent}-none`,
        ')',
        '-compose',
        'screen',
        '-composite',
      ];

      // Subtle horizon / mountain silhouette geometry for depth
      const horizonY = Math.round(req.height * 0.64);
      const ridgePath = `M 0,${req.height} L 0,${horizonY + 30} L ${Math.round(req.width * 0.18)},${horizonY - 40} L ${Math.round(req.width * 0.36)},${horizonY + 15} L ${Math.round(req.width * 0.54)},${horizonY - 65} L ${Math.round(req.width * 0.76)},${horizonY + 10} L ${req.width},${horizonY - 25} L ${req.width},${req.height} Z`;
      args.push(
        '-fill',
        palette.silhouette,
        '-draw',
        `path '${ridgePath}'`
      );

      // Composite primary reference image if available
      if (validRef) {
        const refSizeW = Math.round(req.width * 0.44);
        const refSizeH = Math.round(req.height * 0.76);
        args.push(
          '(',
          validRef,
          '-resize',
          `${refSizeW}x${refSizeH}`,
          ')',
          '-gravity',
          'center',
          '-compose',
          'over',
          '-composite'
        );
      }

      // Soft cinematic vignette + subtle bottom caption band for storyboard readability if no ref
      if (!validRef && req.label) {
        args.push(
          '-gravity',
          'south',
          '-fill',
          'rgba(10,14,23,0.58)',
          '-draw',
          `rectangle 0,${req.height - 96} ${req.width},${req.height}`,
          '-fill',
          '#F8FAFC',
          '-pointsize',
          String(Math.max(18, Math.round(req.height * 0.03))),
          '-annotate',
          '+0+34',
          req.label.slice(0, 72)
        );
      }

      args.push(req.outputPath);
      await execFileAsync('convert', args, { timeout: 15000 });
      storeCachedFile(hash, 'png', req.outputPath);

      return {
        success: true,
        modelUsed: 'procedural-compositor-v1',
        durationMs: Date.now() - start,
        outputFile: req.outputPath,
        fromCache: false,
      };
    } catch (err) {
      // Pure FFmpeg fallback if ImageMagick fails
      try {
        await execFileAsync('ffmpeg', [
          '-y',
          '-f',
          'lavfi',
          '-i',
          `color=c=0x1e293b:s=${req.width}x${req.height}:d=1`,
          '-frames:v',
          '1',
          req.outputPath,
        ]);
        return {
          success: true,
          modelUsed: 'ffmpeg-plate-fallback',
          durationMs: Date.now() - start,
          outputFile: req.outputPath,
          fromCache: false,
        };
      } catch (e2) {
        return {
          success: false,
          modelUsed: 'procedural-compositor-v1',
          durationMs: Date.now() - start,
          outputFile: req.outputPath,
          fromCache: false,
          errorMessage: err instanceof Error ? err.message : String(e2),
        };
      }
    }
  }
}

function derivePalette(seed: number, custom?: string[]) {
  if (custom && custom.length >= 2) {
    return {
      top: custom[0],
      bottom: custom[1],
      accent: custom[2] || '#d97706',
      silhouette: '#090d16',
    };
  }
  const palettes = [
    { top: '#0f172a', bottom: '#334155', accent: '#c2410c', silhouette: '#070b14' },
    { top: '#1e1b4b', bottom: '#4c1d95', accent: '#f59e0b', silhouette: '#0d091f' },
    { top: '#14261c', bottom: '#2d4a3e', accent: '#eab308', silhouette: '#08120c' },
    { top: '#2b1313', bottom: '#6b211a', accent: '#fb923c', silhouette: '#140707' },
    { top: '#0c1e2e', bottom: '#1e425e', accent: '#38bdf8', silhouette: '#060f18' },
  ];
  return palettes[Math.abs(seed) % palettes.length];
}

export async function generateImageWithFallback(
  preferredProvider: string,
  req: ImageGenerationRequest
): Promise<ImageGenerationResult> {
  if (preferredProvider === 'comfyui') {
    const comfy = new ComfyUIImageProvider();
    const res = await comfy.generate(req);
    if (res.success) return res;
  }
  const procedural = new ProceduralPlateImageProvider();
  return procedural.generate(req);
}
