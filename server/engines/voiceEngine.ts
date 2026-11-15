import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { getProjectDir, WORKSPACE_ROOT } from '../db/database.ts';
import { ProjectManifest } from '../types/manifest.ts';

const execFileAsync = promisify(execFile);

export function resolvePiperBinary(): string | null {
  const candidates = [
    process.env.PIPER_BINARY_PATH,
    path.join(WORKSPACE_ROOT, 'models', 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper'),
  ].filter((p): p is string => Boolean(p && p.trim()));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function resolvePiperModel(language: string): string | null {
  if (process.env.PIPER_MODEL_PATH && fs.existsSync(process.env.PIPER_MODEL_PATH)) {
    return process.env.PIPER_MODEL_PATH;
  }
  const speechDir = path.join(WORKSPACE_ROOT, 'models', 'speech');
  if (!fs.existsSync(speechDir)) return null;
  const models = fs.readdirSync(speechDir).filter((f) => f.endsWith('.onnx'));
  if (models.length === 0) return null;
  const langKey = (language || 'en').toLowerCase().slice(0, 2);
  const matched =
    models.find((m) => m.toLowerCase().includes(`${langKey}_`) || m.toLowerCase().includes(`-${langKey}`)) ||
    models[0];
  return path.join(speechDir, matched);
}

export async function runPiperToWav(
  piperBin: string,
  modelPath: string | null,
  text: string,
  outWav: string,
  speakingSpeed = 1.0
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const lengthScale = (1 / Math.max(0.6, Math.min(1.5, speakingSpeed || 1.0))).toFixed(3);
    const args = ['--output_file', outWav, '--length_scale', lengthScale];
    if (modelPath) args.unshift('--model', modelPath);
    const proc = spawn(piperBin, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let errBuf = '';
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error('Piper TTS timed out'));
    }, 30000);
    proc.stderr?.on('data', (chunk) => {
      errBuf += String(chunk);
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && fs.existsSync(outWav)) resolve();
      else reject(new Error(errBuf || `Piper exited with code ${code}`));
    });
    proc.stdin?.write(text);
    proc.stdin?.end();
  });
}

export async function measureAudioDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'csv=p=0',
      filePath,
    ]);
    return Number(stdout.trim() || 0);
  } catch {
    return 0;
  }
}

export interface VoiceValidationResult {
  valid: boolean;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  warnings: string[];
}

export async function validateVoiceSample(filePath: string): Promise<VoiceValidationResult> {
  const warnings: string[] = [];
  if (!fs.existsSync(filePath)) {
    return {
      valid: false,
      durationSeconds: 0,
      sampleRate: 0,
      channels: 0,
      warnings: ['Voice sample file not found.'],
    };
  }
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration:stream=sample_rate,channels',
      '-of',
      'json',
      filePath,
    ]);
    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{ sample_rate?: string; channels?: number }>;
    };
    const duration = Number(parsed.format?.duration || 0);
    const stream = parsed.streams?.[0];
    const sampleRate = Number(stream?.sample_rate || 0);
    const channels = Number(stream?.channels || 1);

    if (duration < 3) {
      warnings.push('Voice sample is shorter than 3 seconds; XTTS cloning recommends 6–30 seconds of clean speech.');
    }
    if (duration > 120) {
      warnings.push('Voice sample exceeds 120 seconds; trimming to a 20-second clean window is recommended.');
    }
    return {
      valid: duration > 0.5,
      durationSeconds: Number(duration.toFixed(2)),
      sampleRate,
      channels,
      warnings,
    };
  } catch (err) {
    return {
      valid: false,
      durationSeconds: 0,
      sampleRate: 0,
      channels: 0,
      warnings: [err instanceof Error ? err.message : 'Failed to inspect audio stream.'],
    };
  }
}

export function applyPronunciationDictionary(
  text: string,
  dict: Record<string, string>
): string {
  let out = text;
  for (const [term, replacement] of Object.entries(dict || {})) {
    if (!term.trim()) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), replacement);
  }
  return out;
}

