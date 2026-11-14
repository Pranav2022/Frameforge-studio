import { z } from 'zod';

export const MANIFEST_VERSION = '1.0.0';

export const AspectRatioSchema = z.enum(['16:9', '9:16', '1:1']);
export type AspectRatio = z.infer<typeof AspectRatioSchema>;

export const ResolutionSchema = z.enum(['720p', '1080p']);
export type Resolution = z.infer<typeof ResolutionSchema>;

export const JobStatusSchema = z.enum([
  'pending',
  'validating',
  'running',
  'completed',
  'failed',
  'cancelled',
  'waiting_approval',
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const AnimationMethodSchema = z.enum([
  'deterministic',
  'generative_i2v',
  'generative_t2v',
  'hybrid',
]);
export type AnimationMethod = z.infer<typeof AnimationMethodSchema>;

export const CameraMotionSchema = z.enum([
  'static',
  'zoom_in',
  'zoom_out',
  'pan_left',
  'pan_right',
  'tilt_up',
  'tilt_down',
  'parallax',
  'shake',
]);
export type CameraMotion = z.infer<typeof CameraMotionSchema>;

export const WeatherEffectSchema = z.enum(['none', 'rain', 'snow', 'fog', 'storm']);
export type WeatherEffect = z.infer<typeof WeatherEffectSchema>;

export const VisualEffectSchema = z.enum([
  'none',
  'fire',
  'smoke',
  'lightning',
  'light_rays',
  'glow',
  'particles',
  'golden_embers',
  'god_rays',
  'violet_aura',
  'ground_mist',
]);
export type VisualEffect = z.infer<typeof VisualEffectSchema>;

export const TransitionTypeSchema = z.enum([
  'cut',
  'fade',
  'dissolve',
  'flash_white',
  'flash_violet',
  'diagonal_slice',
  'wipe_left',
  'slide_up',
  'circle_open',
]);
export type TransitionType = z.infer<typeof TransitionTypeSchema>;

export const MotionSpecSchema = z.object({
  rawInstruction: z.string().default(''),
  camera: CameraMotionSchema.default('zoom_in'),
  cameraSpeed: z.enum(['slow', 'medium', 'fast']).default('slow'),
  subjectMotion: z.enum(['none', 'minimal', 'moderate', 'dynamic']).default('minimal'),
  cameraShake: z.boolean().default(false),
  parallaxDepth: z.number().min(0).max(1).default(0.25),
  weather: WeatherEffectSchema.default('none'),
  effects: z.array(VisualEffectSchema).default([]),
  transitionIn: TransitionTypeSchema.default('fade'),
  transitionOut: TransitionTypeSchema.default('dissolve'),
  motionBlur: z.boolean().default(false),
  preserveCharacterIdentity: z.boolean().default(true),
});
export type MotionSpec = z.infer<typeof MotionSpecSchema>;

export const CharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  appearance: z.string().default(''),
  faceDetails: z.string().default(''),
  bodyProportions: z.string().default(''),
  clothing: z.string().default(''),
  accessories: z.string().default(''),
  colorPalette: z.array(z.string()).default([]),
  voiceIdentity: z.string().default('default'),
  referenceImages: z.array(z.string()).default([]),
  negativePrompt: z.string().default('blurry, deformed, watermark, text, extra limbs'),
  styleInfo: z.string().default(''),
  fixedSeed: z.number().int().optional(),
});
export type Character = z.infer<typeof CharacterSchema>;

export const EnvironmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  backgroundImage: z.string().optional(),
  foregroundLayer: z.string().optional(),
  lighting: z.string().default('dramatic cinematic lighting'),
  weatherDefault: WeatherEffectSchema.default('none'),
  colorPalette: z.array(z.string()).default([]),
  ambientAudio: z.string().optional(),
});
export type Environment = z.infer<typeof EnvironmentSchema>;

