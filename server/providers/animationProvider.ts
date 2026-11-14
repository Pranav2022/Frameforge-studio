import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { CACHE_DIR } from '../db/database.ts';
import { computeGenerationHash, getCachedFile, storeCachedFile } from '../engines/assetCache.ts';
import { MotionSpec } from '../types/manifest.ts';

const execFileAsync = promisify(execFile);

export interface AnimationRequest {
  imagePath: string;
  importedClipPath?: string;
  foregroundLayerPath?: string;
  durationSeconds: number;
  fps: number;
  width: number;
  height: number;
  motionSpec: MotionSpec;
  outputPath: string;
  method: 'deterministic' | 'generative_i2v' | 'generative_t2v' | 'hybrid';
  skipBlackFadeEdges?: boolean;
}

export interface AnimationResult {
  success: boolean;
  providerUsed: string;
  durationMs: number;
  outputFile: string;
  fromCache: boolean;
  usedFallback: boolean;
  errorMessage?: string;
}

export interface AnimationProvider {
  readonly id: string;
  animate(req: AnimationRequest): Promise<AnimationResult>;
}

/**
 * Generates and caches a translucent animated golden-ember / firefly PNG overlay strip
 * via ImageMagick so shots with `golden_embers` or `particles` display real drifting glowing particles.
 */
async function ensureEmberOverlay(width: number, height: number): Promise<string | null> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const target = path.join(CACHE_DIR, `vfx_embers_${width}x${height * 2}.png`);
  if (fs.existsSync(target) && fs.statSync(target).size > 512) return target;

  try {
    const drawOps: string[] = [];
    // Deterministic pseudo-random bokeh embers across a 2x tall tile so it scrolls seamlessly upward
    for (let i = 0; i < 65; i++) {
      const x = Math.round(((i * 197 + 43) % 1000) / 1000 * width);
      const y = Math.round(((i * 331 + 79) % 1000) / 1000 * (height * 2));
      const r = 2 + (i % 5);
      const color = i % 3 === 0 ? 'rgba(253,224,71,0.85)' : 'rgba(251,146,60,0.75)';
      drawOps.push('-fill', color, '-draw', `circle ${x},${y} ${x + r},${y}`);
    }
    await execFileAsync(
      'convert',
      ['-size', `${width}x${height * 2}`, 'xc:none', ...drawOps, '-blur', '0x1.4', target],
      { timeout: 10000 }
    );
    return target;
  } catch {
    return null;
  }
}

/**
 * Generates and caches a diagonal volumetric god-ray PNG overlay via ImageMagick.
 */
async function ensureGodRayOverlay(width: number, height: number): Promise<string | null> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const target = path.join(CACHE_DIR, `vfx_godrays_${width}x${height}.png`);
  if (fs.existsSync(target) && fs.statSync(target).size > 512) return target;

  try {
    const cx = Math.round(width * 0.5);
    const args = [
      '-size',
      `${width}x${height}`,
      'xc:none',
      '-fill',
      'rgba(254,243,199,0.22)',
      '-draw',
      `polygon ${cx - 40},0 ${cx + 40},0 ${width},${height} ${Math.round(width * 0.58)},${height}`,
      '-fill',
      'rgba(253,224,71,0.16)',
      '-draw',
      `polygon ${cx - 120},0 ${cx - 10},0 ${Math.round(width * 0.45)},${height} ${Math.round(width * 0.08)},${height}`,
      '-blur',
      '0x18',
      target,
    ];
    await execFileAsync('convert', args, { timeout: 10000 });
    return target;
  } catch {
    return null;
  }
}

/**
 * Deterministic FFmpeg Animation Provider v2 (Zero VRAM).
 * Supports:
 * - Imported AI video clip normalization + VFX compositing
 * - Zoom-in/out, horizontal/vertical pan/tilt, parallax, camera shake
 * - Floating golden embers/fireflies, volumetric god-rays, violet mystic aura,
 *   ground mist, lightning flashes, fire glow, rain, snow, vignette
 */
