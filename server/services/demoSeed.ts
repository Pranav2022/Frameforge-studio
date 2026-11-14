import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { getManifest, getProjectDir, saveManifest } from '../db/database.ts';
import { applyCharacterAndEnvironmentConsistency } from '../engines/characterEngine.ts';
import { processScriptToPlan } from '../engines/scriptProcessor.ts';
import { Character, Environment, ProjectManifest, ProjectManifestSchema } from '../types/manifest.ts';

const execFileAsync = promisify(execFile);

export const DEMO_PROJECT_ID = 'mahishasura-ep1';
export const SHORTS_DEMO_PROJECT_ID = 'mahishasura-birth-short';

const DEMO_SCRIPT = `SCENE 1: The Boons of Penance - Mountain Hermitage
[MOTION: Slow zoom-in with warm golden light rays]
NARRATOR: On the jagged peaks of ancient Mandara, Rambha's son Mahishasura stood in relentless penance. Season after season, rain and scorching sun tested his resolve until the sky itself trembled.
MAHISHASURA: Grant me a boon that no mortal or celestial warrior may end my life.

SCENE 2: Ascent to Power - Obsidian Fortress
[MOTION: Slow pan right across towering fortress pillars with fire embers]
NARRATOR: Armed with the boon that no man could defeat him, Mahishasura forged an unstoppable legion. Ancient banners rose above obsidian battlements as the balance of the three realms began to fracture.

SCENE 3: Gathering Storm - Celestial Citadel
[MOTION: Slow push-in with storm clouds and lightning flash]
NARRATOR: Driven from their sanctuaries, the guardians of the cosmos convened amid thunderclouds and fading starlight. Their combined radiance converged into a single, unwavering resolve.
NARRATOR: From sacred flame and celestial grace emerged Devi, bearing the trident, discus, and lotus of cosmic order.

SCENE 4: The Dawn Confrontation - Crimson Battlefield
[MOTION: Layered parallax drift with dramatic fire glow and slow zoom-out]
NARRATOR: Beneath a crimson twilight sky, pride met cosmic dharma upon the open plains. This first chapter sets the stage for the timeless clash between unbridled power and fearless truth.`;

const SHORTS_DEMO_SCRIPT = `SCENE 1: The Hook - Mystic Forest Shrine
[MOTION: Fast zoom-in with golden embers, god rays, and white flash transition]
NARRATOR: Did you know why Mahishasura was half human and half buffalo? Behind this fierce form lies a mysterious ancient curse!

SCENE 2: The Penance & Curse - Riverbank Sanctuary
[MOTION: Pan right with violet aura, ground mist, and diagonal slice transition]
NARRATOR: Asura king Rambha fell in love with a sacred river spirit. Under a sage's wrath, she was transformed into a she-buffalo in the forest depths.

SCENE 3: The Birth from Fire - Ember Battleground
[MOTION: Fast zoom-in with fire, golden embers, lightning storm, and wipe left transition]
NARRATOR: When their child emerged from the sacred fire, he inherited both unmatched royal intellect and the unstoppable strength of a charging bull.

SCENE 4: The Cosmic Boons - Crimson Horizon
[MOTION: Layered parallax with god rays, golden embers, and circle open transition]
NARRATOR: Driven by devotion and relentless tapasya, Mahishasura earned an extraordinary boon—making him invincible until Devi stepped forth!`;

/**
 * Seeds both the 16:9 Episode 1 demo and the 9:16 Vertical Shorts demo cleanly on startup.
 */
