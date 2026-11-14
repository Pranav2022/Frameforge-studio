import crypto from 'node:crypto';
import {
  Character,
  Environment,
  ProjectManifest,
  Scene,
  Shot,
} from '../types/manifest.ts';
import { parseMotionInstruction } from './motionParser.ts';

export interface ScriptAnalysisResult {
  scenes: Scene[];
  detectedCharacters: string[];
  detectedLocations: string[];
  estimatedSpeakingSeconds: number;
  warnings: string[];
}

/**
 * Generic Script Processing Engine.
 * Supports scene markers (`SCENE 1:`, `INT.`, `EXT.`, `---`), dialogue (`NAME: line`),
 * motion cues (`[MOTION: ...]`), and narration blocks in any language (including English & Hindi Devanagari).
 */
export function processScriptToPlan(
  script: string,
  targetDurationSeconds: number,
  existingCharacters: Character[] = [],
  existingEnvironments: Environment[] = [],
  visualStyle: string = 'cinematic illustration',
  pacingMode: 'standard' | 'shorts_rapid' = 'standard'
): ScriptAnalysisResult {
  const warnings: string[] = [];
  const trimmed = (script || '').trim();
  if (!trimmed) {
    warnings.push('Script is empty. Add narration or scene blocks before asset generation.');
    return {
      scenes: [],
      detectedCharacters: [],
      detectedLocations: [],
      estimatedSpeakingSeconds: 0,
      warnings,
    };
  }

  // Split script into scene sections using explicit headers or blank-line paragraphs
  const lines = trimmed.split(/\r?\n/);
  interface RawBlock {
    title: string;
    location: string;
    lines: string[];
    motionCue: string;
  }

  const rawBlocks: RawBlock[] = [];
  let current: RawBlock | null = null;

  const sceneHeaderRegex = /^(?:SCENE\s+\d+[:.\-\s]*|INT\.|EXT\.|##+\s*)(.+)$/i;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (current && current.lines.length > 0 && !lines.some((l) => sceneHeaderRegex.test(l.trim()))) {
        rawBlocks.push(current);
        current = null;
      }
      continue;
    }

    const headerMatch = line.match(sceneHeaderRegex);
    if (headerMatch) {
      if (current && current.lines.length > 0) rawBlocks.push(current);
      const headerText = headerMatch[1].trim();
      const [titlePart, locPart] = headerText.split(/\s*[-–|@]\s*/);
      current = {
        title: titlePart || `Scene ${rawBlocks.length + 1}`,
        location: (locPart || titlePart || 'Primary Location').trim(),
        lines: [],
        motionCue: '',
      };
      continue;
    }

    if (!current) {
      current = {
        title: `Scene ${rawBlocks.length + 1}`,
        location: existingEnvironments[0]?.name || 'Primary Location',
        lines: [],
        motionCue: '',
      };
    }

    const motionMatch = line.match(/^\[(?:MOTION|CAMERA|ANIMATION)[:\s]+(.+)\]$/i);
    if (motionMatch) {
      current.motionCue = current.motionCue
        ? `${current.motionCue}; ${motionMatch[1].trim()}`
        : motionMatch[1].trim();
      continue;
    }

    const envMatch = line.match(/^\[(?:ENV|LOCATION|SETTING)[:\s]+(.+)\]$/i);
    if (envMatch) {
      current.location = envMatch[1].trim();
      continue;
    }

    current.lines.push(line);
  }
  if (current && (current.lines.length > 0 || rawBlocks.length === 0)) {
    rawBlocks.push(current);
  }

  if (rawBlocks.length === 0) {
    warnings.push('Could not parse distinct scenes; wrapped entire script as a single scene.');
    rawBlocks.push({
      title: 'Scene 1',
      location: 'Primary Location',
      lines: [trimmed],
      motionCue: 'Slow cinematic zoom-in',
    });
  }

  const detectedCharSet = new Set<string>();
  const detectedLocSet = new Set<string>();

  // First pass: calculate word counts and dialogue vs narration
  const parsedBlockMeta = rawBlocks.map((block, idx) => {
    detectedLocSet.add(block.location);
    const dialogueLines: Array<{ speaker: string; text: string }> = [];
    const narrationParts: string[] = [];

    for (const line of block.lines) {
      const dlgMatch = line.match(/^([A-Z\u0900-\u097F][A-Za-z0-9_\s\u0900-\u097F]{1,28}):\s+(.+)$/);
      if (dlgMatch && !/^(NARRATOR|NARRATION|VOICEOVER)$/i.test(dlgMatch[1].trim())) {
        const speaker = dlgMatch[1].trim();
        detectedCharSet.add(speaker);
        dialogueLines.push({ speaker, text: dlgMatch[2].trim() });
        narrationParts.push(dlgMatch[2].trim());
      } else {
        const cleaned = line.replace(/^(NARRATOR|NARRATION|VOICEOVER):\s*/i, '').trim();
        narrationParts.push(cleaned);
        for (const ch of existingCharacters) {
          if (cleaned.toLowerCase().includes(ch.name.toLowerCase())) {
            detectedCharSet.add(ch.name);
          }
        }
      }
    }

    const fullNarration = narrationParts.join(' ').trim();
    const wordCount = Math.max(1, fullNarration.split(/\s+/).filter(Boolean).length);
    const estimatedSpeechSec = Number((wordCount / 2.35).toFixed(2));

    const matchedEnv = existingEnvironments.find(
      (e) => e.name.toLowerCase() === block.location.toLowerCase()
    );

    return {
      index: idx,
      title: block.title,
      location: block.location,
      environmentId: matchedEnv?.id || `env-${slugify(block.location)}`,
      dialogueLines,
      narrationText: fullNarration,
      wordCount,
      estimatedSpeechSec,
      motionCue: block.motionCue || 'Slow cinematic zoom-in with golden embers',
    };
  });

  const totalEstimatedSpeech = parsedBlockMeta.reduce((acc, b) => acc + b.estimatedSpeechSec, 0);
  const totalWords = parsedBlockMeta.reduce((acc, b) => acc + b.wordCount, 0);

  if (totalEstimatedSpeech > targetDurationSeconds * 1.35) {
    warnings.push(
      `Script narration (~${Math.round(totalEstimatedSpeech)}s at ~140 WPM) exceeds target duration (${targetDurationSeconds}s). Consider trimming lines or increasing duration.`
    );
  }
  if (existingCharacters.length === 0 && detectedCharSet.size === 0) {
    warnings.push('No character names or reference profiles detected; consider adding character profiles for visual consistency.');
  }

  let cursorTime = 0;
  const scenes: Scene[] = parsedBlockMeta.map((b, idx) => {
    const isLast = idx === parsedBlockMeta.length - 1;
    const rawDur = (b.wordCount / Math.max(1, totalWords)) * targetDurationSeconds;
    const minSceneDur = pacingMode === 'shorts_rapid' ? 2.5 : 4;
    const sceneDuration = isLast
      ? Number(Math.max(minSceneDur, targetDurationSeconds - cursorTime).toFixed(2))
      : Number(Math.max(minSceneDur, rawDur).toFixed(2));

    const sceneStart = Number(cursorTime.toFixed(2));
    const sceneEnd = Number((sceneStart + sceneDuration).toFixed(2));
    cursorTime = sceneEnd;

    const sceneId = `scene-${idx + 1}`;
    const targetBeatSec = pacingMode === 'shorts_rapid' ? 3.2 : 8.0;
    const maxShotsPerScene = pacingMode === 'shorts_rapid' ? 8 : 5;
    const minShotsPerScene = pacingMode === 'shorts_rapid' ? 1 : 2;
    const shotCount = Math.max(
      minShotsPerScene,
      Math.min(maxShotsPerScene, Math.round(sceneDuration / targetBeatSec))
    );

    const sentences = splitIntoSentences(b.narrationText);
    const shots: Shot[] = [];
    const rapidTransitions = ['dissolve', 'flash_white', 'diagonal_slice', 'wipe_left'] as const;

    let shotCursor = sceneStart;
    for (let s = 0; s < shotCount; s++) {
      const isLastShot = s === shotCount - 1;
      const shotDur = isLastShot
        ? Number(Math.max(1.8, sceneEnd - shotCursor).toFixed(2))
        : Number((sceneDuration / shotCount).toFixed(2));
      const shotStart = Number(shotCursor.toFixed(2));
      const shotEnd = Number((shotStart + shotDur).toFixed(2));
      shotCursor = shotEnd;

      const startSent = Math.floor((s * sentences.length) / shotCount);
      const endSent = Math.floor(((s + 1) * sentences.length) / shotCount);
      const shotNarration =
        sentences.slice(startSent, Math.max(startSent + 1, endSent)).join(' ').trim() || b.narrationText;

      const cameraCycle =
        pacingMode === 'shorts_rapid'
          ? [
              b.motionCue,
              'Medium zoom-in with golden embers and god rays',
              'Dynamic pan right with ground mist and diagonal slice',
              'Slow zoom-out with violet aura and flash white',
            ]
          : [
              b.motionCue,
              'Slow horizontal pan right with subtle atmospheric depth',
              'Slow zoom-out revealing wide environment',
              'Layered parallax drift with soft light rays',
            ];
      const shotMotionPrompt = s === 0 ? b.motionCue : cameraCycle[s % cameraCycle.length];
      const parsedSpec = parseMotionInstruction(shotMotionPrompt);
      if (pacingMode === 'shorts_rapid' && parsedSpec.transitionOut === 'dissolve') {
        parsedSpec.transitionOut = rapidTransitions[(idx + s) % rapidTransitions.length];
      }

      const matchedChars = existingCharacters
        .filter(
          (ch) =>
            shotNarration.toLowerCase().includes(ch.name.toLowerCase()) ||
            b.dialogueLines.some((d) => d.speaker.toLowerCase() === ch.name.toLowerCase())
        )
        .map((c) => c.id);

      shots.push({
        id: `${sceneId}-shot-${s + 1}`,
        sceneId,
        shotNumber: s + 1,
        startTime: shotStart,
        endTime: shotEnd,
        duration: shotDur,
        charactersPresent: matchedChars,
        environmentId: b.environmentId,
        referenceImages: [],
        positivePrompt: `${visualStyle}, ${b.title}, location: ${b.location}. ${shotNarration.slice(0, 140)}`,
        negativePrompt: 'low quality, blurry, distorted anatomy, text overlay, watermark',
        motionPrompt: shotMotionPrompt,
        motionSpec: parsedSpec,
        animationModel: 'ffmpeg-deterministic-v2',
        generationMethod: 'deterministic',
        narrationSegment: shotNarration,
        soundEffects: [],
        subtitleSegment: shotNarration,
        status: 'pending',
        approved: false,
        seed: 1000 + idx * 100 + s,
      });
    }

    return {
      id: sceneId,
      sceneNumber: idx + 1,
      title: b.title,
      summary: b.narrationText.slice(0, 180),
      environmentId: b.environmentId,
      narrationText: b.narrationText,
      dialogueLines: b.dialogueLines,
      startTime: sceneStart,
      endTime: sceneEnd,
      duration: sceneDuration,
      sfxPaths: [],
      status: 'pending',
      shots,
    };
  });

  return {
    scenes,
    detectedCharacters: Array.from(detectedCharSet),
    detectedLocations: Array.from(detectedLocSet),
    estimatedSpeakingSeconds: Number(totalEstimatedSpeech.toFixed(2)),
    warnings,
  };
}