export const ShotSchema = z.object({
  id: z.string().min(1),
  sceneId: z.string().min(1),
  shotNumber: z.number().int().positive(),
  startTime: z.number().min(0),
  endTime: z.number().positive(),
  duration: z.number().positive(),
  charactersPresent: z.array(z.string()).default([]),
  environmentId: z.string().default(''),
  referenceImages: z.array(z.string()).default([]),
  imageAssetPath: z.string().optional(),
  importedClipPath: z.string().optional(),
  positivePrompt: z.string().default(''),
  negativePrompt: z.string().default('low quality, blurry, watermark'),
  motionPrompt: z.string().default('Slow cinematic camera push-in'),
  motionSpec: MotionSpecSchema.default(() => MotionSpecSchema.parse({})),
  animationModel: z.string().default('ffmpeg-deterministic-v1'),
  generationMethod: AnimationMethodSchema.default('deterministic'),
  narrationSegment: z.string().default(''),
  narrationAudioPath: z.string().optional(),
  soundEffects: z.array(z.string()).default([]),
  subtitleSegment: z.string().default(''),
  outputFile: z.string().optional(),
  status: JobStatusSchema.default('pending'),
  approved: z.boolean().default(false),
  seed: z.number().int().default(42),
  error: z.string().optional(),
});
export type Shot = z.infer<typeof ShotSchema>;

export const SceneSchema = z.object({
  id: z.string().min(1),
  sceneNumber: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().default(''),
  environmentId: z.string().default(''),
  narrationText: z.string().default(''),
  dialogueLines: z.array(
    z.object({
      speaker: z.string(),
      text: z.string(),
    })
  ).default([]),
  startTime: z.number().min(0),
  endTime: z.number().min(0),
  duration: z.number().positive(),
  ambientAudioPath: z.string().optional(),
  sfxPaths: z.array(z.string()).default([]),
  outputFile: z.string().optional(),
  status: JobStatusSchema.default('pending'),
  shots: z.array(ShotSchema).default([]),
});
export type Scene = z.infer<typeof SceneSchema>;

export const SubtitleStyleSchema = z.object({
  font: z.string().default('Arial'),
  size: z.number().int().min(12).max(72).default(24),
  color: z.string().default('#FFFFFF'),
  position: z.enum(['bottom', 'top', 'center']).default('bottom'),
  backgroundOpacity: z.number().min(0).max(1).default(0.55),
  outlineWidth: z.number().min(0).max(6).default(2),
  maxCharsPerLine: z.number().int().min(16).max(80).default(44),
});
export type SubtitleStyle = z.infer<typeof SubtitleStyleSchema>;

export const BrandingConfigSchema = z.object({
  watermarkText: z.string().default(''),
  watermarkImagePath: z.string().optional(),
  position: z.enum(['bottom_right', 'bottom_left', 'top_right', 'top_left']).default('bottom_right'),
  opacity: z.number().min(0.1).max(1).default(0.82),
  color: z.string().default('#F59E0B'),
});
export type BrandingConfig = z.infer<typeof BrandingConfigSchema>;

export const VoiceConfigSchema = z.object({
  language: z.string().default('en'),
  voiceIdentity: z.string().default('piper-default'),
  voiceSamplePath: z.string().optional(),
  consentVerified: z.boolean().default(false),
  consentStatement: z.string().default(''),
  deliveryStyle: z.string().default('narrative'),
  speakingSpeed: z.number().min(0.6).max(1.5).default(1.0),
  emotionalTone: z.string().default('steady'),
  pronunciationDict: z.record(z.string(), z.string()).default({}),
  generatedNarrationPath: z.string().optional(),
});
export type VoiceConfig = z.infer<typeof VoiceConfigSchema>;

export const AudioDesignConfigSchema = z.object({
  backgroundMusicPath: z.string().optional(),
  musicVolume: z.number().min(0).max(1).default(0.22),
  narrationVolume: z.number().min(0).max(1.5).default(1.0),
  ambientVolume: z.number().min(0).max(1).default(0.18),
  sfxVolume: z.number().min(0).max(1).default(0.45),
  duckingEnabled: z.boolean().default(true),
  fadeInSeconds: z.number().min(0).max(10).default(1.5),
  fadeOutSeconds: z.number().min(0).max(10).default(2.0),
  mixedAudioPath: z.string().optional(),
});
export type AudioDesignConfig = z.infer<typeof AudioDesignConfigSchema>;