export async function ensureDemoProjectSeeded(): Promise<ProjectManifest> {
  await ensureShortsDemoSeeded(false);
  const existing = getManifest(DEMO_PROJECT_ID);
  if (existing) return existing;

  const projectDir = getProjectDir(DEMO_PROJECT_ID);
  const charsDir = path.join(projectDir, 'characters');
  const envsDir = path.join(projectDir, 'environments');
  fs.mkdirSync(charsDir, { recursive: true });
  fs.mkdirSync(envsDir, { recursive: true });

  // Generate local reference illustrations using ImageMagick (100% offline, zero copyright issues)
  const mahishasuraRef = path.join(charsDir, 'mahishasura_ref.png');
  const deviRef = path.join(charsDir, 'devi_ref.png');
  const mountainEnv = path.join(envsDir, 'mandara_peaks.png');
  const fortressEnv = path.join(envsDir, 'obsidian_fortress.png');
  const citadelEnv = path.join(envsDir, 'celestial_citadel.png');
  const battlefieldEnv = path.join(envsDir, 'crimson_battlefield.png');

  await Promise.all([
    renderCharacterCard(mahishasuraRef, 'Mahishasura', '#450a0a', '#ea580c', 'horned'),
    renderCharacterCard(deviRef, 'Devi', '#31102f', '#f59e0b', 'radiant'),
    renderEnvironmentPlate(mountainEnv, 'Mandara Mountain Peaks', '#0f172a', '#b45309'),
    renderEnvironmentPlate(fortressEnv, 'Obsidian Fortress', '#18181b', '#dc2626'),
    renderEnvironmentPlate(citadelEnv, 'Celestial Citadel', '#172554', '#38bdf8'),
    renderEnvironmentPlate(battlefieldEnv, 'Crimson Battlefield', '#2e1010', '#f97316'),
  ]);

  const characters: Character[] = [
    {
      id: 'char-mahishasura',
      name: 'Mahishasura',
      description: 'Formidable shapeshifting asura monarch driven by fierce ambition.',
      appearance: 'Broad-shouldered armored silhouette, curved obsidian horns, intense amber gaze',
      faceDetails: 'Strong angular jaw, furrowed brow, bronze skin tone',
      bodyProportions: 'Tall towering heroic build',
      clothing: 'Dark bronze breastplate, crimson battle waist-sash, iron pauldrons',
      accessories: 'Curved steel mace, royal horned crown',
      colorPalette: ['#450a0a', '#ea580c', '#1c1917'],
      voiceIdentity: 'deep-commanding',
      referenceImages: [mahishasuraRef],
      negativePrompt: 'modern clothing, cartoon, blurry, watermark, extra limbs',
      styleInfo: 'epic painterly mythological illustration',
      fixedSeed: 2048,
    },
    {
      id: 'char-devi',
      name: 'Devi',
      description: 'Radiant embodiment of cosmic order born from unified celestial light.',
      appearance: 'Serene fearless expression, luminous golden aura, flowing dark hair',
      faceDetails: 'Calm determined eyes, golden bindu on forehead',
      bodyProportions: 'Graceful poised warrior stance',
      clothing: 'Crimson and gold silk battle saree, ornate celestial armor',
      accessories: 'Golden trident, blazing discus, lotus emblem',
      colorPalette: ['#7c2d12', '#f59e0b', '#fef3c7'],
      voiceIdentity: 'calm-resonant',
      referenceImages: [deviRef],
      negativePrompt: 'modern clothing, blurry, watermark, low contrast',
      styleInfo: 'epic painterly mythological illustration',
      fixedSeed: 4096,
    },
  ];

  const environments: Environment[] = [
    {
      id: 'env-mandara-mountain-peaks',
      name: 'Mountain Hermitage',
      description: 'High rocky Himalayan ridges veiled in dawn mist and golden sunbeams',
      backgroundImage: mountainEnv,
      lighting: 'Golden dawn shafts piercing mountain mist',
      weatherDefault: 'fog',
      colorPalette: ['#0f172a', '#b45309', '#f59e0b'],
    },
    {
      id: 'env-obsidian-fortress',
      name: 'Obsidian Fortress',
      description: 'Monolithic basalt pillars lit by blazing braziers and crimson banners',
      backgroundImage: fortressEnv,
      lighting: 'Warm torchlight against deep obsidian stone',
      weatherDefault: 'none',
      colorPalette: ['#18181b', '#7f1d1d', '#dc2626'],
    },
    {
      id: 'env-celestial-citadel',
      name: 'Celestial Citadel',
      description: 'Elevated cloud-ringed sanctuary crackling with gathering storm lightning',
      backgroundImage: citadelEnv,
      lighting: 'Cool indigo cloud light with electric cyan flashes',
      weatherDefault: 'storm',
      colorPalette: ['#172554', '#1e3a8a', '#38bdf8'],
    },
    {
      id: 'env-crimson-battlefield',
      name: 'Crimson Battlefield',
      description: 'Expansive dusty plain under a dramatic crimson twilight horizon',
      backgroundImage: battlefieldEnv,
      lighting: 'Deep crimson sunset backlight with drifting embers',
      weatherDefault: 'none',
      colorPalette: ['#2e1010', '#7c2d12', '#f97316'],
    },
  ];

  const analysis = processScriptToPlan(
    DEMO_SCRIPT,
    120,
    characters,
    environments,
    'epic painterly mythological illustration',
    'standard'
  );

  // Link scene environment IDs explicitly to our 4 generated backgrounds
  const envIds = environments.map((e) => e.id);
  analysis.scenes.forEach((scene, i) => {
    scene.environmentId = envIds[i % envIds.length];
    scene.shots.forEach((sh) => {
      sh.environmentId = scene.environmentId;
      if (i === 0 || i === 1) sh.charactersPresent = ['char-mahishasura'];
      if (i === 2) sh.charactersPresent = ['char-devi'];
      if (i === 3) sh.charactersPresent = ['char-mahishasura', 'char-devi'];
    });
  });

  const now = new Date().toISOString();
  let manifest = ProjectManifestSchema.parse({
    projectId: DEMO_PROJECT_ID,
    name: 'Mahishasura — Episode 1 (Demo)',
    description:
      '120-second deterministic demonstration project showcasing multi-scene script parsing, character consistency, FFmpeg camera/weather animation, narration, subtitles, and QC.',
    topic: 'Mahishasura Episode 1: Rise of the Asura King & Birth of Cosmic Resolve',
    script: DEMO_SCRIPT,
    targetDurationSeconds: 120,
    createdAt: now,
    updatedAt: now,
    stage: 'script_processed',
    characters,
    environments,
    scenes: analysis.scenes,
    voiceConfig: {
      language: 'en',
      voiceIdentity: 'piper-default',
      deliveryStyle: 'epic documentary narration',
      speakingSpeed: 1.0,
      emotionalTone: 'dramatic',
      pronunciationDict: {
        Mahishasura: 'Ma-hi-sha-su-ra',
        Devi: 'Day-vee',
        Mandara: 'Man-da-ra',
      },
    },
    generationSettings: {
      imageProvider: 'procedural',
      animationProvider: 'deterministic',
      lowVramMode: true,
      maxVramMb: 4096,
      visualStyle: 'epic painterly mythological illustration',
      defaultSeed: 2048,
    },
    outputSettings: {
      resolution: '720p',
      aspectRatio: '16:9',
      fps: 24,
      pacingMode: 'standard',
      exportVerticalAlso: true,
      exportSquareAlso: false,
      burnSubtitles: false,
      subtitleLanguage: 'en',
    },
  });

  manifest = applyCharacterAndEnvironmentConsistency(manifest);
  return saveManifest(manifest);
}

