import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type AdmZipType from 'adm-zip';
import { getProjectDir } from '../db/database.ts';
import { AspectRatio, ProjectManifest, Resolution } from '../types/manifest.ts';

const require = createRequire(import.meta.url);
const AdmZip = require('adm-zip') as typeof AdmZipType;

const execFileAsync = promisify(execFile);

export function getTargetDimensions(
  resolution: Resolution,
  aspectRatio: AspectRatio
): { width: number; height: number } {
  if (aspectRatio === '9:16') {
    return resolution === '1080p' ? { width: 1080, height: 1920 } : { width: 720, height: 1280 };
  }
  if (aspectRatio === '1:1') {
    return resolution === '1080p' ? { width: 1080, height: 1080 } : { width: 720, height: 720 };
  }
  return resolution === '1080p' ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
}

function mapXfadeTransition(t: string): string | null {
  switch (t) {
    case 'cut':
      return null;
    case 'flash_white':
      return 'fadewhite';
    case 'flash_violet':
      return 'radial';
    case 'diagonal_slice':
      return 'diagtl';
    case 'wipe_left':
      return 'wipeleft';
    case 'slide_up':
      return 'slideup';
    case 'circle_open':
      return 'circleopen';
    case 'fade':
      return 'fade';
    case 'dissolve':
    default:
      return 'dissolve';
  }
}

async function stitchClipsWithXfade(
  clips: Array<{ file: string; duration: number; transitionOut: string }>,
  outputPath: string,
  fps: number
): Promise<void> {
  if (clips.length === 1) {
    fs.copyFileSync(clips[0].file, outputPath);
    return;
  }

  // If every transition is hard cut, stream-copy concat is instant
  const hasAnyXfade = clips.slice(0, -1).some((c) => mapXfadeTransition(c.transitionOut) !== null);
  if (!hasAnyXfade) {
    const listFile = `${outputPath}.concat.txt`;
    fs.writeFileSync(
      listFile,
      clips.map((c) => `file '${c.file.replace(/'/g, "'\\''")}'`).join('\n'),
      'utf8'
    );
    await execFileAsync('ffmpeg', [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listFile,
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      outputPath,
    ]);
    if (fs.existsSync(listFile)) fs.unlinkSync(listFile);
    return;
  }

  const inputs: string[] = [];
  const filterParts: string[] = [];
  const transDur = 0.32;

  for (let i = 0; i < clips.length; i++) {
    inputs.push('-i', clips[i].file);
    const hasOutTrans = i < clips.length - 1;
    // Clone last frame during transition overlap so cumulative timeline stays 100% locked to script timestamps
    const padTail = hasOutTrans ? `,tpad=stop_mode=clone:stop_duration=${transDur}` : '';
    filterParts.push(`[${i}:v]fps=${fps},setpts=PTS-STARTPTS${padTail}[v${i}]`);
  }

  let currentLabel = '[v0]';
  let cumulativeOffset = clips[0].duration;

  for (let i = 0; i < clips.length - 1; i++) {
    const xfadeName = mapXfadeTransition(clips[i].transitionOut) || 'fade';
    const nextLabel = i === clips.length - 2 ? '[vout]' : `[xf${i}]`;
    const offset = Math.max(0.1, cumulativeOffset).toFixed(3);
    filterParts.push(
      `${currentLabel}[v${i + 1}]xfade=transition=${xfadeName}:duration=${transDur}:offset=${offset}${nextLabel}`
    );
    currentLabel = nextLabel;
    cumulativeOffset += clips[i + 1].duration;
  }

  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      ...inputs,
      '-filter_complex',
      filterParts.join(';'),
      '-map',
      '[vout]',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '22',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      outputPath,
    ],
    { timeout: 120000 }
  );
}

/**
 * Concatenates/transitions individual shot clips into scene MP4s, then assembles the complete
 * episode with mixed audio, optional channel watermark, soft/burned subtitles, and vertical/square reframes.
 */