export function validateManifestDurations(manifest: ProjectManifest): {
  valid: boolean;
  totalSceneDuration: number;
  issues: string[];
} {
  const issues: string[] = [];
  if (manifest.scenes.length === 0) {
    issues.push('Manifest contains zero scenes.');
    return { valid: false, totalSceneDuration: 0, issues };
  }

  let totalSceneDuration = 0;
  for (const scene of manifest.scenes) {
    totalSceneDuration += scene.duration;
    if (scene.shots.length === 0) {
      issues.push(`Scene "${scene.title}" has zero shots.`);
    }
    const shotSum = scene.shots.reduce((acc, s) => acc + s.duration, 0);
    if (Math.abs(shotSum - scene.duration) > 1.0) {
      issues.push(
        `Scene "${scene.title}" shot durations (${shotSum.toFixed(1)}s) do not match scene duration (${scene.duration.toFixed(1)}s).`
      );
    }
  }

  if (Math.abs(totalSceneDuration - manifest.targetDurationSeconds) > 2.5) {
    issues.push(
      `Total scene duration (${totalSceneDuration.toFixed(1)}s) differs from target (${manifest.targetDurationSeconds}s).`
    );
  }

  return {
    valid: issues.length === 0,
    totalSceneDuration: Number(totalSceneDuration.toFixed(2)),
    issues,
  };
}

function splitIntoSentences(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text];
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32) || crypto.randomBytes(4).toString('hex')
  );
}