/**
 * Seeds the 9:16 25fps Vertical Short demonstration project modeled on rapid mythology Shorts:
 * ~3s micro-beats, xfade flash/diagonal transitions, golden embers, god rays, violet aura,
 * burned bold captions, and persistent corner watermark.
 */
export async function ensureShortsDemoSeeded(forceRecreate = false): Promise<ProjectManifest> {
  const existing = getManifest(SHORTS_DEMO_PROJECT_ID);
  if (existing && !forceRecreate) return existing;

  const projectDir = getProjectDir(SHORTS_DEMO_PROJECT_ID);
  const charsDir = path.join(projectDir, 'characters');
  const envsDir = path.join(projectDir, 'environments');
  fs.mkdirSync(charsDir, { recursive: true });
  fs.mkdirSync(envsDir, { recursive: true });

  const mysticForest = path.join(envsDir, 'mystic_forest_9x16.png');
  const riverSanctuary = path.join(envsDir, 'river_sanctuary_9x16.png');
  const emberGround = path.join(envsDir, 'ember_ground_9x16.png');
  const cosmicHorizon = path.join(envsDir, 'cosmic_horizon_9x16.png');
  const bullWarrior = path.join(charsDir, 'mahishasura_short_ref.png');

  await Promise.all([
    renderCharacterCard(bullWarrior, 'Mahishasura', '#2e1065', '#f59e0b', 'horned'),
    renderEnvironmentPlate(mysticForest, 'Mystic Shrine', '#090d16', '#f59e0b'),
    renderEnvironmentPlate(riverSanctuary, 'Sacred Riverbank', '#1e1b4b', '#7c3aed'),
    renderEnvironmentPlate(emberGround, 'Ember Sanctuary', '#450a0a', '#ea580c'),
    renderEnvironmentPlate(cosmicHorizon, 'Cosmic Horizon', '#172554', '#d97706'),
  ]);

  const characters: Character[] = [
    {
      id: 'char-mahishasura-short',
      name: 'Mahishasura',
      description: 'Mythological half-buffalo warrior king born from sacred fire and curse.',
      appearance: 'Commanding warrior silhouette with curved dark horns and glowing amber eyes',
      faceDetails: 'Intense dramatic expression, rim-lit in golden firelight',
      bodyProportions: 'Powerful towering stance framed in vertical 9:16 close-up',
      clothing: 'Antique bronze armor with crimson cape',
      accessories: 'Curved buffalo horns, golden amulet',
      colorPalette: ['#2e1065', '#f59e0b', '#450a0a'],
      voiceIdentity: 'dramatic-storyteller',
      referenceImages: [bullWarrior],
      negativePrompt: 'blurry, distorted anatomy, watermark, low contrast',
      styleInfo: '3D cinematic mythological fantasy render, volumetric god rays, golden rim lighting',
      fixedSeed: 5025,
    },
  ];

  const environments: Environment[] = [
    {
      id: 'env-mystic-shrine',
      name: 'Mystic Forest Shrine',
      description: 'Enchanted night shrine bathed in golden god rays and drifting fireflies',
      backgroundImage: mysticForest,
      lighting: 'Volumetric amber sunbeams cutting through dark canopy mist',
      weatherDefault: 'fog',
      colorPalette: ['#090d16', '#f59e0b'],
    },
    {
      id: 'env-riverbank-sanctuary',
      name: 'Riverbank Sanctuary',
      description: 'Violet-lit riverside sanctuary veiled in ground mist',
      backgroundImage: riverSanctuary,
      lighting: 'Mystic violet moonlight and shimmering water reflections',
      weatherDefault: 'fog',
      colorPalette: ['#1e1b4b', '#7c3aed'],
    },
    {
      id: 'env-ember-battleground',
      name: 'Ember Battleground',
      description: 'Smoldering ceremonial altar surrounded by rising sparks and storm lightning',
      backgroundImage: emberGround,
      lighting: 'Blazing orange underlighting with storm flashes',
      weatherDefault: 'storm',
      colorPalette: ['#450a0a', '#ea580c'],
    },
    {
      id: 'env-cosmic-horizon',
      name: 'Crimson Horizon',
      description: 'Dramatic cliffside silhouette beneath celestial clouds and golden glow',
      backgroundImage: cosmicHorizon,
      lighting: 'Warm celestial twilight rays',
      weatherDefault: 'none',
      colorPalette: ['#172554', '#d97706'],
    },
  ];

  const analysis = processScriptToPlan(
    SHORTS_DEMO_SCRIPT,
    45,
    characters,
    environments,
    '3D cinematic mythological fantasy illustration, moody lighting, golden embers',
    'shorts_rapid'
  );

  const envIds = environments.map((e) => e.id);
  analysis.scenes.forEach((sc, i) => {
    sc.environmentId = envIds[i % envIds.length];
    sc.shots.forEach((sh) => {
      sh.environmentId = sc.environmentId;
      sh.charactersPresent = ['char-mahishasura-short'];
    });
  });

  const now = new Date().toISOString();
  let manifest = ProjectManifestSchema.parse({
    projectId: SHORTS_DEMO_PROJECT_ID,
    name: 'Mahishasura Birth Mystery — 9:16 Short (Demo)',
    description:
      '45-second vertical 9:16 (25fps) Shorts-style demonstration with 3s rapid beats, golden embers, god rays, violet aura, flash/slice xfade transitions, burned captions, and channel watermark.',
    topic: 'Why Mahishasura Was Half Human & Half Buffalo',
    script: SHORTS_DEMO_SCRIPT,
    targetDurationSeconds: 45,
    createdAt: now,
    updatedAt: now,
    stage: 'script_processed',
    characters,
    environments,
    scenes: analysis.scenes,
    voiceConfig: {
      language: 'en',
      voiceIdentity: 'piper-default',
      deliveryStyle: 'dramatic Shorts storytelling',
      speakingSpeed: 1.08,
      emotionalTone: 'suspenseful',
      pronunciationDict: {
        Mahishasura: 'Ma-hi-sha-su-ra',
        Rambha: 'Ram-bha',
        Devi: 'Day-vee',
      },
    },
    brandingConfig: {
      watermarkText: 'THE DIVINE JOURNEY',
      position: 'bottom_right',
      opacity: 0.82,
      color: '#F59E0B',
    },
    generationSettings: {
      imageProvider: 'procedural',
      animationProvider: 'deterministic',
      lowVramMode: true,
      maxVramMb: 4096,
      visualStyle: '3D cinematic mythological fantasy illustration',
      defaultSeed: 5025,
    },
    outputSettings: {
      resolution: '720p',
      aspectRatio: '9:16',
      fps: 25,
      pacingMode: 'shorts_rapid',
      exportVerticalAlso: false,
      exportSquareAlso: false,
      burnSubtitles: true,
      subtitleLanguage: 'en',
      subtitleStyle: {
        font: 'Arial',
        size: 28,
        color: '#FEF08A',
        position: 'bottom',
        backgroundOpacity: 0.6,
        outlineWidth: 3,
        maxCharsPerLine: 22,
      },
    },
  });

  manifest = applyCharacterAndEnvironmentConsistency(manifest);
  return saveManifest(manifest);
}