/**
 * Generates scene-synchronized narration WAV & MP3.
 * Uses Piper TTS when available (auto-detecting models/piper/piper & models/speech/*.onnx),
 * or preserves user-uploaded/pre-packaged narration if present,
 * or synthesizes a clean spoken-cadence tone/pause bed when running in zero-model mode so
 * audio mixing, ducking, and video assembly always produce valid, duration-matched media.
 */
export async function generateProjectNarration(
  manifest: ProjectManifest
): Promise<{
  manifest: ProjectManifest;
  engineUsed: string;
  narrationWavPath: string;
  narrationMp3Path: string;
}> {
  const projectDir = getProjectDir(manifest.projectId);
  const audioDir = path.join(projectDir, 'audio');
  fs.mkdirSync(audioDir, { recursive: true });

  const narrationWavPath = path.join(audioDir, 'narration_master.wav');
  const narrationMp3Path = path.join(audioDir, 'narration_master.mp3');

  // Consent enforcement check for voice cloning
  if (
    manifest.voiceConfig.voiceSamplePath &&
    manifest.voiceConfig.voiceIdentity === 'cloned' &&
    !manifest.voiceConfig.consentVerified
  ) {
    throw new Error(
      'Voice cloning consent verification is required before using a reference voice sample.'
    );
  }

  const piperBin = resolvePiperBinary();
  const piperModel = resolvePiperModel(manifest.voiceConfig.language);
  const hasPiper = Boolean(piperBin && fs.existsSync(piperBin) && piperModel);
  const preferImported = manifest.voiceConfig.voiceIdentity === 'imported';
  const suppliedMaster =
    manifest.voiceConfig.generatedNarrationPath &&
    fs.existsSync(manifest.voiceConfig.generatedNarrationPath)
      ? manifest.voiceConfig.generatedNarrationPath
      : null;

  const segmentFiles: string[] = [];
  let engineUsed = 'deterministic-cadence-guide';

  const updatedScenes = [];

  for (const scene of manifest.scenes) {
    const cleanText = applyPronunciationDictionary(
      scene.narrationText || scene.title,
      manifest.voiceConfig.pronunciationDict
    );
    const sceneWav = path.join(audioDir, `${scene.id}_narration.wav`);
    const rawPiperWav = path.join(audioDir, `${scene.id}_piper_raw.wav`);
    const existingShotAudio = scene.shots.find(
      (s) => s.narrationAudioPath && fs.existsSync(s.narrationAudioPath) && fs.statSync(s.narrationAudioPath).size > 4096
    )?.narrationAudioPath;

    if (preferImported && fs.existsSync(sceneWav) && fs.statSync(sceneWav).size > 4096) {
      engineUsed = 'imported-scene-narration';
    } else if (preferImported && existingShotAudio) {
      engineUsed = 'imported-scene-narration';
      await normalizeAndPadAudio(existingShotAudio, sceneWav, scene.duration);
    } else if (preferImported && suppliedMaster) {
      engineUsed = 'user-supplied-narration';
      await sliceAndNormalizeAudio(
        suppliedMaster,
        sceneWav,
        scene.startTime,
        scene.duration
      );
    } else if (hasPiper && piperBin) {
      engineUsed = `piper-tts-local (${path.basename(piperModel!)})`;
      try {
        await runPiperToWav(
          piperBin,
          piperModel,
          cleanText,
          rawPiperWav,
          manifest.voiceConfig.speakingSpeed || 1.0
        );
        await normalizeAndPadAudio(rawPiperWav, sceneWav, scene.duration);
        if (fs.existsSync(rawPiperWav)) fs.unlinkSync(rawPiperWav);
      } catch {
        await synthesizeCadenceSegment(sceneWav, scene.duration, scene.sceneNumber, cleanText.length);
      }
    } else if (suppliedMaster) {
      engineUsed = 'user-supplied-narration';
      await sliceAndNormalizeAudio(
        suppliedMaster,
        sceneWav,
        scene.startTime,
        scene.duration
      );
    } else {
      // Zero-model deterministic narration timing bed (warm gentle harmonic cadence envelope matching speech pauses)
      await synthesizeCadenceSegment(sceneWav, scene.duration, scene.sceneNumber, cleanText.length);
    }

    segmentFiles.push(sceneWav);
    updatedScenes.push({
      ...scene,
      shots: scene.shots.map((sh) => ({
        ...sh,
        narrationAudioPath: sceneWav,
      })),
    });
  }

  // Concatenate all scene narration WAVs into master WAV + MP3
  const concatListPath = path.join(audioDir, 'narration_concat.txt');
  fs.writeFileSync(
    concatListPath,
    segmentFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'),
    'utf8'
  );

  await execFileAsync('ffmpeg', [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concatListPath,
    '-ar',
    '44100',
    '-ac',
    '2',
    '-c:a',
    'pcm_s16le',
    narrationWavPath,
  ]);

  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    narrationWavPath,
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '192k',
    narrationMp3Path,
  ]);

  const nextManifest: ProjectManifest = {
    ...manifest,
    scenes: updatedScenes,
    voiceConfig: {
      ...manifest.voiceConfig,
      generatedNarrationPath: narrationWavPath,
    },
  };

  return {
    manifest: nextManifest,
    engineUsed,
    narrationWavPath,
    narrationMp3Path,
  };
}