export const OutputSettingsSchema = z.object({
  resolution: ResolutionSchema.default('720p'),
  aspectRatio: AspectRatioSchema.default('16:9'),
  fps: z.union([z.literal(24), z.literal(25), z.literal(30)]).default(24),
  pacingMode: z.enum(['standard', 'shorts_rapid']).default('standard'),
  exportVerticalAlso: z.boolean().default(true),
  exportSquareAlso: z.boolean().default(false),
  burnSubtitles: z.boolean().default(false),
  subtitleLanguage: z.string().default('en'),
  secondarySubtitleLanguage: z.string().optional(),
  subtitleStyle: SubtitleStyleSchema.default(() => SubtitleStyleSchema.parse({})),
});
export type OutputSettings = z.infer<typeof OutputSettingsSchema>;

export const GenerationSettingsSchema = z.object({
  imageProvider: z.enum(['procedural', 'comfyui', 'diffusers', 'imported']).default('procedural'),
  animationProvider: z.enum(['deterministic', 'comfyui_animatediff', 'hybrid']).default('deterministic'),
  lowVramMode: z.boolean().default(true),
  maxVramMb: z.number().int().default(4096),
  visualStyle: z.string().default('cinematic painterly illustration'),
  defaultSeed: z.number().int().default(1024),
});
export type GenerationSettings = z.infer<typeof GenerationSettingsSchema>;

export const SubtitleEntrySchema = z.object({
  index: z.number().int().positive(),
  startTime: z.number().min(0),
  endTime: z.number().positive(),
  text: z.string(),
  language: z.string().default('en'),
  translatedText: z.string().optional(),
});
export type SubtitleEntry = z.infer<typeof SubtitleEntrySchema>;

export const ProjectManifestSchema = z.object({
  manifestVersion: z.string().default(MANIFEST_VERSION),
  projectId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  topic: z.string().default(''),
  script: z.string().default(''),
  targetDurationSeconds: z.number().min(5).max(7200).default(120),
  createdAt: z.string(),
  updatedAt: z.string(),
  stage: z
    .enum([
      'created',
      'validated',
      'script_processed',
      'storyboard_ready',
      'storyboard_approved',
      'assets_generated',
      'animation_generated',
      'audio_generated',
      'assembled',
      'qc_passed',
      'exported',
    ])
    .default('created'),
  characters: z.array(CharacterSchema).default([]),
  environments: z.array(EnvironmentSchema).default([]),
  scenes: z.array(SceneSchema).default([]),
  subtitles: z.array(SubtitleEntrySchema).default([]),
  voiceConfig: VoiceConfigSchema.default(() => VoiceConfigSchema.parse({})),
  audioConfig: AudioDesignConfigSchema.default(() => AudioDesignConfigSchema.parse({})),
  brandingConfig: BrandingConfigSchema.default(() => BrandingConfigSchema.parse({})),
  generationSettings: GenerationSettingsSchema.default(() => GenerationSettingsSchema.parse({})),
  outputSettings: OutputSettingsSchema.default(() => OutputSettingsSchema.parse({})),
  exports: z
    .object({
      landscapeMp4: z.string().optional(),
      verticalMp4: z.string().optional(),
      squareMp4: z.string().optional(),
      srtPath: z.string().optional(),
      vttPath: z.string().optional(),
      assPath: z.string().optional(),
      archiveZip: z.string().optional(),
    })
    .default({}),
  errors: z
    .array(
      z.object({
        stage: z.string(),
        message: z.string(),
        timestamp: z.string(),
      })
    )
    .default([]),
});
export type ProjectManifest = z.infer<typeof ProjectManifestSchema>;

export interface JobRecord {
  id: string;
  projectId: string;
  sceneId: string | null;
  shotId: string | null;
  jobType: string;
  priority: number;
  status: JobStatus;
  progress: number;
  message: string;
  retryCount: number;
  maxRetries: number;
  errorMessage: string | null;
  outputFile: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface QCCheckItem {
  category: 'visual' | 'audio' | 'subtitle' | 'project';
  name: string;
  status: 'pass' | 'warn' | 'fail';
  details: string;
  target?: string;
}

export interface QCReport {
  projectId: string;
  generatedAt: string;
  overallStatus: 'pass' | 'warn' | 'fail';
  summary: {
    passed: number;
    warnings: number;
    failed: number;
  };
  checks: QCCheckItem[];
  mediaProbe?: {
    durationSeconds: number;
    width: number;
    height: number;
    fps: number;
    hasVideo: boolean;
    hasAudio: boolean;
    fileSizeBytes: number;
  };
}