async function renderCharacterCard(
  outPath: string,
  title: string,
  bgHex: string,
  accentHex: string,
  motif: 'horned' | 'radiant'
) {
  const motifDraw =
    motif === 'horned'
      ? [
          '-fill',
          accentHex,
          '-draw',
          'circle 256,210 256,130',
          '-fill',
          '#09090b',
          '-draw',
          'polygon 160,480 205,270 307,270 352,480',
          '-draw',
          'circle 256,215 256,162',
          '-fill',
          accentHex,
          '-draw',
          'polygon 185,180 140,105 205,158',
          '-draw',
          'polygon 327,180 372,105 307,158',
        ]
      : [
          '-fill',
          accentHex,
          '-draw',
          'circle 256,205 256,110',
          '-fill',
          '#1f091c',
          '-draw',
          'polygon 175,480 212,265 300,265 337,480',
          '-draw',
          'circle 256,205 256,158',
          '-fill',
          '#fef3c7',
          '-draw',
          'circle 256,198 256,192',
        ];

  await execFileAsync('convert', [
    '-size',
    '512x512',
    `gradient:${bgHex}-#09090b`,
    ...motifDraw,
    '-gravity',
    'south',
    '-fill',
    '#f8fafc',
    '-pointsize',
    '26',
    '-annotate',
    '+0+24',
    title,
    outPath,
  ]).catch(async () => {
    await execFileAsync('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=${bgHex.replace('#', '0x')}:s=512x512:d=1`,
      '-frames:v',
      '1',
      outPath,
    ]);
  });
}

async function renderEnvironmentPlate(
  outPath: string,
  label: string,
  topHex: string,
  bottomHex: string
) {
  await execFileAsync('convert', [
    '-size',
    '1280x720',
    `gradient:${topHex}-${bottomHex}`,
    '-fill',
    '#090d16',
    '-draw',
    "path 'M 0,720 L 0,480 L 210,410 L 420,465 L 670,355 L 920,455 L 1140,395 L 1280,445 L 1280,720 Z'",
    '-gravity',
    'southwest',
    '-fill',
    'rgba(248,250,252,0.72)',
    '-pointsize',
    '22',
    '-annotate',
    '+28+24',
    label,
    outPath,
  ]).catch(async () => {
    await execFileAsync('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=${topHex.replace('#', '0x')}:s=1280x720:d=1`,
      '-frames:v',
      '1',
      outPath,
    ]);
  });
}
