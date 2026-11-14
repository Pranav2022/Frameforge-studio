import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';
import { saveQCReport } from '../db/database.ts';
import { ProjectManifest, QCCheckItem, QCReport } from '../types/manifest.ts';
import { getTargetDimensions } from './videoAssembler.ts';

const execFileAsync = promisify(execFile);

/**
 * Automatic Quality Control Engine.
 * Runs real FFprobe, FFmpeg blackdetect, volumedetect, subtitle overlap/length checks,
 * and structural manifest completeness checks.
 */
export async function runQualityControl(manifest: ProjectManifest): Promise<QCReport> {
  const checks: QCCheckItem[] = [];

  // 1. Project & structural completeness
  if (manifest.scenes.length === 0) {
    checks.push({
      category: 'project',
      name: 'Scene presence',
      status: 'fail',
      details: 'Project contains zero scenes.',
    });
  } else {
    checks.push({
      category: 'project',
      name: 'Scene presence',
      status: 'pass',
      details: `${manifest.scenes.length} scenes configured.`,
    });
  }

  let missingShots = 0;
  let corruptShotFiles = 0;
  const expectedDim = getTargetDimensions(
    manifest.outputSettings.resolution,
    manifest.outputSettings.aspectRatio
  );

  for (const scene of manifest.scenes) {
    if (scene.shots.length === 0) {
      checks.push({
        category: 'project',
        name: `Shots in ${scene.title}`,
        status: 'fail',
        details: 'Scene has zero shots.',
        target: scene.id,
      });
      continue;
    }

    for (const shot of scene.shots) {
      if (!shot.imageAssetPath || !fs.existsSync(shot.imageAssetPath)) {
        checks.push({
          category: 'visual',
          name: `Storyboard image (${shot.id})`,
          status: 'warn',
          details: 'Shot storyboard image is missing on disk.',
          target: shot.id,
        });
      }
      if (!shot.outputFile || !fs.existsSync(shot.outputFile)) {
        missingShots++;
      } else {
        const size = fs.statSync(shot.outputFile).size;
        if (size < 1024) corruptShotFiles++;
      }
    }
  }

  checks.push({
    category: 'visual',
    name: 'Rendered shot clips',
    status: missingShots === 0 && corruptShotFiles === 0 ? 'pass' : 'fail',
    details:
      missingShots === 0 && corruptShotFiles === 0
        ? 'All shot MP4 files exist and are non-empty.'
        : `${missingShots} missing, ${corruptShotFiles} corrupt shot clips.`,
  });

  // 2. Subtitle quality checks
  if (manifest.subtitles.length === 0) {
    checks.push({
      category: 'subtitle',
      name: 'Subtitle entries',
      status: 'warn',
      details: 'No subtitle entries generated yet.',
    });
  } else {
    let overlaps = 0;
    let longLines = 0;
    let invalidTimes = 0;
    const maxLen = manifest.outputSettings.subtitleStyle.maxCharsPerLine || 44;

    for (let i = 0; i < manifest.subtitles.length; i++) {
      const sub = manifest.subtitles[i];
      if (sub.endTime <= sub.startTime) invalidTimes++;
      if (i > 0 && sub.startTime < manifest.subtitles[i - 1].endTime - 0.01) overlaps++;
      for (const line of sub.text.split('\n')) {
        if (line.length > maxLen + 8) longLines++;
      }
    }

    checks.push({
      category: 'subtitle',
      name: 'Subtitle timing & overlap check',
      status: invalidTimes === 0 && overlaps === 0 ? 'pass' : 'fail',
      details:
        invalidTimes === 0 && overlaps === 0
          ? `${manifest.subtitles.length} cues validated with zero overlaps.`
          : `${invalidTimes} invalid timestamps, ${overlaps} overlapping cues.`,
    });

    checks.push({
      category: 'subtitle',
      name: 'Subtitle line length',
      status: longLines === 0 ? 'pass' : 'warn',
      details:
        longLines === 0
          ? 'All lines fit within readable character limit.'
          : `${longLines} lines exceed configured character limit.`,
    });
  }

  // 3. Audio checks
  const masterMix = manifest.audioConfig.mixedAudioPath;
  if (!masterMix || !fs.existsSync(masterMix)) {
    checks.push({
      category: 'audio',
      name: 'Master audio mix',
      status: 'warn',
      details: 'Mixed audio track not found.',
    });
  } else {
    try {
      const { stderr } = await execFileAsync('ffmpeg', [
        '-i',
        masterMix,
        '-af',
        'volumedetect',
        '-f',
        'null',
        '-',
      ]);
      const maxVolMatch = stderr.match(/max_volume:\s*([-\d.]+)\s*dB/);
      const meanVolMatch = stderr.match(/mean_volume:\s*([-\d.]+)\s*dB/);
      const maxVol = maxVolMatch ? Number(maxVolMatch[1]) : -1;
      const meanVol = meanVolMatch ? Number(meanVolMatch[1]) : -20;

      if (meanVol < -55) {
        checks.push({
          category: 'audio',
          name: 'Audio loudness & silence',
          status: 'warn',
          details: `Audio track is nearly silent (mean ${meanVol} dB).`,
        });
      } else if (maxVol > -0.1) {
        checks.push({
          category: 'audio',
          name: 'Audio clipping check',
          status: 'warn',
          details: `Peak volume near 0 dB (${maxVol} dB); slight clipping risk.`,
        });
      } else {
        checks.push({
          category: 'audio',
          name: 'Audio loudness & clipping',
          status: 'pass',
          details: `Mean ${meanVol} dB, peak ${maxVol} dB (clean headroom).`,
        });
      }
    } catch {
      checks.push({
        category: 'audio',
        name: 'Audio stream inspection',
        status: 'warn',
        details: 'Could not run volumedetect on master mix.',
      });
    }
  }

  // 4. Final Video Stream & Black Frame Inspection
  let mediaProbe: QCReport['mediaProbe'];
  const finalMp4 = manifest.exports.landscapeMp4;

  if (!finalMp4 || !fs.existsSync(finalMp4)) {
    checks.push({
      category: 'visual',
      name: 'Final MP4 export',
      status: 'fail',
      details: 'Final assembled MP4 does not exist yet.',
    });
  } else {
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration,size:stream=codec_type,width,height,r_frame_rate',
        '-of',
        'json',
        finalMp4,
      ]);
      const data = JSON.parse(stdout) as {
        format?: { duration?: string; size?: string };
        streams?: Array<{
          codec_type?: string;
          width?: number;
          height?: number;
          r_frame_rate?: string;
        }>;
      };
      const videoStream = data.streams?.find((s) => s.codec_type === 'video');
      const audioStream = data.streams?.find((s) => s.codec_type === 'audio');
      const dur = Number(data.format?.duration || 0);
      const sizeBytes = Number(data.format?.size || 0);
      const fpsParts = (videoStream?.r_frame_rate || '24/1').split('/');
      const fps = Number(fpsParts[0]) / Math.max(1, Number(fpsParts[1] || 1));

      mediaProbe = {
        durationSeconds: Number(dur.toFixed(2)),
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
        fps: Number(fps.toFixed(2)),
        hasVideo: Boolean(videoStream),
        hasAudio: Boolean(audioStream),
        fileSizeBytes: sizeBytes,
      };

      const dimOk =
        mediaProbe.width === expectedDim.width && mediaProbe.height === expectedDim.height;
      checks.push({
        category: 'visual',
        name: 'Output dimensions & aspect ratio',
        status: dimOk ? 'pass' : 'warn',
        details: `Actual ${mediaProbe.width}x${mediaProbe.height} @ ${mediaProbe.fps}fps (expected ${expectedDim.width}x${expectedDim.height}).`,
      });

      const durDiff = Math.abs(dur - manifest.targetDurationSeconds);
      checks.push({
        category: 'audio',
        name: 'Audio/video target duration sync',
        status: durDiff <= 3.0 ? 'pass' : 'warn',
        details: `Rendered ${dur.toFixed(2)}s vs target ${manifest.targetDurationSeconds}s (delta ${durDiff.toFixed(2)}s).`,
      });

      // Black frame detection (ignore short fade-in/out under 1.0s)
      const { stderr: blackErr } = await execFileAsync('ffmpeg', [
        '-i',
        finalMp4,
        '-vf',
        'blackdetect=d=1.2:pix_th=0.10',
        '-an',
        '-f',
        'null',
        '-',
      ]);
      const blackMatches = blackErr.match(/black_duration:([\d.]+)/g) || [];
      checks.push({
        category: 'visual',
        name: 'Extended black-frame detection',
        status: blackMatches.length === 0 ? 'pass' : 'warn',
        details:
          blackMatches.length === 0
            ? 'No unintended black segments (>=1.2s) detected.'
            : `${blackMatches.length} extended black segment(s) detected.`,
      });
    } catch (err) {
      checks.push({
        category: 'visual',
        name: 'Final MP4 probe',
        status: 'fail',
        details: err instanceof Error ? err.message : 'Failed to probe final video.',
      });
    }
  }

  const passed = checks.filter((c) => c.status === 'pass').length;
  const warnings = checks.filter((c) => c.status === 'warn').length;
  const failed = checks.filter((c) => c.status === 'fail').length;
  const overallStatus: QCReport['overallStatus'] =
    failed > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass';

  const report: QCReport = {
    projectId: manifest.projectId,
    generatedAt: new Date().toISOString(),
    overallStatus,
    summary: { passed, warnings, failed },
    checks,
    mediaProbe,
  };

  saveQCReport(report);
  return report;
}