export async function assembleProjectVideo(manifest: ProjectManifest): Promise<{
  manifest: ProjectManifest;
  landscapeMp4: string;
  verticalMp4?: string;
  squareMp4?: string;
}> {
  const projectDir = getProjectDir(manifest.projectId);
  const scenesDir = path.join(projectDir, 'scenes');
  const exportsDir = path.join(projectDir, 'exports');
  fs.mkdirSync(scenesDir, { recursive: true });
  fs.mkdirSync(exportsDir, { recursive: true });

  const sceneEntries: Array<{ file: string; duration: number; transitionOut: string }> = [];
  const updatedScenes = [];

  // 1. Render each scene by stitching its shots with xfade transitions
  for (const scene of manifest.scenes) {
    const validShots = scene.shots.filter((s) => s.outputFile && fs.existsSync(s.outputFile));
    if (validShots.length === 0) {
      throw new Error(`Scene "${scene.title}" has no rendered shot clips.`);
    }

    const sceneOut = path.join(scenesDir, `${scene.id}.mp4`);
    await stitchClipsWithXfade(
      validShots.map((s) => ({
        file: s.outputFile!,
        duration: s.duration,
        transitionOut: s.motionSpec?.transitionOut || 'dissolve',
      })),
      sceneOut,
      manifest.outputSettings.fps
    );

    const lastShotTrans = validShots[validShots.length - 1]?.motionSpec?.transitionOut || 'dissolve';
    sceneEntries.push({
      file: sceneOut,
      duration: scene.duration,
      transitionOut: lastShotTrans,
    });
    updatedScenes.push({
      ...scene,
      outputFile: sceneOut,
      status: 'completed' as const,
    });
  }

  // 2. Stitch all scene MP4s into silent master video preserving scene-boundary transitions
  const silentMaster = path.join(exportsDir, 'episode_silent.mp4');
  await stitchClipsWithXfade(sceneEntries, silentMaster, manifest.outputSettings.fps);

  // 3. Mux mixed master audio + channel watermark + subtitles into primary MP4
  const landscapeMp4 = path.join(
    exportsDir,
    `${manifest.projectId}_final_${manifest.outputSettings.aspectRatio.replace(':', 'x')}.mp4`
  );

  const mixedAudio =
    manifest.audioConfig.mixedAudioPath && fs.existsSync(manifest.audioConfig.mixedAudioPath)
      ? manifest.audioConfig.mixedAudioPath
      : null;

  const srtPath =
    manifest.exports.srtPath && fs.existsSync(manifest.exports.srtPath)
      ? manifest.exports.srtPath
      : null;
  const assPath =
    manifest.exports.assPath && fs.existsSync(manifest.exports.assPath)
      ? manifest.exports.assPath
      : null;

  const branding = manifest.brandingConfig;
  const hasImageWatermark = Boolean(
    branding?.watermarkImagePath && fs.existsSync(branding.watermarkImagePath)
  );
  const watermarkText = (branding?.watermarkText || '').trim();
  const hasTextWatermark = !hasImageWatermark && watermarkText.length > 0;
  const shouldBurnSubs = Boolean(manifest.outputSettings.burnSubtitles && (assPath || srtPath));

  const targetDim = getTargetDimensions(
    manifest.outputSettings.resolution,
    manifest.outputSettings.aspectRatio
  );

  const ffmpegArgs: string[] = ['-y', '-i', silentMaster];
  let nextInput = 1;
  let audioInputIdx: number | null = null;
  let subInputIdx: number | null = null;
  let logoInputIdx: number | null = null;

  if (mixedAudio) {
    ffmpegArgs.push('-i', mixedAudio);
    audioInputIdx = nextInput++;
  }
  if (srtPath && !manifest.outputSettings.burnSubtitles) {
    ffmpegArgs.push('-i', srtPath);
    subInputIdx = nextInput++;
  }
  if (hasImageWatermark && branding.watermarkImagePath) {
    ffmpegArgs.push('-i', branding.watermarkImagePath);
    logoInputIdx = nextInput++;
  }

  const videoNeedsReencode = shouldBurnSubs || hasImageWatermark || hasTextWatermark;

  if (videoNeedsReencode) {
    const filterSteps: string[] = [];
    let currentV = '[0:v]';

    if (shouldBurnSubs) {
      if (assPath) {
        const escapedAss = assPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
        filterSteps.push(`${currentV}ass='${escapedAss}'[vsub]`);
      } else if (srtPath) {
        const escapedSrt = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
        filterSteps.push(`${currentV}subtitles='${escapedSrt}'[vsub]`);
      }
      currentV = '[vsub]';
    }

    if (hasImageWatermark && logoInputIdx !== null) {
      const wmWidth = Math.max(72, Math.round(targetDim.width * 0.16));
      const opacity = branding.opacity ?? 0.82;
      const posCoords =
        branding.position === 'top_left'
          ? 'x=24:y=24'
          : branding.position === 'top_right'
          ? 'x=W-w-24:y=24'
          : branding.position === 'bottom_left'
          ? 'x=24:y=H-h-32'
          : 'x=W-w-24:y=H-h-32';
      filterSteps.push(
        `[${logoInputIdx}:v]scale=${wmWidth}:-1,format=rgba,colorchannelmixer=aa=${opacity.toFixed(2)}[wm_logo]`
      );
      filterSteps.push(`${currentV}[wm_logo]overlay=${posCoords}[vout]`);
      currentV = '[vout]';
    } else if (hasTextWatermark) {
      const safeText = watermarkText
        .replace(/\\/g, '\\\\')
        .replace(/:/g, '\\:')
        .replace(/'/g, "\\'");
      const color = (branding.color || '#F59E0B').replace('#', '0x');
      const opacity = (branding.opacity ?? 0.82).toFixed(2);
      const fontSize = Math.max(16, Math.round(targetDim.width * 0.026));
      const posExpr =
        branding.position === 'top_left'
          ? 'x=24:y=24'
          : branding.position === 'top_right'
          ? 'x=w-tw-24:y=24'
          : branding.position === 'bottom_left'
          ? 'x=24:y=h-th-28'
          : 'x=w-tw-24:y=h-th-28';
      filterSteps.push(
        `${currentV}drawtext=text='${safeText}':fontcolor=${color}@${opacity}:fontsize=${fontSize}:shadowcolor=black@0.75:shadowx=2:shadowy=2:${posExpr}[vout]`
      );
      currentV = '[vout]';
    }

    ffmpegArgs.push(
      '-filter_complex',
      filterSteps.join(';'),
      '-map',
      currentV,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '22',
      '-pix_fmt',
      'yuv420p'
    );
  } else {
    ffmpegArgs.push('-map', '0:v:0', '-c:v', 'copy');
  }

  if (audioInputIdx !== null) {
    ffmpegArgs.push('-map', `${audioInputIdx}:a:0`, '-c:a', 'aac', '-b:a', '192k', '-shortest');
    if (subInputIdx !== null) {
      ffmpegArgs.push('-map', `${subInputIdx}:s:0`, '-c:s', 'mov_text');
    }
  } else if (subInputIdx !== null) {
    ffmpegArgs.push('-map', `${subInputIdx}:s:0`, '-c:s', 'mov_text');
  }

  ffmpegArgs.push('-movflags', '+faststart', landscapeMp4);
  await execFileAsync('ffmpeg', ffmpegArgs, { timeout: 120000 });

  // 4. Optional vertical 9:16 reframe export
  let verticalMp4: string | undefined;
  if (manifest.outputSettings.exportVerticalAlso && manifest.outputSettings.aspectRatio !== '9:16') {
    const vDim = getTargetDimensions(manifest.outputSettings.resolution, '9:16');
    verticalMp4 = path.join(exportsDir, `${manifest.projectId}_final_9x16.mp4`);
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-i',
        landscapeMp4,
        '-vf',
        `scale=${vDim.width}:${vDim.height}:force_original_aspect_ratio=increase,crop=${vDim.width}:${vDim.height},format=yuv420p`,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-c:a',
        'copy',
        '-movflags',
        '+faststart',
        verticalMp4,
      ],
      { timeout: 120000 }
    );
  } else if (manifest.outputSettings.aspectRatio === '9:16') {
    verticalMp4 = landscapeMp4;
  }

  // 5. Optional square 1:1 reframe export
  let squareMp4: string | undefined;
  if (manifest.outputSettings.exportSquareAlso && manifest.outputSettings.aspectRatio !== '1:1') {
    const sDim = getTargetDimensions(manifest.outputSettings.resolution, '1:1');
    squareMp4 = path.join(exportsDir, `${manifest.projectId}_final_1x1.mp4`);
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-i',
        landscapeMp4,
        '-vf',
        `scale=${sDim.width}:${sDim.height}:force_original_aspect_ratio=increase,crop=${sDim.width}:${sDim.height},format=yuv420p`,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-c:a',
        'copy',
        '-movflags',
        '+faststart',
        squareMp4,
      ],
      { timeout: 120000 }
    );
  } else if (manifest.outputSettings.aspectRatio === '1:1') {
    squareMp4 = landscapeMp4;
  }

  if (fs.existsSync(silentMaster)) fs.unlinkSync(silentMaster);

  const nextManifest: ProjectManifest = {
    ...manifest,
    stage: 'assembled',
    scenes: updatedScenes,
    exports: {
      ...manifest.exports,
      landscapeMp4,
      verticalMp4,
      squareMp4,
    },
  };

  return {
    manifest: nextManifest,
    landscapeMp4,
    verticalMp4,
    squareMp4,
  };
}

export async function createProjectArchiveZip(projectId: string): Promise<string> {
  const projectDir = getProjectDir(projectId);
  const exportsDir = path.join(projectDir, 'exports');
  fs.mkdirSync(exportsDir, { recursive: true });
  const zipPath = path.join(exportsDir, `${projectId}_archive.zip`);

  const zip = new AdmZip();
  for (const entry of fs.readdirSync(projectDir, { withFileTypes: true })) {
    const full = path.join(projectDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'exports') {
        for (const sub of fs.readdirSync(full)) {
          if (!sub.endsWith('.zip')) {
            const subPath = path.join(full, sub);
            if (fs.statSync(subPath).isFile()) zip.addLocalFile(subPath, 'exports');
          }
        }
      } else {
        zip.addLocalFolder(full, entry.name);
      }
    } else if (entry.isFile()) {
      zip.addLocalFile(full);
    }
  }
  zip.writeZip(zipPath);
  return zipPath;
}