export class DeterministicFFmpegAnimationProvider implements AnimationProvider {
  readonly id = 'ffmpeg-deterministic-v2';

  async animate(req: AnimationRequest): Promise<AnimationResult> {
    const start = Date.now();
    fs.mkdirSync(path.dirname(req.outputPath), { recursive: true });

    const hasImportedClip = Boolean(req.importedClipPath && fs.existsSync(req.importedClipPath));
    if (!hasImportedClip && !fs.existsSync(req.imagePath)) {
      return {
        success: false,
        providerUsed: this.id,
        durationMs: Date.now() - start,
        outputFile: req.outputPath,
        fromCache: false,
        usedFallback: false,
        errorMessage: `Source image does not exist: ${req.imagePath}`,
      };
    }

    const sourceFile = hasImportedClip ? req.importedClipPath! : req.imagePath;
    const sourceDigest = crypto
      .createHash('sha256')
      .update(fs.readFileSync(sourceFile))
      .digest('hex')
      .slice(0, 16);

    const hash = computeGenerationHash({
      provider: this.id,
      sourceDigest,
      hasImportedClip,
      duration: req.durationSeconds,
      fps: req.fps,
      w: req.width,
      h: req.height,
      motionSpec: req.motionSpec,
      skipBlackFadeEdges: Boolean(req.skipBlackFadeEdges),
    });

    const cached = getCachedFile(hash, 'mp4');
    if (cached) {
      fs.copyFileSync(cached, req.outputPath);
      return {
        success: true,
        providerUsed: hasImportedClip ? 'imported-clip+vfx' : this.id,
        durationMs: Date.now() - start,
        outputFile: req.outputPath,
        fromCache: true,
        usedFallback: false,
      };
    }

    try {
      const fx = new Set(req.motionSpec.effects || []);
      const weather = req.motionSpec.weather;
      const totalFrames = Math.max(12, Math.round(req.durationSeconds * req.fps));
      const speedMul =
        req.motionSpec.cameraSpeed === 'fast' ? 2.0 : req.motionSpec.cameraSpeed === 'medium' ? 1.45 : 0.85;

      const preW = Math.round(req.width * 1.32);
      const preH = Math.round(req.height * 1.32);

      let baseMotionFilter = '';
      if (hasImportedClip) {
        baseMotionFilter = `scale=${req.width}:${req.height}:force_original_aspect_ratio=increase,crop=${req.width}:${req.height},fps=${req.fps},setpts=PTS-STARTPTS`;
      } else {
        const cam = req.motionSpec.camera;
        if (cam === 'zoom_in') {
          const step = (0.0016 * speedMul).toFixed(5);
          baseMotionFilter = `scale=${preW}:${preH}:force_original_aspect_ratio=increase,crop=${preW}:${preH},zoompan=z='min(zoom+${step},1.34)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${req.width}x${req.height}:fps=${req.fps}`;
        } else if (cam === 'zoom_out') {
          const step = (0.0016 * speedMul).toFixed(5);
          baseMotionFilter = `scale=${preW}:${preH}:force_original_aspect_ratio=increase,crop=${preW}:${preH},zoompan=z='if(lte(on,1),1.28,max(1.0,zoom-${step}))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${req.width}x${req.height}:fps=${req.fps}`;
        } else if (cam === 'pan_left') {
          baseMotionFilter = `scale=${preW}:${preH}:force_original_aspect_ratio=increase,crop=${preW}:${preH},zoompan=z='1.18':x='max(0,(iw-iw/zoom)*(1-on/${totalFrames}))':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${req.width}x${req.height}:fps=${req.fps}`;
        } else if (cam === 'pan_right') {
          baseMotionFilter = `scale=${preW}:${preH}:force_original_aspect_ratio=increase,crop=${preW}:${preH},zoompan=z='1.18':x='min(iw-iw/zoom,(iw-iw/zoom)*(on/${totalFrames}))':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${req.width}x${req.height}:fps=${req.fps}`;
        } else if (cam === 'tilt_up') {
          baseMotionFilter = `scale=${preW}:${preH}:force_original_aspect_ratio=increase,crop=${preW}:${preH},zoompan=z='1.18':x='iw/2-(iw/zoom/2)':y='max(0,(ih-ih/zoom)*(1-on/${totalFrames}))':d=${totalFrames}:s=${req.width}x${req.height}:fps=${req.fps}`;
        } else if (cam === 'tilt_down') {
          baseMotionFilter = `scale=${preW}:${preH}:force_original_aspect_ratio=increase,crop=${preW}:${preH},zoompan=z='1.18':x='iw/2-(iw/zoom/2)':y='min(ih-ih/zoom,(ih-ih/zoom)*(on/${totalFrames}))':d=${totalFrames}:s=${req.width}x${req.height}:fps=${req.fps}`;
        } else if (cam === 'parallax') {
          const shift = (0.0014 * speedMul).toFixed(5);
          baseMotionFilter = `scale=${preW}:${preH}:force_original_aspect_ratio=increase,crop=${preW}:${preH},zoompan=z='min(1.25,1.06+${shift}*on)':x='(iw-iw/zoom)*0.5+sin(on/16)*18':y='(ih-ih/zoom)*0.5':d=${totalFrames}:s=${req.width}x${req.height}:fps=${req.fps}`;
        } else {
          baseMotionFilter = `scale=${req.width}:${req.height}:force_original_aspect_ratio=increase,crop=${req.width}:${req.height},fps=${req.fps}`;
        }
      }

      const postFilters: string[] = [baseMotionFilter];

      if (req.motionSpec.cameraShake || req.motionSpec.camera === 'shake') {
        postFilters.push(
          `crop=w=${req.width - 16}:h=${req.height - 16}:x='8+6*sin(n*1.9)':y='8+5*cos(n*2.3)',scale=${req.width}:${req.height}`
        );
      }

      // Color grading & atmospheric overlays
      if (weather === 'fog' || fx.has('smoke') || fx.has('ground_mist')) {
        postFilters.push(`eq=contrast=0.95:brightness=0.04:saturation=0.88`);
      }
      if (fx.has('glow') || fx.has('light_rays') || fx.has('god_rays')) {
        postFilters.push(`eq=contrast=1.06:brightness=0.04:saturation=1.12`);
      }
      if (fx.has('fire')) {
        postFilters.push(`colorbalance=rs=0.10:gs=0.03:bs=-0.07`);
      }
      if (fx.has('violet_aura')) {
        postFilters.push(`colorbalance=rs=0.07:gs=-0.05:bs=0.11`);
      }
      if (weather === 'rain' || weather === 'storm') {
        postFilters.push(`eq=brightness=-0.05:contrast=1.08:saturation=0.85,noise=alls=12:allf=t`);
      }
      if (weather === 'snow') {
        postFilters.push(`eq=brightness=0.05:saturation=0.82,noise=alls=8:allf=t`);
      }
      if (fx.has('lightning') || weather === 'storm') {
        const t1 = (req.durationSeconds * 0.35).toFixed(2);
        const t2 = (req.durationSeconds * 0.72).toFixed(2);
        postFilters.push(
          `eq=brightness='if(between(t,${t1},${Number(t1) + 0.14})+between(t,${t2},${Number(t2) + 0.12}),0.44,0)'`
        );
      }
      if (req.motionSpec.motionBlur) {
        postFilters.push(`tblend=all_mode=average`);
      }

      // Subtle cinematic vignette on every shot
      postFilters.push('vignette=PI/5');

      const useEmbers = fx.has('golden_embers') || fx.has('particles');
      const useGodRays = fx.has('god_rays') || fx.has('light_rays');

      const emberImg = useEmbers ? await ensureEmberOverlay(req.width, req.height) : null;
      const godRayImg = useGodRays ? await ensureGodRayOverlay(req.width, req.height) : null;

      if (!req.skipBlackFadeEdges) {
        const fadeDur = Math.min(0.45, req.durationSeconds * 0.15);
        if (req.motionSpec.transitionIn !== 'cut') {
          postFilters.push(`fade=t=in:st=0:d=${fadeDur.toFixed(2)}`);
        }
        if (req.motionSpec.transitionOut !== 'cut') {
          const outStart = Math.max(0, req.durationSeconds - fadeDur).toFixed(2);
          postFilters.push(`fade=t=out:st=${outStart}:d=${fadeDur.toFixed(2)}`);
        }
      }

      const inputs: string[] = [];
      if (hasImportedClip) {
        inputs.push('-stream_loop', '-1', '-i', sourceFile);
      } else {
        inputs.push('-loop', '1', '-t', String(req.durationSeconds), '-i', sourceFile);
      }

      let nextInputIdx = 1;
      let chainLabel = '[base]';
      const filterParts: string[] = [`[0:v]${postFilters.join(',')}[base]`];

      if (godRayImg) {
        inputs.push('-loop', '1', '-t', String(req.durationSeconds), '-i', godRayImg);
        filterParts.push(
          `${chainLabel}[${nextInputIdx}:v]overlay=x='sin(t*0.8)*18':y=0:shortest=1[v_rays]`
        );
        chainLabel = '[v_rays]';
        nextInputIdx++;
      }

      if (emberImg) {
        inputs.push('-loop', '1', '-t', String(req.durationSeconds), '-i', emberImg);
        filterParts.push(
          `${chainLabel}[${nextInputIdx}:v]overlay=x='sin(t*1.3)*14':y='-mod(t*65,${req.height})':shortest=1[v_embers]`
        );
        chainLabel = '[v_embers]';
        nextInputIdx++;
      }

      filterParts.push(`${chainLabel}format=yuv420p[vout]`);

      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          ...inputs,
          '-filter_complex',
          filterParts.join(';'),
          '-map',
          '[vout]',
          '-t',
          String(req.durationSeconds),
          '-r',
          String(req.fps),
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-crf',
          '22',
          '-an',
          req.outputPath,
        ],
        { timeout: 60000 }
      );

