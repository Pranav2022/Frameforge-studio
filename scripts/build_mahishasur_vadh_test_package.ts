import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type AdmZipType from 'adm-zip';
import {
  getProjectDir,
  PROJECTS_DIR,
  registerAsset,
  saveManifest,
  WORKSPACE_ROOT,
} from '../server/db/database.ts';
import { mixProjectAudio } from '../server/engines/audioMixer.ts';
import { applyCharacterAndEnvironmentConsistency } from '../server/engines/characterEngine.ts';
import { parseMotionInstruction } from '../server/engines/motionParser.ts';
import { runQualityControl } from '../server/engines/qcEngine.ts';
import { processScriptToPlan } from '../server/engines/scriptProcessor.ts';
import { buildSubtitleEntries, exportSubtitlesToFiles } from '../server/engines/subtitleEngine.ts';
import {
  assembleProjectVideo,
  createProjectArchiveZip,
} from '../server/engines/videoAssembler.ts';
import {
  generateProjectNarration,
  measureAudioDuration,
  resolvePiperBinary,
  resolvePiperModel,
  runPiperToWav,
} from '../server/engines/voiceEngine.ts';
import { animateShot } from '../server/providers/animationProvider.ts';
import {
  Character,
  Environment,
  ProjectManifest,
  ProjectManifestSchema,
  QCReport,
} from '../server/types/manifest.ts';

const require = createRequire(import.meta.url);
const AdmZip = require('adm-zip') as typeof AdmZipType;
const execFileAsync = promisify(execFile);

interface PartSpec {
  partNumber: number;
  projectId: string;
  slug: string;
  title: string;
  subEvent: string;
  hookQuestion: string;
  imageFile: string;
  characters: string[];
  environment: Environment;
  scenes: Array<{
    title: string;
    location: string;
    motionCue: string;
    narration: string;
    transitionHint?: string;
  }>;
}

const SHARED_CHARACTERS: Character[] = [
  {
    id: 'char-mahishasura',
    name: 'Mahishasura',
    description: 'Half-human half-buffalo asura king born from fire and royal curse.',
    appearance: 'Muscular towering asura warrior with curved obsidian buffalo horns, fierce glowing amber eyes, bronze armor',
    faceDetails: 'Sharp determined jaw, glowing eyes, intense expression',
    bodyProportions: 'Tall broad-shouldered warrior silhouette',
    clothing: 'Ornate dark bronze and crimson mythological battle armor with gold waistband',
    accessories: 'Heavy iron mace and obsidian horns',
    colorPalette: ['#7F1D1D', '#F59E0B', '#1C1917'],
    voiceIdentity: 'piper-en-us-lessac',
    referenceImages: [],
    negativePrompt: 'blurry, distorted anatomy, modern clothes, watermark',
    styleInfo: '3D cinematic mythological illustration',
    fixedSeed: 1081,
  },
  {
    id: 'char-brahma',
    name: 'Lord Brahma',
    description: 'Four-headed Creator deity seated on a sacred lotus.',
    appearance: 'Serene four-faced divine creator with flowing white beard, golden crown, and cosmic lotus throne',
    faceDetails: 'Calm ancient eyes radiating golden wisdom',
    bodyProportions: 'Regal serene seated divine stature',
    clothing: 'White and saffron silk dhoti with sacred thread and golden ornaments',
    accessories: 'Kamandalu water pot, palm-leaf Vedas, rosary beads',
    colorPalette: ['#FDE68A', '#F59E0B', '#FFFBEB'],
    voiceIdentity: 'piper-en-us-lessac',
    referenceImages: [],
    negativePrompt: 'blurry, extra limbs, watermark',
    styleInfo: '3D cinematic mythological illustration',
    fixedSeed: 1082,
  },
  {
    id: 'char-durga',
    name: 'Goddess Durga',
    description: 'Ten-armed Adi Shakti born from the combined radiance of the Trimurti and Devas.',
    appearance: 'Luminous ten-armed goddess riding a fierce golden lion, blazing cosmic halo, serene yet unstoppable expression',
    faceDetails: 'Radiant divine third eye, fearless compassionate gaze',
    bodyProportions: 'Graceful heroic ten-armed divine form',
    clothing: 'Regal crimson and gold Banarasi silk saree with celestial crown',
    accessories: 'Trishul, Sudarshan Chakra, Conch, Sword, Bow, Lotus',
    colorPalette: ['#DC2626', '#FBBF24', '#FFF7ED'],
    voiceIdentity: 'piper-en-us-lessac',
    referenceImages: [],
    negativePrompt: 'blurry, distorted face, modern clothes, watermark',
    styleInfo: '3D cinematic mythological illustration',
    fixedSeed: 1083,
  },
];

