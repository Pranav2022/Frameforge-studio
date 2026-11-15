import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { computeGenerationHash, getCachedFile, storeCachedFile } from '../server/engines/assetCache.ts';
import { applyCharacterAndEnvironmentConsistency } from '../server/engines/characterEngine.ts';
import { parseMotionInstruction } from '../server/engines/motionParser.ts';
import { processScriptToPlan, validateManifestDurations } from '../server/engines/scriptProcessor.ts';
import { buildSubtitleEntries, formatASS, formatSRT, formatVTT } from '../server/engines/subtitleEngine.ts';
import {
  applyPronunciationDictionary,
  resolvePiperBinary,
  resolvePiperModel,
} from '../server/engines/voiceEngine.ts';
import { ProjectManifestSchema } from '../server/types/manifest.ts';

function runUnitTests() {
  console.log('Running FrameForge Studio Unit Tests...');

  // 1. Motion Instruction Parser
  const motion = parseMotionInstruction(
    'Camera slowly moves toward subject while lightning flashes in the storm'
  );
  assert.equal(motion.camera, 'zoom_in');
  assert.equal(motion.cameraSpeed, 'slow');
  assert.equal(motion.weather, 'storm');
  assert.ok(motion.effects.includes('lightning'));
  assert.equal(motion.preserveCharacterIdentity, true);

  const panMotion = parseMotionInstruction('Fast pan left with snow and camera shake');
  assert.equal(panMotion.camera, 'pan_left');
  assert.equal(panMotion.cameraSpeed, 'fast');
  assert.equal(panMotion.weather, 'snow');
  assert.equal(panMotion.cameraShake, true);

  const shortsMotion = parseMotionInstruction(
    'Fast zoom-in with golden embers, god rays, violet aura, ground mist, and diagonal slice transition'
  );
  assert.ok(shortsMotion.effects.includes('golden_embers'));
  assert.ok(shortsMotion.effects.includes('god_rays'));
  assert.ok(shortsMotion.effects.includes('violet_aura'));
  assert.ok(shortsMotion.effects.includes('ground_mist'));
  assert.equal(shortsMotion.transitionOut, 'diagonal_slice');

  const whiteFlashMotion = parseMotionInstruction('Zoom out with flash white transition');
  assert.equal(whiteFlashMotion.transitionOut, 'flash_white');

  // 2. Generic Script Processor & Duration Math (Standard + Shorts Rapid)
  const sampleScript = `SCENE 1: Lab Entry - Observatory
[MOTION: Slow zoom-in]
NARRATOR: Scientists prepare the deep-sea probe before dawn.

SCENE 2: Descent - Ocean Trench
[MOTION: Pan right with fog]
NARRATOR: Pressure rises steadily as bioluminescent currents drift past the lens.`;

  const plan = processScriptToPlan(sampleScript, 60, [], [], 'documentary realistic');
  assert.equal(plan.scenes.length, 2);
  const totalDur = plan.scenes.reduce((a, s) => a + s.duration, 0);
  assert.ok(Math.abs(totalDur - 60) < 0.2, `Expected ~60s, got ${totalDur}`);

  const shortsPlan = processScriptToPlan(sampleScript, 30, [], [], '3D cinematic', 'shorts_rapid');
  const shortsShotCount = shortsPlan.scenes.reduce((a, s) => a + s.shots.length, 0);
  assert.ok(shortsShotCount >= 8, `Expected rapid micro-shots (>=8 for 30s), got ${shortsShotCount}`);

  // 3. Manifest Validation + Character Consistency + Branding Config
  const now = new Date().toISOString();
  let manifest = ProjectManifestSchema.parse({
    projectId: 'unit-test-proj',
    name: 'Deep Sea Probe',
    script: sampleScript,
    targetDurationSeconds: 60,
    createdAt: now,
    updatedAt: now,
    characters: [
      {
        id: 'char-researcher',
        name: 'Dr. Rao',
        appearance: 'Focused marine biologist',
        clothing: 'Yellow waterproof parka',
        fixedSeed: 777,
      },
    ],
    brandingConfig: {
      watermarkText: 'THE DIVINE JOURNEY',
      position: 'bottom_right',
      opacity: 0.82,
      color: '#F59E0B',
    },
    outputSettings: {
      aspectRatio: '9:16',
      fps: 25,
      pacingMode: 'shorts_rapid',
      burnSubtitles: true,
    },
    scenes: plan.scenes,
  });

  manifest.scenes[0].shots[0].charactersPresent = ['char-researcher'];
  manifest = applyCharacterAndEnvironmentConsistency(manifest);
  assert.ok(manifest.scenes[0].shots[0].positivePrompt.includes('Yellow waterproof parka'));
  assert.equal(manifest.scenes[0].shots[0].seed, 777);
  assert.equal(manifest.outputSettings.fps, 25);
  assert.equal(manifest.brandingConfig.watermarkText, 'THE DIVINE JOURNEY');

  const durCheck = validateManifestDurations(manifest);
  assert.equal(durCheck.valid, true);

  // 4. Subtitle Formatting & Overlap Check (including 9:16 ASS PlayRes)
  const subs = buildSubtitleEntries(manifest);
  assert.ok(subs.length >= 2);
  for (let i = 1; i < subs.length; i++) {
    assert.ok(subs[i].startTime >= subs[i - 1].endTime - 0.01, 'Subtitle overlap detected');
  }
  const srt = formatSRT(subs);
  const vtt = formatVTT(subs);
  const ass = formatASS(subs, manifest.outputSettings.subtitleStyle, {
    width: 720,
    height: 1280,
    isVertical: true,
  });
  assert.ok(srt.includes('-->'));
  assert.ok(vtt.startsWith('WEBVTT'));
  assert.ok(ass.includes('PlayResX: 720'));
  assert.ok(ass.includes('PlayResY: 1280'));

  // 5. Asset Cache Deduplication
  const h1 = computeGenerationHash({ b: 2, a: 1 });
  const h2 = computeGenerationHash({ a: 1, b: 2 });
  assert.equal(h1, h2);
  const tmpFile = path.join('/tmp', 'ff_cache_test.txt');
  fs.writeFileSync(tmpFile, 'cached-data', 'utf8');
  storeCachedFile(h1, 'txt', tmpFile);
  const hit = getCachedFile(h1, 'txt');
  assert.ok(hit && fs.existsSync(hit));
  fs.unlinkSync(tmpFile);

  // 6. Piper TTS Auto-Detection & Pronunciation Dictionary
  const piperBin = resolvePiperBinary();
  const piperModel = resolvePiperModel('en');
  assert.ok(piperBin && fs.existsSync(piperBin), 'Expected auto-detected Piper binary');
  assert.ok(piperModel && fs.existsSync(piperModel), 'Expected auto-detected Piper ONNX model');
  const pronounced = applyPronunciationDictionary('Mahishasura used Trishul', {
    Trishul: 'Tree-shool',
  });
  assert.equal(pronounced, 'Mahishasura used Tree-shool');

  console.log('All unit tests passed.');
}

runUnitTests();
