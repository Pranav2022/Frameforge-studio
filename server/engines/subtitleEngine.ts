import fs from 'node:fs';
import path from 'node:path';
import { getProjectDir } from '../db/database.ts';
import { ProjectManifest, SubtitleEntry, SubtitleStyle } from '../types/manifest.ts';

/**
 * Generates synchronized SubtitleEntry records from manifest shots,
 * wrapping lines cleanly to maxCharsPerLine and avoiding timestamp overlaps.
 */
export function buildSubtitleEntries(manifest: ProjectManifest): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  const isShorts =
    manifest.outputSettings.pacingMode === 'shorts_rapid' ||
    manifest.outputSettings.aspectRatio === '9:16';
  const configuredMax = manifest.outputSettings.subtitleStyle.maxCharsPerLine || 44;
  const maxChars = isShorts ? Math.min(configuredMax, 24) : configuredMax;
  const lang = manifest.outputSettings.subtitleLanguage || 'en';
  let idx = 1;

  for (const scene of manifest.scenes) {
    for (const shot of scene.shots) {
      const rawText = (shot.subtitleSegment || shot.narrationSegment || '').trim();
      if (!rawText) continue;

      const chunks = splitCaptionChunks(rawText, isShorts ? maxChars * 1.4 : maxChars * 2);
      const chunkDur = shot.duration / Math.max(1, chunks.length);

      for (let i = 0; i < chunks.length; i++) {
        const startTime = Number((shot.startTime + i * chunkDur).toFixed(3));
        const endTime = Number(
          Math.max(startTime + 0.35, shot.startTime + (i + 1) * chunkDur - 0.03).toFixed(3)
        );
        entries.push({
          index: idx++,
          startTime,
          endTime: Math.min(endTime, shot.endTime),
          text: wrapLines(chunks[i], maxChars),
          language: lang,
        });
      }
    }
  }
  return entries;
}

export function exportSubtitlesToFiles(
  manifest: ProjectManifest,
  entries: SubtitleEntry[]
): { srtPath: string; vttPath: string; assPath: string } {
  const projectDir = getProjectDir(manifest.projectId);
  const subDir = path.join(projectDir, 'subtitles');
  fs.mkdirSync(subDir, { recursive: true });

  const srtPath = path.join(subDir, 'subtitles.srt');
  const vttPath = path.join(subDir, 'subtitles.vtt');
  const assPath = path.join(subDir, 'subtitles.ass');

  const isVertical = manifest.outputSettings.aspectRatio === '9:16';
  const isSquare = manifest.outputSettings.aspectRatio === '1:1';
  const playRes = isVertical
    ? { width: 720, height: 1280, isVertical: true }
    : isSquare
    ? { width: 720, height: 720, isVertical: false }
    : { width: 1280, height: 720, isVertical: false };

  fs.writeFileSync(srtPath, formatSRT(entries), 'utf8');
  fs.writeFileSync(vttPath, formatVTT(entries), 'utf8');
  fs.writeFileSync(
    assPath,
    formatASS(entries, manifest.outputSettings.subtitleStyle, playRes),
    'utf8'
  );

  return { srtPath, vttPath, assPath };
}

export function formatSRT(entries: SubtitleEntry[]): string {
  return (
    entries
      .map(
        (e) =>
          `${e.index}\n${toSrtTimestamp(e.startTime)} --> ${toSrtTimestamp(e.endTime)}\n${e.text}`
      )
      .join('\n\n') + '\n'
  );
}

export function formatVTT(entries: SubtitleEntry[]): string {
  const body = entries
    .map(
      (e) =>
        `${toVttTimestamp(e.startTime)} --> ${toVttTimestamp(e.endTime)}\n${e.text}`
    )
    .join('\n\n');
  return `WEBVTT\n\n${body}\n`;
}

export function formatASS(
  entries: SubtitleEntry[],
  style: SubtitleStyle,
  playRes: { width: number; height: number; isVertical?: boolean } = { width: 1280, height: 720 }
): string {
  const alignment = style.position === 'top' ? 8 : style.position === 'center' ? 5 : 2;
  const primaryColor = hexToAssColor(style.color || '#FFFFFF');
  const backAlpha = Math.round((1 - (style.backgroundOpacity ?? 0.55)) * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  const fontSize = playRes.isVertical ? Math.max(36, (style.size || 24) + 14) : style.size || 24;
  const marginV = playRes.isVertical ? 140 : 28;
  const boldFlag = playRes.isVertical ? -1 : 0;

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${playRes.width}
PlayResY: ${playRes.height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.font || 'Arial'},${fontSize},${primaryColor},&H000000FF,&H00000000,&H${backAlpha}000000,${boldFlag},0,0,0,100,100,0,0,1,${style.outlineWidth ?? 2},1,${alignment},28,28,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const lines = entries.map(
    (e) =>
      `Dialogue: 0,${toAssTimestamp(e.startTime)},${toAssTimestamp(e.endTime)},Default,,0,0,0,,${e.text.replace(/\n/g, '\\N')}`
  );
  return header + lines.join('\n') + '\n';
}

function splitCaptionChunks(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let buf = '';
  for (const w of words) {
    if ((buf + ' ' + w).trim().length > maxChars && buf.length > 0) {
      chunks.push(buf.trim());
      buf = w;
    } else {
      buf = (buf + ' ' + w).trim();
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.length > 0 ? chunks : [text];
}

function wrapLines(text: string, maxLineLen: number): string {
  if (text.length <= maxLineLen) return text;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxLineLen && line) {
      lines.push(line.trim());
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) lines.push(line.trim());
  return lines.slice(0, 2).join('\n');
}

function toSrtTimestamp(sec: number): string {
  const totalMs = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function toVttTimestamp(sec: number): string {
  return toSrtTimestamp(sec).replace(',', '.');
}

function toAssTimestamp(sec: number): string {
  const csTotal = Math.max(0, Math.round(sec * 100));
  const h = Math.floor(csTotal / 360000);
  const m = Math.floor((csTotal % 360000) / 6000);
  const s = Math.floor((csTotal % 6000) / 100);
  const cs = csTotal % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function hexToAssColor(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '&H00FFFFFF';
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}