async function sliceAndNormalizeAudio(
  inputPath: string,
  outputWav: string,
  startSec: number,
  targetDuration: number
) {
  await execFileAsync('ffmpeg', [
    '-y',
    '-ss',
    String(Math.max(0, startSec)),
    '-t',
    String(targetDuration),
    '-i',
    inputPath,
    '-af',
    `loudnorm=I=-16:TP=-1.5:LRA=11,apad=whole_dur=${targetDuration}`,
    '-t',
    String(targetDuration),
    '-ar',
    '44100',
    '-ac',
    '2',
    '-c:a',
    'pcm_s16le',
    outputWav,
  ]);
}

async function normalizeAndPadAudio(inputPath: string, outputWav: string, targetDuration: number) {
  const actualDur = await measureAudioDuration(inputPath);
  const filters: string[] = ['silenceremove=start_periods=1:start_threshold=-48dB'];
  // If synthesized speech slightly exceeds scene slot, gently accelerate tempo so no word is ever cut off
  if (actualDur > targetDuration - 0.08 && targetDuration > 0.5) {
    const neededTempo = Math.min(1.38, Math.max(1.01, (actualDur + 0.12) / targetDuration));
    filters.push(`atempo=${neededTempo.toFixed(3)}`);
  }
  filters.push(`loudnorm=I=-16:TP=-1.5:LRA=11`, `apad=whole_dur=${targetDuration}`);

  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    inputPath,
    '-af',
    filters.join(','),
    '-t',
    String(targetDuration),
    '-ar',
    '44100',
    '-ac',
    '2',
    '-c:a',
    'pcm_s16le',
    outputWav,
  ]);
}

async function synthesizeCadenceSegment(
  outputWav: string,
  duration: number,
  seedIdx: number,
  textLen = 80
) {
  // Produces a gentle, non-intrusive acoustic cadence cue (soft low chord pulse with natural breath pauses)
  const baseFreq = 196 + (seedIdx % 4) * 24;
  const pulseRate = Math.min(2.5, Math.max(0.8, textLen / Math.max(1, duration * 35)));
  const fadeOutStart = Math.max(0.1, duration - 0.35).toFixed(2);
  await execFileAsync('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=${baseFreq}:duration=${duration}:sample_rate=44100`,
    '-af',
    `volume=0.08,tremolo=f=${pulseRate.toFixed(2)}:d=0.65,afade=t=in:st=0:d=0.25,afade=t=out:st=${fadeOutStart}:d=0.35`,
    '-ac',
    '2',
    '-c:a',
    'pcm_s16le',
    outputWav,
  ]);
}
