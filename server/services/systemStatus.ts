import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { CACHE_DIR, PROJECTS_DIR } from '../db/database.ts';
import { getCacheStats } from '../engines/assetCache.ts';
import { resolvePiperBinary, resolvePiperModel } from '../engines/voiceEngine.ts';

const execFileAsync = promisify(execFile);

export interface SystemStatusReport {
  platform: string;
  cpuModel: string;
  cpuCores: number;
  totalRamGb: number;
  freeRamGb: number;
  lowVramMode: boolean;
  vramBudgetMb: number;
  storage: {
    projectsBytes: number;
    cacheBytes: number;
    cacheFiles: number;
  };
  tools: {
    ffmpegAvailable: boolean;
    ffmpegVersion: string;
    ffprobeAvailable: boolean;
    imagemagickAvailable: boolean;
    comfyUiReachable: boolean;
    ollamaReachable: boolean;
    piperConfigured: boolean;
  };
}

export async function getSystemStatus(): Promise<SystemStatusReport> {
  const [ffmpegVersion, ffprobeAvailable, imagemagickAvailable, comfyUiReachable, ollamaReachable] =
    await Promise.all([
      probeCommand('ffmpeg', ['-version']),
      probeBoolean('ffprobe', ['-version']),
      probeBoolean('convert', ['-version']),
      probeHttp(process.env.COMFYUI_API_URL || 'http://127.0.0.1:8188', '/system_stats'),
      probeHttp(process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434', '/api/tags'),
    ]);

  const cacheStats = getCacheStats();
  const projectsBytes = folderBytes(PROJECTS_DIR);
  const piperBin = resolvePiperBinary();
  const piperModel = resolvePiperModel('en');

  return {
    platform: `${os.platform()} (${os.arch()})`,
    cpuModel: os.cpus()[0]?.model || 'CPU',
    cpuCores: os.cpus().length,
    totalRamGb: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
    freeRamGb: Number((os.freemem() / 1024 ** 3).toFixed(1)),
    lowVramMode: process.env.LOW_VRAM_MODE !== 'false',
    vramBudgetMb: Number(process.env.VRAM_BUDGET_MB || 4096),
    storage: {
      projectsBytes,
      cacheBytes: cacheStats.totalBytes,
      cacheFiles: cacheStats.fileCount,
    },
    tools: {
      ffmpegAvailable: Boolean(ffmpegVersion),
      ffmpegVersion: ffmpegVersion || 'Not found',
      ffprobeAvailable,
      imagemagickAvailable,
      comfyUiReachable,
      ollamaReachable,
      piperConfigured: Boolean(piperBin && piperModel),
    },
  };
}

async function probeCommand(cmd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(cmd, args, { timeout: 2000 });
    return stdout.split('\n')[0]?.trim() || 'Installed';
  } catch {
    return null;
  }
}

async function probeBoolean(cmd: string, args: string[]): Promise<boolean> {
  return Boolean(await probeCommand(cmd, args));
}

async function probeHttp(baseUrl: string, suffix: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}${suffix}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

function folderBytes(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += folderBytes(full);
    else if (entry.isFile()) total += fs.statSync(full).size;
  }
  return total;
}

export function clearUnusedCache(): { removedFiles: number } {
  if (!fs.existsSync(CACHE_DIR)) return { removedFiles: 0 };
  const files = fs.readdirSync(CACHE_DIR);
  for (const f of files) {
    const full = path.join(CACHE_DIR, f);
    if (fs.statSync(full).isFile()) fs.unlinkSync(full);
  }
  return { removedFiles: files.length };
}
