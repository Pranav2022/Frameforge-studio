import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { getProjectDir } from '../db/database.ts';
import { ProjectManifest } from '../types/manifest.ts';

const execFileAsync = promisify(execFile);

/**
 * Sound Design & Multi-Track Audio Mixer.
 * Mixes narration, background music (with sidechain ducking when narration is active),
 * ambient atmosphere, and fade-in / fade-out automation into a normalized master WAV.
 */
export async function mixProjectAudio(manifest: ProjectManifest): Promise<string> {
  const projectDir = getProjectDir(manifest.projectId);
  const audioDir = path.join(projectDir, 'audio');
  fs.mkdirSync(audioDir, { recursive: true });

  const mixedOut = path.join(audioDir, 'master_mix.wav');
  const duration = manifest.targetDurationSeconds;

  const narrationPath =
    manifest.voiceConfig.generatedNarrationPath &&
    fs.existsSync(manifest.voiceConfig.generatedNarrationPath)
      ? manifest.voiceConfig.generatedNarrationPath
      : null;

  const musicPath =
    manifest.audioConfig.backgroundMusicPath &&
    fs.existsSync(manifest.audioConfig.backgroundMusicPath)
      ? manifest.audioConfig.backgroundMusicPath
      : null;

  // Generate subtle zero-copyright ambient bed if no music file was provided
  const bgTrackPath = musicPath || path.join(audioDir, 'ambient_bed.wav');
  if (!musicPath) {
    const fadeOutStart = Math.max(0.5, duration - manifest.audioConfig.fadeOutSeconds).toFixed(2);
    await execFileAsync('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=110:duration=${duration}:sample_rate=44100`,
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=164.81:duration=${duration}:sample_rate=44100`,
      '-filter_complex',
      `[0:a][1:a]amix=inputs=2:weights=0.6 0.4,lowpass=f=420,volume=${manifest.audioConfig.ambientVolume},afade=t=in:st=0:d=${manifest.audioConfig.fadeInSeconds},afade=t=out:st=${fadeOutStart}:d=${manifest.audioConfig.fadeOutSeconds}`,
      '-ar',
      '44100',
      '-ac',
      '2',
      '-c:a',
      'pcm_s16le',
      bgTrackPath,
    ]);
  }

  if (!narrationPath) {
    await execFileAsync('ffmpeg', [
      '-y',
      '-stream_loop',
      '-1',
      '-i',
      bgTrackPath,
      '-t',
      String(duration),
      '-af',
      `volume=${manifest.audioConfig.musicVolume},loudnorm=I=-16:TP=-1.5:LRA=11`,
      '-ar',
      '44100',
      '-ac',
      '2',
      '-c:a',
      'pcm_s16le',
      mixedOut,
    ]);
    return mixedOut;
  }

  const fadeOutStart = Math.max(0.5, duration - manifest.audioConfig.fadeOutSeconds).toFixed(2);
  const musicVol = musicPath ? manifest.audioConfig.musicVolume : 0.65;
  const narVol = manifest.audioConfig.narrationVolume;

  const filterComplex = manifest.audioConfig.duckingEnabled
    ? `[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=${narVol},asplit=2[nar][sc];[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=${musicVol},afade=t=in:st=0:d=${manifest.audioConfig.fadeInSeconds},afade=t=out:st=${fadeOutStart}:d=${manifest.audioConfig.fadeOutSeconds}[mus];[mus][sc]sidechaincompress=threshold=0.02:ratio=4:attack=80:release=450[ducked];[nar][ducked]amix=inputs=2:duration=first:weights=1 0.9,loudnorm=I=-14:TP=-1.5:LRA=11[out]`
    : `[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=${narVol}[nar];[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=${musicVol},afade=t=in:st=0:d=${manifest.audioConfig.fadeInSeconds},afade=t=out:st=${fadeOutStart}:d=${manifest.audioConfig.fadeOutSeconds}[mus];[nar][mus]amix=inputs=2:duration=first:weights=1 0.9,loudnorm=I=-14:TP=-1.5:LRA=11[out]`;

  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    narrationPath,
    '-stream_loop',
    '-1',
    '-i',
    bgTrackPath,
    '-filter_complex',
    filterComplex,
    '-map',
    '[out]',
    '-t',
    String(duration),
    '-ar',
    '44100',
    '-ac',
    '2',
    '-c:a',
    'pcm_s16le',
    mixedOut,
  ]);

  return mixedOut;
}
