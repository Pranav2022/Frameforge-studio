import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR } from '../db/database.ts';

export function computeGenerationHash(params: Record<string, unknown>): string {
  const canonical = JSON.stringify(sortKeys(params));
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 24);
}

function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      out[key] = sortKeys((obj as Record<string, unknown>)[key]);
    }
    return out;
  }
  return obj;
}

export function getCachedFile(hash: string, ext: string): string | null {
  const filePath = path.join(CACHE_DIR, `${hash}.${ext.replace(/^\./, '')}`);
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
    return filePath;
  }
  return null;
}

export function storeCachedFile(hash: string, ext: string, sourceFilePath: string): string {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const target = path.join(CACHE_DIR, `${hash}.${ext.replace(/^\./, '')}`);
  if (sourceFilePath !== target) {
    fs.copyFileSync(sourceFilePath, target);
  }
  return target;
}

export function getCacheStats(): { fileCount: number; totalBytes: number } {
  if (!fs.existsSync(CACHE_DIR)) return { fileCount: 0, totalBytes: 0 };
  const files = fs.readdirSync(CACHE_DIR);
  let totalBytes = 0;
  for (const f of files) {
    const p = path.join(CACHE_DIR, f);
    if (fs.statSync(p).isFile()) {
      totalBytes += fs.statSync(p).size;
    }
  }
  return { fileCount: files.length, totalBytes };
}