const PARTS: PartSpec[] = [
  {
    partNumber: 1,
    projectId: 'mahishasur-vadh-part-01',
    slug: 'part_01_birth',
    title: 'Mahishasur Vadh Part 1: The Cursed Birth',
    subEvent: 'Why, how, and when Mahishasura was born',
    hookQuestion: 'Why was the mighty demon king Mahishasura born half human and half buffalo?',
    imageFile: 'mahishasur_part1_birth_1794728699770.jpg',
    characters: ['char-mahishasura'],
    environment: {
      id: 'env-sacred-pyre',
      name: 'Ancient Pyre of Vindhya Foothills',
      description: 'Sacred twilight forest altar ablaze with mystical golden and violet fire.',
      lighting: 'blazing firelight against deep twilight sky',
      weatherDefault: 'none',
      colorPalette: ['#1E1B4B', '#EA580C', '#FDE047'],
    },
    scenes: [
      {
        title: 'The Hook Question',
        location: 'Ancient Pyre of Vindhya Foothills',
        motionCue: 'Fast zoom-in with golden embers and fire glow',
        narration: 'Why was the mighty demon king Mahishasura born half human and half buffalo?',
      },
      {
        title: 'The Curse & The Pyre',
        location: 'Ancient Pyre of Vindhya Foothills',
        motionCue: 'Slow pan right with smoke and glowing fire',
        narration: 'Ages ago, the asura king Rambha fell in love with Princess Shyamala, who had been cursed to live as a she-buffalo.',
      },
      {
        title: 'Rise From Sacred Flames',
        location: 'Ancient Pyre of Vindhya Foothills',
        motionCue: 'Dramatic tilt up with golden embers and flash white transition',
        narration: 'When a rival struck Rambha down, Shyamala stepped into his funeral pyre, and from those roaring flames rose Mahishasura.',
      },
    ],
  },
  {
    partNumber: 2,
    projectId: 'mahishasur-vadh-part-02',
    slug: 'part_02_penance',
    title: 'Mahishasur Vadh Part 2: Tapasya to Brahma',
    subEvent: 'How and why he performed fierce penance to summon Lord Brahma',
    hookQuestion: 'How did an angry half-buffalo warrior force Lord Brahma himself to descend from heaven?',
    imageFile: 'mahishasur_part2_penance_1794728699913.jpg',
    characters: ['char-mahishasura', 'char-brahma'],
    environment: {
      id: 'env-mount-meru',
      name: 'Scorching Peak of Mount Meru',
      description: 'Rugged sacred mountain summit glowing with intense heat waves and celestial clouds.',
      lighting: 'fiery saffron heat glow under storm clouds',
      weatherDefault: 'none',
      colorPalette: ['#451A03', '#F97316', '#FEF08A'],
    },
    scenes: [
      {
        title: 'The Hook Question',
        location: 'Scorching Peak of Mount Meru',
        motionCue: 'Fast zoom-in with god rays and golden embers',
        narration: 'How did an angry half-buffalo warrior force Lord Brahma himself to descend from heaven?',
      },
      {
        title: 'Ten Thousand Years of Fire',
        location: 'Scorching Peak of Mount Meru',
        motionCue: 'Parallax drift with fire and glowing aura',
        narration: 'Driven by vengeance for his slain father, Mahishasura climbed Mount Meru and meditated on one foot for ten thousand years.',
      },
      {
        title: 'Creator Appears',
        location: 'Scorching Peak of Mount Meru',
        motionCue: 'Slow zoom-out with god rays and flash white transition',
        narration: 'The blazing heat of his tapasya shook every realm until Creator Brahma descended upon his cosmic swan to speak.',
      },
    ],
  },
  {
    partNumber: 3,
    projectId: 'mahishasur-vadh-part-03',
    slug: 'part_03_boon',
    title: 'Mahishasur Vadh Part 3: The Fatal Loophole',
    subEvent: 'What boon he originally wanted vs. what he got and why',
    hookQuestion: 'Why did Lord Brahma refuse immortality, and why did Mahishasura settle for a fatal flaw?',
    imageFile: 'mahishasur_part3_boon_1794728701272.jpg',
    characters: ['char-brahma', 'char-mahishasura'],
    environment: {
      id: 'env-satyaloka-light',
      name: 'Golden Nimbus of Brahma',
      description: 'Radiant golden cosmic aura surrounding the lotus throne.',
      lighting: 'celestial golden backlight with misty clouds',
      weatherDefault: 'fog',
      colorPalette: ['#78350F', '#FBBF24', '#FEF9C3'],
    },
    scenes: [
      {
        title: 'The Hook Question',
        location: 'Golden Nimbus of Brahma',
        motionCue: 'Slow zoom-in with god rays and ground mist',
        narration: 'Why did Lord Brahma refuse immortality, and why did Mahishasura settle for a fatal flaw?',
      },
      {
        title: 'Immortality Denied',
        location: 'Golden Nimbus of Brahma',
        motionCue: 'Pan left with violet aura and glowing light',
        narration: 'Mahishasura originally demanded complete immortality, to never die at all. Brahma refused, declaring every born being must end.',
      },
      {
        title: 'Arrogance Seals His Fate',
        location: 'Golden Nimbus of Brahma',
        motionCue: 'Fast zoom-in with golden embers and diagonal slice transition',
        narration: 'Blinded by pride against women, Mahishasura asked that no man or god could slay him, leaving one fateful loophole open.',
      },
    ],
  },
  {
    partNumber: 4,
    projectId: 'mahishasur-vadh-part-04',
    slug: 'part_04_conquest',
    title: 'Mahishasur Vadh Part 4: Conquest of Swarga',
    subEvent: 'After getting the boon: what he did and how he did it',
    hookQuestion: 'What happened the very moment Mahishasura walked away with Brahma’s invincible boon?',
    imageFile: 'mahishasur_part4_conquest_1794728702382.jpg',
    characters: ['char-mahishasura'],
    environment: {
      id: 'env-swarga-siege',
      name: 'Fallen Gates of Indraloka',
      description: 'Shattered golden palace pillars beneath raging storm clouds and lightning.',
      lighting: 'stormy crimson and lightning flashes',
      weatherDefault: 'storm',
      colorPalette: ['#312E81', '#DC2626', '#F59E0B'],
    },
    scenes: [
      {
        title: 'The Hook Question',
        location: 'Fallen Gates of Indraloka',
        motionCue: 'Fast zoom-in with lightning and camera shake',
        narration: 'What happened the very moment Mahishasura walked away with Brahma’s invincible boon?',
      },
      {
        title: 'The Siege of Heaven',
        location: 'Fallen Gates of Indraloka',
        motionCue: 'Fast pan right with storm lightning and fire',
        narration: 'Drunk on unchecked power, he rallied massive asura legions and stormed the golden gates of Swarga.',
      },
      {
        title: 'Dethroning the Devas',
        location: 'Fallen Gates of Indraloka',
        motionCue: 'Tilt up with smoke and wipe left transition',
        narration: 'Indra’s thunderbolts shattered harmlessly against his armor, and within days Mahishasura seized the throne of heaven itself.',
      },
    ],
  },
  {
    partNumber: 5,
    projectId: 'mahishasur-vadh-part-05',
    slug: 'part_05_radiance',
    title: 'Mahishasur Vadh Part 5: Birth of Cosmic Shakti',
    subEvent: 'How the defeated Devas united their energy to manifest Goddess Durga',
    hookQuestion: 'When no god in heaven could defeat him, how was the ultimate warrior created?',
    imageFile: 'mahishasur_part5_radiance_1794728717202.jpg',
    characters: ['char-durga', 'char-brahma'],
    environment: {
      id: 'env-cosmic-tejas',
      name: 'Sanctum of Eternal Tejas',
      description: 'Deep starlit cosmic expanse illuminated by converging golden and crimson light.',
      lighting: 'blinding divine rays and swirling embers',
      weatherDefault: 'none',
      colorPalette: ['#581C87', '#F59E0B', '#FEF3C7'],
    },
    scenes: [
      {
        title: 'The Hook Question',
        location: 'Sanctum of Eternal Tejas',
        motionCue: 'Slow zoom-in with god rays and golden embers',
        narration: 'When no god in heaven could defeat him, how was the ultimate warrior created?',
      },
      {
        title: 'Convergence of the Trimurti',
        location: 'Sanctum of Eternal Tejas',
        motionCue: 'Parallax drift with violet aura and glowing rays',
        narration: 'Exiled from heaven, the desperate Devas sought Brahma, Vishnu, and Shiva. Pure divine fury blazed forth from every face.',
      },
      {
        title: 'Manifestation of Maa Durga',
        location: 'Sanctum of Eternal Tejas',
        motionCue: 'Slow zoom-out with god rays and flash white transition',
        narration: 'Streams of celestial radiance merged into one pillar of light, revealing the Supreme Mother: Adi Shakti Durga.',
      },
    ],
  },
  {
    partNumber: 6,
    projectId: 'mahishasur-vadh-part-06',
    slug: 'part_06_weapons',
    title: 'Mahishasur Vadh Part 6: The Celestial Arsenal',
    subEvent: 'How the gods placed their supreme weapons and sacred lion into Durga’s hands',
    hookQuestion: 'Which unstoppable divine weapons forged Goddess Durga’s ten arms before war began?',
    imageFile: 'mahishasur_part6_weapons_1794728717711.jpg',
    characters: ['char-durga'],
    environment: {
      id: 'env-divine-forge',
      name: 'Celestial Summit of Himavan',
      description: 'Snowy Himalayan peaks bathed in radiant golden and crimson divine power.',
      lighting: 'heroic golden rim lighting and floating embers',
      weatherDefault: 'none',
      colorPalette: ['#991B1B', '#F59E0B', '#FDE68A'],
    },
    scenes: [
      {
        title: 'The Hook Question',
        location: 'Celestial Summit of Himavan',
        motionCue: 'Fast zoom-in with golden embers and glow',
        narration: 'Which unstoppable divine weapons forged Goddess Durga’s ten arms before war began?',
      },
      {
        title: 'Gifts of the Gods',
        location: 'Celestial Summit of Himavan',
        motionCue: 'Slow pan left with god rays and golden embers',
        narration: 'Shiva gifted his invincible Trishul, Vishnu placed the spinning Chakra in her hand, and Agni armed her with blazing spears.',
      },
      {
        title: 'Mount of the Lion',
        location: 'Celestial Summit of Himavan',
        motionCue: 'Tilt up with fire glow and diagonal slice transition',
        narration: 'Lord Himavan offered a fearless golden lion as her mount, uniting all cosmic power inside one unstoppable warrior.',
      },
    ],
  },
  {
    partNumber: 7,
    projectId: 'mahishasur-vadh-part-07',
    slug: 'part_07_battle',
    title: 'Mahishasur Vadh Part 7: Nine Nights of Illusion',
    subEvent: 'The nine-day battle and Mahishasura’s shapeshifting forms',
    hookQuestion: 'How did Mahishasura shift between four deadly forms across nine nights to escape defeat?',
    imageFile: 'mahishasur_part7_battle_1794728717707.jpg',
    characters: ['char-durga', 'char-mahishasura'],
    environment: {
      id: 'env-kurukshetra-asura',
      name: 'Storm-Torn Battlefield of the Three Worlds',
      description: 'Shattered stone arena engulfed in violet storm mist and roaring fire.',
      lighting: 'dramatic lightning and crimson battle embers',
      weatherDefault: 'storm',
      colorPalette: ['#4C1D95', '#DC2626', '#F59E0B'],
    },
    scenes: [
      {
        title: 'The Hook Question',
        location: 'Storm-Torn Battlefield of the Three Worlds',
        motionCue: 'Fast zoom-in with lightning and camera shake',
        narration: 'How did Mahishasura shift between four deadly forms across nine nights to escape defeat?',
      },
      {
        title: 'Shapeshifting Fury',
        location: 'Storm-Torn Battlefield of the Three Worlds',
        motionCue: 'Pan right with violet aura and fire',
        narration: 'Cornered by Durga’s roar, he charged as a colossal buffalo, leaped as a raging lion, and fought as a towering armored giant.',
      },
      {
        title: 'Every Illusion Shattered',
        location: 'Storm-Torn Battlefield of the Three Worlds',
        motionCue: 'Zoom out with storm lightning and wipe left transition',
        narration: 'Even as a mad elephant tore the earth, her ten radiant arms shattered every illusion across nine relentless nights.',
      },
    ],
  },
  {
    partNumber: 8,
    projectId: 'mahishasur-vadh-part-08',
    slug: 'part_08_vadh',
    title: 'Mahishasur Vadh Part 8: Triumph of Dharma',
    subEvent: 'The final strike fulfilling Brahma’s loophole and restoring cosmic order',
    hookQuestion: 'How did a single forgotten loophole bring down the undefeated king on the tenth dawn?',
    imageFile: 'mahishasur_part8_vadh_1794728718881.jpg',
    characters: ['char-durga', 'char-mahishasura'],
    environment: {
      id: 'env-golden-dawn',
      name: 'Sacred Dawn of Victory',
      description: 'Golden sunrise breaking through dispersing storm clouds over purified heaven.',
      lighting: 'blazing golden sunrise with triumphant god rays',
      weatherDefault: 'none',
      colorPalette: ['#B45309', '#FBBF24', '#FFFBEB'],
    },
    scenes: [
      {
        title: 'The Hook Question',
        location: 'Sacred Dawn of Victory',
        motionCue: 'Fast zoom-in with golden embers and lightning',
        narration: 'How did a single forgotten loophole bring down the undefeated king on the tenth dawn?',
      },
      {
        title: 'The Final Strike',
        location: 'Sacred Dawn of Victory',
        motionCue: 'Dramatic zoom-in with god rays and camera shake',
        narration: 'Trapped in his half-human, half-buffalo form, Mahishasura realized too late that a Goddess stood before him. Her Trishul pierced his chest.',
      },
      {
        title: 'Dawn of Peace',
        location: 'Sacred Dawn of Victory',
        motionCue: 'Slow zoom-out with golden embers and god rays',
        narration: 'As darkness dissolved into golden dawn, the Devas rained flowers from heaven, celebrating eternal Dharma and Mahishasura Vadh.',
      },
    ],
  },
];