      storeCachedFile(hash, 'mp4', req.outputPath);

      return {
        success: true,
        providerUsed: hasImportedClip ? 'imported-clip+vfx' : this.id,
        durationMs: Date.now() - start,
        outputFile: req.outputPath,
        fromCache: false,
        usedFallback: false,
      };
    } catch (err) {
      return {
        success: false,
        providerUsed: this.id,
        durationMs: Date.now() - start,
        outputFile: req.outputPath,
        fromCache: false,
        usedFallback: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

export async function animateShot(req: AnimationRequest): Promise<AnimationResult> {
  const det = new DeterministicFFmpegAnimationProvider();
  if (req.method === 'deterministic' || req.importedClipPath) {
    return det.animate(req);
  }

  const comfyUrl = process.env.COMFYUI_API_URL || 'http://127.0.0.1:8188';
  let comfyUp = false;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(`${comfyUrl}/system_stats`, { signal: controller.signal });
    clearTimeout(t);
    comfyUp = res.ok;
  } catch {
    comfyUp = false;
  }

  if (!comfyUp) {
    const fallbackRes = await det.animate(req);
    return {
      ...fallbackRes,
      usedFallback: true,
      providerUsed: `${det.id} (fallback: generative server offline)`,
    };
  }

  if (req.durationSeconds > 4 && process.env.LOW_VRAM_MODE !== 'false') {
    const fallbackRes = await det.animate(req);
    return {
      ...fallbackRes,
      usedFallback: true,
      providerUsed: `${det.id} (low-VRAM guard >4s)`,
    };
  }

  return det.animate(req);
}
