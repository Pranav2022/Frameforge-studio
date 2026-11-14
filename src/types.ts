export type AspectRatio = '16:9' | '9:16' | '1:1';
export type Resolution = '720p' | '1080p';
export type JobStatus =
  | 'pending'
  | 'validating'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'waiting_approval';

export type VisualEffect =
  | 'none'
  | 'fire'
  | 'smoke'
  | 'lightning'
  | 'light_rays'
  | 'glow'
  | 'particles'
  | 'golden_embers'
  | 'god_rays'
  | 'violet_aura'
  | 'ground_mist';

export type TransitionType =
  | 'cut'
  | 'fade'
  | 'dissolve'
  | 'flash_white'
  | 'flash_violet'
  | 'diagonal_slice'
  | 'wipe_left'
  | 'slide_up'
  | 'circle_open';

export interface MotionSpec {
  rawInstruction: string;
  camera:
    | 'static'
    | 'zoom_in'
    | 'zoom_out'
    | 'pan_left'
    | 'pan_right'
    | 'tilt_up'
    | 'tilt_down'
    | 'parallax'
    | 'shake';
  cameraSpeed: 'slow' | 'medium' | 'fast';
  subjectMotion: 'none' | 'minimal' | 'moderate' | 'dynamic';
  cameraShake: boolean;
  parallaxDepth: number;
  weather: 'none' | 'rain' | 'snow' | 'fog' | 'storm';
  effects: VisualEffect[];
  transitionIn: TransitionType;
  transitionOut: TransitionType;
  motionBlur: boolean;
  preserveCharacterIdentity: boolean;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  appearance: string;
  faceDetails: string;
  bodyProportions: string;
  clothing: string;
  accessories: string;
  colorPalette: string[];
  voiceIdentity: string;
  referenceImages: string[];
  negativePrompt: string;
  styleInfo: string;
  fixedSeed?: number;
}

export interface Environment {
  id: string;
  name: string;
  description: string;
  backgroundImage?: string;
  foregroundLayer?: string;
  lighting: string;
  weatherDefault: 'none' | 'rain' | 'snow' | 'fog' | 'storm';
  colorPalette: string[];
  ambientAudio?: string;
}

export interface Shot {
  id: string;
  sceneId: string;
  shotNumber: number;
  startTime: number;
  endTime: number;
  duration: number;
  charactersPresent: string[];
  environmentId: string;
  referenceImages: string[];
  imageAssetPath?: string;
  importedClipPath?: string;
  positivePrompt: string;
  negativePrompt: string;
  motionPrompt: string;
  motionSpec: MotionSpec;
  animationModel: string;
  generationMethod: 'deterministic' | 'generative_i2v' | 'generative_t2v' | 'hybrid';
  narrationSegment: string;
  narrationAudioPath?: string;
  soundEffects: string[];
  subtitleSegment: string;
  outputFile?: string;
  status: JobStatus;
  approved: boolean;
  seed: number;
  error?: string;
}

export interface Scene {
  id: string;
  sceneNumber: number;
  title: string;
  summary: string;
  environmentId: string;
  narrationText: string;
  dialogueLines: Array<{ speaker: string; text: string }>;
  startTime: number;
  endTime: number;
  duration: number;
  ambientAudioPath?: string;
  sfxPaths: string[];
  outputFile?: string;
  status: JobStatus;
  shots: Shot[];
}

export interface SubtitleEntry {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
  language: string;
  translatedText?: string;
}

export interface ProjectManifest {
  manifestVersion: string;
  projectId: string;
  name: string;
  description: string;
  topic: string;
  script: string;
  targetDurationSeconds: number;
  createdAt: string;
  updatedAt: string;
  stage: string;
  characters: Character[];
  environments: Environment[];
  scenes: Scene[];
  subtitles: SubtitleEntry[];
  voiceConfig: {
    language: string;
    voiceIdentity: string;
    voiceSamplePath?: string;
    consentVerified: boolean;
    consentStatement: string;
    deliveryStyle: string;
    speakingSpeed: number;
    emotionalTone: string;
    pronunciationDict: Record<string, string>;
    generatedNarrationPath?: string;
  };
  audioConfig: {
    backgroundMusicPath?: string;
    musicVolume: number;
    narrationVolume: number;
    ambientVolume: number;
    sfxVolume: number;
    duckingEnabled: boolean;
    fadeInSeconds: number;
    fadeOutSeconds: number;
    mixedAudioPath?: string;
  };
  brandingConfig?: {
    watermarkText: string;
    watermarkImagePath?: string;
    position: 'bottom_right' | 'bottom_left' | 'top_right' | 'top_left';
    opacity: number;
    color: string;
  };
  generationSettings: {
    imageProvider: 'procedural' | 'comfyui' | 'diffusers' | 'imported';
    animationProvider: 'deterministic' | 'comfyui_animatediff' | 'hybrid';
    lowVramMode: boolean;
    maxVramMb: number;
    visualStyle: string;
    defaultSeed: number;
  };
  outputSettings: {
    resolution: Resolution;
    aspectRatio: AspectRatio;
    fps: 24 | 25 | 30;
    pacingMode: 'standard' | 'shorts_rapid';
    exportVerticalAlso: boolean;
    exportSquareAlso: boolean;
    burnSubtitles: boolean;
    subtitleLanguage: string;
    secondarySubtitleLanguage?: string;
    subtitleStyle: {
      font: string;
      size: number;
      color: string;
      position: 'bottom' | 'top' | 'center';
      backgroundOpacity: number;
      outlineWidth: number;
      maxCharsPerLine: number;
    };
  };
  exports: {
    landscapeMp4?: string;
    verticalMp4?: string;
    squareMp4?: string;
    srtPath?: string;
    vttPath?: string;
    assPath?: string;
    archiveZip?: string;
  };
}

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

export interface QCReport {
  projectId: string;
  generatedAt: string;
  overallStatus: 'pass' | 'warn' | 'fail';
  summary: { passed: number; warnings: number; failed: number };
  checks: Array<{
    category: 'visual' | 'audio' | 'subtitle' | 'project';
    name: string;
    status: 'pass' | 'warn' | 'fail';
    details: string;
    target?: string;
  }>;
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