async function generateCinematicMusicBed(outputWav: string, durationSec: number): Promise<void> {
  const fadeOutStart = Math.max(0.5, durationSec - 2.0).toFixed(2);
  // Synthesizes a warm deep drone + rhythmic mythological pulse bed (zero copyright, clean headroom)
  await execFileAsync('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=98:duration=${durationSec}:sample_rate=44100`,
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=146.83:duration=${durationSec}:sample_rate=44100`,
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=196:duration=${durationSec}:sample_rate=44100`,
    '-filter_complex',
    `[0:a]volume=0.35[a0];[1:a]volume=0.28,tremolo=f=1.6:d=0.45[a1];[2:a]volume=0.18,tremolo=f=0.8:d=0.6[a2];[a0][a1][a2]amix=inputs=3,lowpass=f=480,aecho=0.6:0.7:180:0.35,afade=t=in:st=0:d=1.2,afade=t=out:st=${fadeOutStart}:d=2.0`,
    '-ar',
    '44100',
    '-ac',
    '2',
    '-c:a',
    'pcm_s16le',
    outputWav,
  ]);
}

async function createVariedShotPlate(
  sourceImg: string,
  destPng: string,
  variantIdx: number
): Promise<void> {
  // Source images are 768x1376 (9:16). Create distinct, sharp 720x1280 cinematic focal crops per shot.
  const crops = [
    // 0: Full heroic 9:16 composition
    ['-resize', '720x1280^', '-gravity', 'center', '-extent', '720x1280', '-modulate', '103,108,100'],
    // 1: Upper focal dramatic portrait / sky crown crop
    ['-crop', '640x1138+64+24', '+repage', '-resize', '720x1280!', '-modulate', '104,112,100'],
    // 2: Lower action / ground mist & weapons crop
    ['-crop', '650x1156+58+190', '+repage', '-resize', '720x1280!', '-modulate', '100,114,98'],
    // 3: Tight dramatic centerpiece push-in crop
    ['-crop', '580x1031+94+150', '+repage', '-resize', '720x1280!', '-modulate', '105,116,100'],
    // 4: Left-leaning dynamic diagonal framing
    ['-crop', '620x1102+16+120', '+repage', '-resize', '720x1280!', '-modulate', '102,110,101'],
    // 5: Right-leaning dynamic dramatic framing
    ['-crop', '620x1102+130+100', '+repage', '-resize', '720x1280!', '-modulate', '104,112,99'],
  ];
  const ops = crops[variantIdx % crops.length];
  await execFileAsync('convert', [sourceImg, ...ops, destPng], { timeout: 15000 });
}

async function main() {
  console.log('=== Building Mahishasur Vadh 8-Part Full Test Package ===');

  const piperBin = resolvePiperBinary();
  const piperModel = resolvePiperModel('en');
  if (!piperBin || !piperModel) {
    throw new Error(`Piper TTS binary or voice model missing. bin=${piperBin}, model=${piperModel}`);
  }
  console.log(`Using Piper TTS: ${piperBin} (${path.basename(piperModel)})`);

  const pkgRoot = path.join(PROJECTS_DIR, 'mahishasur-vadh-test-package');
  const pkgDirs = ['scripts', 'images', 'voice', 'packages', 'videos', 'manifests'].map((d) =>
    path.join(pkgRoot, d)
  );
  for (const d of pkgDirs) fs.mkdirSync(d, { recursive: true });

  const fullScriptParts: string[] = [];
  const partResults: Array<{
    partNumber: number;
    projectId: string;
    title: string;
    subEvent: string;
    hookQuestion: string;
    durationSeconds: number;
    videoPath: string;
    voiceWavPath: string;
    imagePath: string;
    scriptPath: string;
    importZipPath: string;
    qcStatus: string;
    qcSummary: QCReport['summary'];
    mediaProbe: QCReport['mediaProbe'];
  }> = [];

  for (const spec of PARTS) {
    console.log(`\n--- Processing Part ${spec.partNumber}: ${spec.title} ---`);
    const srcImagePath = path.join(WORKSPACE_ROOT, 'src', 'assets', 'images', spec.imageFile);
    if (!fs.existsSync(srcImagePath)) {
      throw new Error(`Missing illustration asset: ${srcImagePath}`);
    }

    // 1. Measure exact Piper spoken duration per scene first so ZERO narration words are clipped!
    const tmpAudioDir = path.join('/tmp', `ff_measure_${spec.slug}`);
    fs.mkdirSync(tmpAudioDir, { recursive: true });
    let totalExactDuration = 0;
    const measuredSceneDurations: number[] = [];

    for (let sIdx = 0; sIdx < spec.scenes.length; sIdx++) {
      const sc = spec.scenes[sIdx];
      const probeWav = path.join(tmpAudioDir, `sc_${sIdx}.wav`);
      await runPiperToWav(piperBin, piperModel, sc.narration, probeWav, 1.03);
      const speechDur = await measureAudioDuration(probeWav);
      // Add clean 0.65s breathing room per scene
      const sceneDur = Number(Math.max(3.6, Math.ceil((speechDur + 0.65) * 2) / 2).toFixed(2));
      measuredSceneDurations.push(sceneDur);
      totalExactDuration += sceneDur;
      if (fs.existsSync(probeWav)) fs.unlinkSync(probeWav);
    }
    fs.rmSync(tmpAudioDir, { recursive: true, force: true });
    totalExactDuration = Number(totalExactDuration.toFixed(2));

    // 2. Build readable script file & save into test package
    const scriptText = spec.scenes
      .map(
        (sc, idx) =>
          `SCENE ${idx + 1}: ${sc.title} - ${sc.location}\n[MOTION: ${sc.motionCue}]\nNARRATOR: ${sc.narration}`
      )
      .join('\n\n');

    const partScriptFile = path.join(pkgRoot, 'scripts', `${spec.slug}_script.txt`);
    fs.writeFileSync(
      partScriptFile,
      `# ${spec.title}\n# Sub-Event: ${spec.subEvent}\n# Hook Question: ${spec.hookQuestion}\n\n${scriptText}\n`,
      'utf8'
    );
    fullScriptParts.push(
      `=== PART ${spec.partNumber}: ${spec.title.toUpperCase()} ===\nSub-Event: ${spec.subEvent}\n${scriptText}`
    );

    // Copy master image into test package images/
    const pkgImageFile = path.join(pkgRoot, 'images', `${spec.slug}.jpg`);
    fs.copyFileSync(srcImagePath, pkgImageFile);

    // 3. Setup Project Directory & Manifest
    const projectDir = getProjectDir(spec.projectId);
    const partChars = SHARED_CHARACTERS.filter((c) => spec.characters.includes(c.id)).map((c) => ({
      ...c,
      referenceImages: [pkgImageFile],
    }));

    const envCopy: Environment = {
      ...spec.environment,
      backgroundImage: path.join(projectDir, 'environments', `${spec.environment.id}.png`),
    };
    await createVariedShotPlate(srcImagePath, envCopy.backgroundImage!, 0);

    // Plan scenes cleanly matching exact measured Piper durations
    const plan = processScriptToPlan(
      scriptText,
      totalExactDuration,
      partChars,
      [envCopy],
      '3D cinematic Indian mythological epic illustration, divine lighting, ultra-detailed',
      'shorts_rapid'
    );

    // Override each scene & its shots proportionally to exact measured duration so narration never clips
    let cursor = 0;
    const rapidFxCycle = [
      'Fast zoom-in with golden embers and god rays',
      'Dynamic pan right with ground mist and diagonal slice transition',
      'Slow zoom-out with violet aura and flash white transition',
      'Slow zoom-in with glowing fire and wipe left transition',
    ];
    for (let i = 0; i < plan.scenes.length; i++) {
      const sc = plan.scenes[i];
      const exactDur = measuredSceneDurations[i];
      sc.startTime = Number(cursor.toFixed(2));
      sc.duration = exactDur;
      sc.endTime = Number((cursor + exactDur).toFixed(2));
      cursor = sc.endTime;

      const shotCount = sc.shots.length;
      let shotCursor = sc.startTime;
      for (let j = 0; j < shotCount; j++) {
        const sh = sc.shots[j];
        const isLast = j === shotCount - 1;
        const sDur = isLast
          ? Number(Math.max(1.5, sc.endTime - shotCursor).toFixed(2))
          : Number((exactDur / shotCount).toFixed(2));
        sh.startTime = Number(shotCursor.toFixed(2));
        sh.duration = sDur;
        sh.endTime = Number((shotCursor + sDur).toFixed(2));
        shotCursor = sh.endTime;

        if (j > 0) {
          sh.motionPrompt = rapidFxCycle[(i + j) % rapidFxCycle.length];
          sh.motionSpec = parseMotionInstruction(sh.motionPrompt);
        }

        // Create distinct high-res cropped storyboard PNG per micro-shot
        const shotImgPath = path.join(projectDir, 'storyboard', `${sh.id}.png`);
        await createVariedShotPlate(srcImagePath, shotImgPath, i * 2 + j);
        sh.imageAssetPath = shotImgPath;
      }
    }

    // Generate dramatic music bed for this part
    const musicBedPath = path.join(projectDir, 'audio', 'mythology_score.wav');
    await generateCinematicMusicBed(musicBedPath, totalExactDuration);

    const now = new Date().toISOString();
    let manifest: ProjectManifest = ProjectManifestSchema.parse({
      projectId: spec.projectId,
      name: spec.title,
      description: `${spec.subEvent} | Hook: ${spec.hookQuestion}`,
      topic: `Mahishasur Vadh — Part ${spec.partNumber}: ${spec.subEvent}`,
      script: scriptText,
      targetDurationSeconds: totalExactDuration,
      createdAt: now,
      updatedAt: now,
      stage: 'storyboard_approved',
      characters: partChars,
      environments: [envCopy],
      scenes: plan.scenes,
      voiceConfig: {
        language: 'en',
        voiceIdentity: 'piper-en-us-lessac',
        deliveryStyle: 'dramatic mythological storytelling',
        speakingSpeed: 1.03,
        emotionalTone: 'intense',
        pronunciationDict: {
          Mahishasura: 'Mah-hee-shah-soo-rah',
          Vadh: 'Vahd',
          Shakti: 'Shuck-tee',
          Trishul: 'Tree-shool',
          Tapasya: 'Tah-pah-syah',
          Swarga: 'Swar-gah',
          Devas: 'Day-vahs',
          Asura: 'Ah-soo-rah',
          Rambha: 'Rahm-bhah',
          Shyamala: 'Shyah-mah-lah',
          Indraloka: 'In-drah-lo-kah',
        },
      },
      audioConfig: {
        backgroundMusicPath: musicBedPath,
        musicVolume: 0.24,
        narrationVolume: 1.08,
        ambientVolume: 0.14,
        duckingEnabled: true,
        fadeInSeconds: 0.8,
        fadeOutSeconds: 1.2,
      },
      brandingConfig: {
        watermarkText: `MAHA KATHA · PART ${spec.partNumber}/8`,
        position: 'top_right',
        opacity: 0.86,
        color: '#FBBF24',
      },
      generationSettings: {
        imageProvider: 'imported',
        animationProvider: 'deterministic',
        visualStyle: '3D cinematic mythological epic',
        lowVramMode: true,
        maxVramMb: 4096,
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
          font: 'Liberation Sans',
          size: 28,
          color: '#FFFFFF',
          position: 'bottom',
          backgroundOpacity: 0.65,
          outlineWidth: 3,
          maxCharsPerLine: 22,
        },
      },
    });

    manifest = saveManifest(applyCharacterAndEnvironmentConsistency(manifest));

    // 4. Generate real Piper spoken narration
    const narRes = await generateProjectNarration(manifest);
    manifest = narRes.manifest;
    console.log(`  Narration: ${narRes.engineUsed}`);

    // Copy spoken voice files into test package voice/
    const pkgVoiceWav = path.join(pkgRoot, 'voice', `${spec.slug}_narration.wav`);
    const pkgVoiceMp3 = path.join(pkgRoot, 'voice', `${spec.slug}_narration.mp3`);
    fs.copyFileSync(narRes.narrationWavPath, pkgVoiceWav);
    fs.copyFileSync(narRes.narrationMp3Path, pkgVoiceMp3);

    // 5. Animate every shot cleanly
    for (const scene of manifest.scenes) {
      for (const shot of scene.shots) {
        const shotOut = path.join(projectDir, 'shots', `${shot.id}.mp4`);
        const animRes = await animateShot({
          imagePath: shot.imageAssetPath!,
          durationSeconds: shot.duration,
          fps: manifest.outputSettings.fps,
          width: 720,
          height: 1280,
          motionSpec: shot.motionSpec,
          outputPath: shotOut,
          method: 'deterministic',
          skipBlackFadeEdges: true,
        });
        if (!animRes.success) {
          throw new Error(`Animation failed for ${shot.id}: ${animRes.errorMessage}`);
        }
        shot.outputFile = animRes.outputFile;
        shot.animationModel = animRes.providerUsed;
        shot.status = 'completed';
        shot.approved = true;

        registerAsset({
          id: `img-${spec.projectId}-${shot.id}`,
          projectId: spec.projectId,
          assetType: 'storyboard_image',
          filePath: shot.imageAssetPath!,
          prompt: shot.positivePrompt,
          model: 'gemini-image-plate',
          seed: shot.seed,
          qualityStatus: 'ready',
        });
      }
      scene.status = 'completed';
    }

    // 6. Build & export subtitles + Mix Audio
    const subEntries = buildSubtitleEntries(manifest);
    const subFiles = exportSubtitlesToFiles(manifest, subEntries);
    manifest.subtitles = subEntries;
    manifest.exports = { ...manifest.exports, ...subFiles };

    const mixedAudio = await mixProjectAudio(manifest);
    manifest.audioConfig.mixedAudioPath = mixedAudio;

    // 7. Assemble final 9:16 Part MP4
    const assembled = await assembleProjectVideo(manifest);
    manifest = saveManifest(assembled.manifest);

    // 8. Run QC & create project ZIP
    const qc = await runQualityControl(manifest);
    const archiveZip = await createProjectArchiveZip(manifest.projectId);
    manifest.exports.archiveZip = archiveZip;
    manifest.stage = qc.overallStatus === 'fail' ? 'assembled' : 'exported';
    manifest = saveManifest(manifest);

    // Copy rendered MP4, manifest, and importable ZIP into the test package
    const pkgVideo = path.join(pkgRoot, 'videos', `${spec.slug}.mp4`);
    fs.copyFileSync(assembled.landscapeMp4, pkgVideo);
    fs.writeFileSync(
      path.join(pkgRoot, 'manifests', `${spec.slug}_manifest.json`),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );

    // Build a clean importable input-only ZIP (script + storyboard images + pre-rendered Piper voice + manifest)
    const importZipPath = path.join(pkgRoot, 'packages', `${spec.slug}_importable.zip`);
    const importZip = new AdmZip();
    const portableManifest = ProjectManifestSchema.parse({
      ...manifest,
      stage: 'storyboard_approved',
      voiceConfig: {
        ...manifest.voiceConfig,
        voiceIdentity: 'imported',
        generatedNarrationPath: 'audio/narration_master.wav',
      },
      audioConfig: {
        ...manifest.audioConfig,
        backgroundMusicPath: 'audio/mythology_score.wav',
        mixedAudioPath: undefined,
      },
      exports: {},
      scenes: manifest.scenes.map((sc) => ({
        ...sc,
        outputFile: undefined,
        status: 'pending',
        shots: sc.shots.map((sh) => ({
          ...sh,
          referenceImages: [],
          imageAssetPath: `storyboard/${sh.id}.png`,
          narrationAudioPath: `audio/${sc.id}_narration.wav`,
          outputFile: undefined,
          status: 'pending',
        })),
      })),
    });
    importZip.addFile('manifest.json', Buffer.from(JSON.stringify(portableManifest, null, 2), 'utf8'));
    importZip.addLocalFile(partScriptFile, 'inputs');
    importZip.addLocalFile(narRes.narrationWavPath, 'audio');
    importZip.addLocalFile(musicBedPath, 'audio');
    for (const sc of manifest.scenes) {
      const scWav = path.join(projectDir, 'audio', `${sc.id}_narration.wav`);
      if (fs.existsSync(scWav)) importZip.addLocalFile(scWav, 'audio');
      for (const sh of sc.shots) {
        if (sh.imageAssetPath && fs.existsSync(sh.imageAssetPath)) {
          importZip.addLocalFile(sh.imageAssetPath, 'storyboard');
        }
      }
    }
    importZip.writeZip(importZipPath);

    console.log(
      `  Rendered ${spec.slug}.mp4 (${qc.mediaProbe?.durationSeconds}s, ${qc.mediaProbe?.width}x${qc.mediaProbe?.height}, QC=${qc.overallStatus.toUpperCase()})`
    );

    partResults.push({
      partNumber: spec.partNumber,
      projectId: spec.projectId,
      title: spec.title,
      subEvent: spec.subEvent,
      hookQuestion: spec.hookQuestion,
      durationSeconds: qc.mediaProbe?.durationSeconds || totalExactDuration,
      videoPath: pkgVideo,
      voiceWavPath: pkgVoiceWav,
      imagePath: pkgImageFile,
      scriptPath: partScriptFile,
      importZipPath,
      qcStatus: qc.overallStatus,
      qcSummary: qc.summary,
      mediaProbe: qc.mediaProbe,
    });
  }

  // 9. Write full combined script
  const fullScriptPath = path.join(pkgRoot, 'scripts', 'full_event_mahishasur_vadh_script.txt');
  fs.writeFileSync(fullScriptPath, fullScriptParts.join('\n\n\n'), 'utf8');

  // 10. Combine all 8 part MP4s into ONE Complete Whole-Event MP4 (Video #9 <= 10 max)
  console.log('\n--- Assembling Complete Whole-Event Video (All 8 Parts Combined) ---');
  const fullEventProjId = 'mahishasur-vadh-complete-event';
  const fullEventDir = getProjectDir(fullEventProjId);
  const fullEventMp4 = path.join(fullEventDir, 'exports', `${fullEventProjId}_final_9x16.mp4`);
  const pkgFullVideo = path.join(pkgRoot, 'videos', 'mahishasur_vadh_complete_event_8parts.mp4');

  const concatList = path.join(fullEventDir, 'exports', 'parts_concat.txt');
  fs.writeFileSync(
    concatList,
    partResults.map((p) => `file '${p.videoPath.replace(/'/g, "'\\''")}'`).join('\n'),
    'utf8'
  );

  // Re-encode seamlessly at boundaries so PTS, audio timestamps, and AAC frames never glitch
  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatList,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '21',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-ar',
      '44100',
      '-ac',
      '2',
      '-movflags',
      '+faststart',
      fullEventMp4,
    ],
    { timeout: 180000 }
  );
  fs.copyFileSync(fullEventMp4, pkgFullVideo);

  // Save full-event project record in SQLite so it appears cleanly in Workspace + Preview + Export
  const { stdout: fullProbeJson } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration,size:stream=codec_type,width,height,r_frame_rate',
    '-of',
    'json',
    fullEventMp4,
  ]);
  const fullProbeParsed = JSON.parse(fullProbeJson);
  const totalCombinedDuration = Number(Number(fullProbeParsed.format?.duration || 0).toFixed(2));
  const fullCombinedSize = Number(fullProbeParsed.format?.size || 0);

  // Combine narration WAV + subtitles for complete event project
  const fullNarConcat = path.join(fullEventDir, 'audio', 'full_nar_concat.txt');
  fs.writeFileSync(
    fullNarConcat,
    partResults.map((p) => `file '${p.voiceWavPath.replace(/'/g, "'\\''")}'`).join('\n'),
    'utf8'
  );
  const fullNarWav = path.join(fullEventDir, 'audio', 'narration_master.wav');
  await execFileAsync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', fullNarConcat, '-c', 'copy', fullNarWav]);

  const fullNow = new Date().toISOString();
  let eventCursor = 0;
  const fullManifest = ProjectManifestSchema.parse({
    projectId: fullEventProjId,
    name: 'Mahishasur Vadh — Complete Event (8 Parts)',
    description:
      'Complete 8-part mythological anthology from cursed birth and Brahma boon loophole to Mahishasura Vadh.',
    topic: 'Mahishasur Vadh Complete Event',
    script: fullScriptParts.join('\n\n'),
    targetDurationSeconds: totalCombinedDuration,
    createdAt: fullNow,
    updatedAt: fullNow,
    stage: 'exported',
    characters: SHARED_CHARACTERS,
    environments: PARTS.map((p) => p.environment),
    scenes: partResults.map((p) => {
      const start = Number(eventCursor.toFixed(2));
      const end = Number((eventCursor + p.durationSeconds).toFixed(2));
      eventCursor = end;
      return {
        id: `part-${p.partNumber}`,
        sceneNumber: p.partNumber,
        title: p.title,
        summary: p.subEvent,
        environmentId: PARTS[p.partNumber - 1].environment.id,
        narrationText: PARTS[p.partNumber - 1].scenes.map((s) => s.narration).join(' '),
        startTime: start,
        endTime: end,
        duration: p.durationSeconds,
        outputFile: p.videoPath,
        status: 'completed',
        shots: [
          {
            id: `part-${p.partNumber}-master`,
            sceneId: `part-${p.partNumber}`,
            shotNumber: 1,
            startTime: start,
            endTime: end,
            duration: p.durationSeconds,
            imageAssetPath: p.imagePath,
            outputFile: p.videoPath,
            motionPrompt: 'Complete rendered episode chapter',
            narrationSegment: PARTS[p.partNumber - 1].scenes.map((s) => s.narration).join(' '),
            subtitleSegment: PARTS[p.partNumber - 1].scenes.map((s) => s.narration).join(' '),
            status: 'completed',
            approved: true,
            seed: 1080 + p.partNumber,
          },
        ],
      };
    }),
    voiceConfig: {
      language: 'en',
      voiceIdentity: 'piper-en-us-lessac',
      generatedNarrationPath: fullNarWav,
    },
    audioConfig: {
      mixedAudioPath: fullNarWav,
    },
    brandingConfig: {
      watermarkText: 'MAHA KATHA · COMPLETE EVENT',
      position: 'top_right',
      opacity: 0.86,
      color: '#FBBF24',
    },
    generationSettings: {
      imageProvider: 'imported',
      animationProvider: 'deterministic',
      visualStyle: '3D cinematic mythological epic',
    },
    outputSettings: {
      resolution: '720p',
      aspectRatio: '9:16',
      fps: 25,
      pacingMode: 'shorts_rapid',
      exportVerticalAlso: false,
      exportSquareAlso: false,
      burnSubtitles: true,
    },
    exports: {
      landscapeMp4: fullEventMp4,
      verticalMp4: fullEventMp4,
    },
  });
  const fullSubEntries = buildSubtitleEntries(fullManifest);
  const fullSubFiles = exportSubtitlesToFiles(fullManifest, fullSubEntries);
  fullManifest.subtitles = fullSubEntries;
  fullManifest.exports = { ...fullManifest.exports, ...fullSubFiles };
  saveManifest(fullManifest);
  await runQualityControl(fullManifest);
  const fullArchiveZip = await createProjectArchiveZip(fullEventProjId);
  fullManifest.exports.archiveZip = fullArchiveZip;
  saveManifest(fullManifest);

  // 11. README & Master Test Package ZIP
  const readmeContent = `# Mahishasur Vadh — Complete 8-Part Video Production Test Package

Generated inside FrameForge Studio using:
- **8 High-Detail 9:16 Mythological Plates** (\`images/\`)
- **8 Spoken Narration Tracks via Piper TTS \`en_US-lessac-medium\`** (\`voice/\`)
- **8 Question-Hook Part Scripts + Full Master Script** (\`scripts/\`)
- **8 Self-Contained Importable Project ZIPs** (\`packages/\` — upload directly in FrameForge Wizard)
- **8 Rendered Part Videos + 1 Complete Stitched Event Video = 9 Videos Total (<= 10 max)** (\`videos/\`)

## Chronological Part Breakdown
${partResults
  .map(
    (p) =>
      `${p.partNumber}. **${p.title}** (${p.durationSeconds}s)
   - Sub-Event: ${p.subEvent}
   - Opening Hook: "${p.hookQuestion}"
   - QC Status: ${p.qcStatus.toUpperCase()} (${p.qcSummary.passed} passed, ${p.qcSummary.warnings} warnings)`
  )
  .join('\n')}

9. **Complete Event Video (All 8 Parts Combined)**: \`videos/mahishasur_vadh_complete_event_8parts.mp4\` (${totalCombinedDuration}s, ${(fullCombinedSize / (1024 * 1024)).toFixed(2)} MB)
`;
  fs.writeFileSync(path.join(pkgRoot, 'README.md'), readmeContent, 'utf8');

  const testReport = {
    event: 'Mahishasur Vadh',
    generatedAt: new Date().toISOString(),
    totalVideosGenerated: partResults.length + 1,
    maxVideosLimit: 10,
    withinLimit: partResults.length + 1 <= 10,
    ttsEngine: `piper-tts (${path.basename(piperModel)})`,
    parts: partResults,
    completeEventVideo: {
      projectId: fullEventProjId,
      filePath: pkgFullVideo,
      durationSeconds: totalCombinedDuration,
      fileSizeBytes: fullCombinedSize,
      dimensions: '720x1280',
      fps: 25,
    },
  };
  fs.writeFileSync(path.join(pkgRoot, 'test_report.json'), JSON.stringify(testReport, null, 2), 'utf8');

  const masterZipPath = path.join(pkgRoot, 'mahishasur_vadh_full_test_package.zip');
  const masterZip = new AdmZip();
  for (const folder of ['scripts', 'images', 'voice', 'packages', 'videos', 'manifests']) {
    masterZip.addLocalFolder(path.join(pkgRoot, folder), folder);
  }
  masterZip.addLocalFile(path.join(pkgRoot, 'README.md'));
  masterZip.addLocalFile(path.join(pkgRoot, 'test_report.json'));
  masterZip.writeZip(masterZipPath);

  console.log('\n=== TEST PACKAGE BUILD COMPLETE ===');
  console.log(`Total videos generated: ${partResults.length + 1} (limit: 10)`);
  console.log(`Master Package ZIP: ${masterZipPath}`);
  console.log(`Complete Event Video: ${pkgFullVideo} (${totalCombinedDuration}s)`);
}

main().catch((err) => {
  console.error('Test package build failed:', err);
  process.exit(1);
});
