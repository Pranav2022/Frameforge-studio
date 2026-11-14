// server.ts
import { createRequire as createRequire2 } from "node:module";
import crypto5 from "node:crypto";
import dotenv from "dotenv";
import express from "express";
import fs13 from "node:fs";
import multer from "multer";
import path12 from "node:path";
import { createServer as createViteServer } from "vite";

// server/db/database.ts
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// server/types/manifest.ts
import { z } from "zod";
var MANIFEST_VERSION = "1.0.0";
var AspectRatioSchema = z.enum(["16:9", "9:16", "1:1"]);
var ResolutionSchema = z.enum(["720p", "1080p"]);
var JobStatusSchema = z.enum([
  "pending",
  "validating",
  "running",
  "completed",
  "failed",
  "cancelled",
  "waiting_approval"
]);
var AnimationMethodSchema = z.enum([
  "deterministic",
  "generative_i2v",
  "generative_t2v",
  "hybrid"
]);
var CameraMotionSchema = z.enum([
  "static",
  "zoom_in",
  "zoom_out",
  "pan_left",
  "pan_right",
  "tilt_up",
  "tilt_down",
  "parallax",
  "shake"
]);
var WeatherEffectSchema = z.enum(["none", "rain", "snow", "fog", "storm"]);
var VisualEffectSchema = z.enum([
  "none",
  "fire",
  "smoke",
  "lightning",
  "light_rays",
  "glow",
  "particles"
]);
var TransitionTypeSchema = z.enum(["cut", "fade", "dissolve"]);
var MotionSpecSchema = z.object({
  rawInstruction: z.string().default(""),
  camera: CameraMotionSchema.default("zoom_in"),
  cameraSpeed: z.enum(["slow", "medium", "fast"]).default("slow"),
  subjectMotion: z.enum(["none", "minimal", "moderate", "dynamic"]).default("minimal"),
  cameraShake: z.boolean().default(false),
  parallaxDepth: z.number().min(0).max(1).default(0.25),
  weather: WeatherEffectSchema.default("none"),
  effects: z.array(VisualEffectSchema).default([]),
  transitionIn: TransitionTypeSchema.default("fade"),
  transitionOut: TransitionTypeSchema.default("dissolve"),
  motionBlur: z.boolean().default(false),
  preserveCharacterIdentity: z.boolean().default(true)
});
var CharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  appearance: z.string().default(""),
  faceDetails: z.string().default(""),
  bodyProportions: z.string().default(""),
  clothing: z.string().default(""),
  accessories: z.string().default(""),
  colorPalette: z.array(z.string()).default([]),
  voiceIdentity: z.string().default("default"),
  referenceImages: z.array(z.string()).default([]),
  negativePrompt: z.string().default("blurry, deformed, watermark, text, extra limbs"),
  styleInfo: z.string().default(""),
  fixedSeed: z.number().int().optional()
});
var EnvironmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  backgroundImage: z.string().optional(),
  foregroundLayer: z.string().optional(),
  lighting: z.string().default("dramatic cinematic lighting"),
  weatherDefault: WeatherEffectSchema.default("none"),
  colorPalette: z.array(z.string()).default([]),
  ambientAudio: z.string().optional()
});
var ShotSchema = z.object({
  id: z.string().min(1),
  sceneId: z.string().min(1),
  shotNumber: z.number().int().positive(),
  startTime: z.number().min(0),
  endTime: z.number().positive(),
  duration: z.number().positive(),
  charactersPresent: z.array(z.string()).default([]),
  environmentId: z.string().default(""),
  referenceImages: z.array(z.string()).default([]),
  imageAssetPath: z.string().optional(),
  positivePrompt: z.string().default(""),
  negativePrompt: z.string().default("low quality, blurry, watermark"),
  motionPrompt: z.string().default("Slow cinematic camera push-in"),
  motionSpec: MotionSpecSchema.default(() => MotionSpecSchema.parse({})),
  animationModel: z.string().default("ffmpeg-deterministic-v1"),
  generationMethod: AnimationMethodSchema.default("deterministic"),
  narrationSegment: z.string().default(""),
  narrationAudioPath: z.string().optional(),
  soundEffects: z.array(z.string()).default([]),
  subtitleSegment: z.string().default(""),
  outputFile: z.string().optional(),
  status: JobStatusSchema.default("pending"),
  approved: z.boolean().default(false),
  seed: z.number().int().default(42),
  error: z.string().optional()
});
var SceneSchema = z.object({
  id: z.string().min(1),
  sceneNumber: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().default(""),
  environmentId: z.string().default(""),
  narrationText: z.string().default(""),
  dialogueLines: z.array(
    z.object({
      speaker: z.string(),
      text: z.string()
    })
  ).default([]),
  startTime: z.number().min(0),
  endTime: z.number().min(0),
  duration: z.number().positive(),
  ambientAudioPath: z.string().optional(),
  sfxPaths: z.array(z.string()).default([]),
  outputFile: z.string().optional(),
  status: JobStatusSchema.default("pending"),
  shots: z.array(ShotSchema).default([])
});
var SubtitleStyleSchema = z.object({
  font: z.string().default("Arial"),
  size: z.number().int().min(12).max(72).default(24),
  color: z.string().default("#FFFFFF"),
  position: z.enum(["bottom", "top", "center"]).default("bottom"),
  backgroundOpacity: z.number().min(0).max(1).default(0.55),
  outlineWidth: z.number().min(0).max(6).default(2),
  maxCharsPerLine: z.number().int().min(20).max(80).default(44)
});
var VoiceConfigSchema = z.object({
  language: z.string().default("en"),
  voiceIdentity: z.string().default("piper-default"),
  voiceSamplePath: z.string().optional(),
  consentVerified: z.boolean().default(false),
  consentStatement: z.string().default(""),
  deliveryStyle: z.string().default("narrative"),
  speakingSpeed: z.number().min(0.6).max(1.5).default(1),
  emotionalTone: z.string().default("steady"),
  pronunciationDict: z.record(z.string(), z.string()).default({}),
  generatedNarrationPath: z.string().optional()
});
var AudioDesignConfigSchema = z.object({
  backgroundMusicPath: z.string().optional(),
  musicVolume: z.number().min(0).max(1).default(0.22),
  narrationVolume: z.number().min(0).max(1.5).default(1),
  ambientVolume: z.number().min(0).max(1).default(0.18),
  sfxVolume: z.number().min(0).max(1).default(0.45),
  duckingEnabled: z.boolean().default(true),
  fadeInSeconds: z.number().min(0).max(10).default(1.5),
  fadeOutSeconds: z.number().min(0).max(10).default(2),
  mixedAudioPath: z.string().optional()
});
var OutputSettingsSchema = z.object({
  resolution: ResolutionSchema.default("720p"),
  aspectRatio: AspectRatioSchema.default("16:9"),
  fps: z.union([z.literal(24), z.literal(30)]).default(24),
  exportVerticalAlso: z.boolean().default(true),
  exportSquareAlso: z.boolean().default(false),
  burnSubtitles: z.boolean().default(false),
  subtitleLanguage: z.string().default("en"),
  secondarySubtitleLanguage: z.string().optional(),
  subtitleStyle: SubtitleStyleSchema.default(() => SubtitleStyleSchema.parse({}))
});
var GenerationSettingsSchema = z.object({
  imageProvider: z.enum(["procedural", "comfyui", "diffusers", "imported"]).default("procedural"),
  animationProvider: z.enum(["deterministic", "comfyui_animatediff", "hybrid"]).default("deterministic"),
  lowVramMode: z.boolean().default(true),
  maxVramMb: z.number().int().default(4096),
  visualStyle: z.string().default("cinematic painterly illustration"),
  defaultSeed: z.number().int().default(1024)
});
var SubtitleEntrySchema = z.object({
  index: z.number().int().positive(),
  startTime: z.number().min(0),
  endTime: z.number().positive(),
  text: z.string(),
  language: z.string().default("en"),
  translatedText: z.string().optional()
});
var ProjectManifestSchema = z.object({
  manifestVersion: z.string().default(MANIFEST_VERSION),
  projectId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  topic: z.string().default(""),
  script: z.string().default(""),
  targetDurationSeconds: z.number().min(5).max(7200).default(120),
  createdAt: z.string(),
  updatedAt: z.string(),
  stage: z.enum([
    "created",
    "validated",
    "script_processed",
    "storyboard_ready",
    "storyboard_approved",
    "assets_generated",
    "animation_generated",
    "audio_generated",
    "assembled",
    "qc_passed",
    "exported"
  ]).default("created"),
  characters: z.array(CharacterSchema).default([]),
  environments: z.array(EnvironmentSchema).default([]),
  scenes: z.array(SceneSchema).default([]),
  subtitles: z.array(SubtitleEntrySchema).default([]),
  voiceConfig: VoiceConfigSchema.default(() => VoiceConfigSchema.parse({})),
  audioConfig: AudioDesignConfigSchema.default(() => AudioDesignConfigSchema.parse({})),
  generationSettings: GenerationSettingsSchema.default(() => GenerationSettingsSchema.parse({})),
  outputSettings: OutputSettingsSchema.default(() => OutputSettingsSchema.parse({})),
  exports: z.object({
    landscapeMp4: z.string().optional(),
    verticalMp4: z.string().optional(),
    squareMp4: z.string().optional(),
    srtPath: z.string().optional(),
    vttPath: z.string().optional(),
    assPath: z.string().optional(),
    archiveZip: z.string().optional()
  }).default({}),
  errors: z.array(
    z.object({
      stage: z.string(),
      message: z.string(),
      timestamp: z.string()
    })
  ).default([])
});

// server/db/database.ts
var WORKSPACE_ROOT = process.cwd();
var PROJECTS_DIR = path.resolve(WORKSPACE_ROOT, process.env.PROJECTS_DIR || "projects");
var CACHE_DIR = path.resolve(WORKSPACE_ROOT, process.env.CACHE_DIR || "cache");
var LOGS_DIR = path.resolve(WORKSPACE_ROOT, process.env.LOGS_DIR || "logs");
var MODELS_DIR = path.resolve(WORKSPACE_ROOT, process.env.MODELS_DIR || "models");
var DB_PATH = path.join(PROJECTS_DIR, "engine.sqlite");
for (const dir of [PROJECTS_DIR, CACHE_DIR, LOGS_DIR, MODELS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}
var db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    stage TEXT NOT NULL DEFAULT 'created',
    manifest_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    scene_id TEXT,
    shot_id TEXT,
    job_type TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 5,
    status TEXT NOT NULL DEFAULT 'pending',
    progress INTEGER NOT NULL DEFAULT 0,
    message TEXT DEFAULT '',
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 2,
    error_message TEXT,
    output_file TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    cache_hash TEXT,
    prompt TEXT DEFAULT '',
    model TEXT DEFAULT '',
    seed INTEGER,
    license TEXT DEFAULT 'user-owned',
    quality_status TEXT DEFAULT 'pending',
    metadata_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS qc_reports (
    project_id TEXT PRIMARY KEY,
    overall_status TEXT NOT NULL,
    report_json TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
`);
function getProjectDir(projectId) {
  const safeId = projectId.replace(/[^a-zA-Z0-9_-]/g, "");
  const dir = path.join(PROJECTS_DIR, safeId);
  for (const sub of [
    "inputs",
    "characters",
    "environments",
    "storyboard",
    "shots",
    "scenes",
    "audio",
    "subtitles",
    "exports"
  ]) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
  }
  return dir;
}
function saveManifest(manifest) {
  const parsed = ProjectManifestSchema.parse({
    ...manifest,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  const dir = getProjectDir(parsed.projectId);
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(parsed, null, 2), "utf8");
  const existing = db.prepare("SELECT id FROM projects WHERE id = ?").get(parsed.projectId);
  if (existing) {
    db.prepare(
      `UPDATE projects SET name = ?, description = ?, stage = ?, manifest_json = ?, updated_at = ? WHERE id = ?`
    ).run(
      parsed.name,
      parsed.description,
      parsed.stage,
      JSON.stringify(parsed),
      parsed.updatedAt,
      parsed.projectId
    );
  } else {
    db.prepare(
      `INSERT INTO projects (id, name, description, stage, manifest_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      parsed.projectId,
      parsed.name,
      parsed.description,
      parsed.stage,
      JSON.stringify(parsed),
      parsed.createdAt,
      parsed.updatedAt
    );
  }
  return parsed;
}
function getManifest(projectId) {
  const row = db.prepare("SELECT manifest_json FROM projects WHERE id = ?").get(projectId);
  if (!row) {
    const diskPath = path.join(PROJECTS_DIR, projectId, "manifest.json");
    if (fs.existsSync(diskPath)) {
      const parsed = ProjectManifestSchema.parse(JSON.parse(fs.readFileSync(diskPath, "utf8")));
      saveManifest(parsed);
      return parsed;
    }
    return null;
  }
  return ProjectManifestSchema.parse(JSON.parse(row.manifest_json));
}
function listManifests() {
  const rows = db.prepare("SELECT manifest_json FROM projects ORDER BY updated_at DESC").all();
  return rows.map((r) => ProjectManifestSchema.parse(JSON.parse(r.manifest_json)));
}
function deleteProjectRecord(projectId) {
  db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
  const dir = path.join(PROJECTS_DIR, projectId.replace(/[^a-zA-Z0-9_-]/g, ""));
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
function insertJob(job) {
  db.prepare(
    `INSERT INTO jobs (id, project_id, scene_id, shot_id, job_type, priority, status, progress, message, retry_count, max_retries, error_message, output_file, created_at, started_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    job.id,
    job.projectId,
    job.sceneId,
    job.shotId,
    job.jobType,
    job.priority,
    job.status,
    job.progress,
    job.message,
    job.retryCount,
    job.maxRetries,
    job.errorMessage,
    job.outputFile,
    job.createdAt,
    job.startedAt,
    job.completedAt
  );
  return job;
}
function updateJob(jobId, patch) {
  const current = getJob(jobId);
  if (!current) return null;
  const next = { ...current, ...patch };
  db.prepare(
    `UPDATE jobs SET status = ?, progress = ?, message = ?, retry_count = ?, error_message = ?, output_file = ?, started_at = ?, completed_at = ? WHERE id = ?`
  ).run(
    next.status,
    next.progress,
    next.message,
    next.retryCount,
    next.errorMessage,
    next.outputFile,
    next.startedAt,
    next.completedAt,
    jobId
  );
  return next;
}
function getJob(jobId) {
  const r = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
  return r ? mapJobRow(r) : null;
}
function listJobs(projectId) {
  const rows = projectId ? db.prepare("SELECT * FROM jobs WHERE project_id = ? ORDER BY created_at DESC").all(projectId) : db.prepare("SELECT * FROM jobs ORDER BY created_at DESC LIMIT 100").all();
  return rows.map(mapJobRow);
}
function mapJobRow(r) {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    sceneId: r.scene_id ? String(r.scene_id) : null,
    shotId: r.shot_id ? String(r.shot_id) : null,
    jobType: String(r.job_type),
    priority: Number(r.priority),
    status: r.status,
    progress: Number(r.progress),
    message: String(r.message ?? ""),
    retryCount: Number(r.retry_count),
    maxRetries: Number(r.max_retries),
    errorMessage: r.error_message ? String(r.error_message) : null,
    outputFile: r.output_file ? String(r.output_file) : null,
    createdAt: String(r.created_at),
    startedAt: r.started_at ? String(r.started_at) : null,
    completedAt: r.completed_at ? String(r.completed_at) : null
  };
}
function registerAsset(asset) {
  db.prepare(
    `INSERT OR REPLACE INTO assets (id, project_id, asset_type, file_path, cache_hash, prompt, model, seed, license, quality_status, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    asset.id,
    asset.projectId,
    asset.assetType,
    asset.filePath,
    asset.cacheHash ?? null,
    asset.prompt ?? "",
    asset.model ?? "",
    asset.seed ?? null,
    asset.license ?? "user-owned",
    asset.qualityStatus ?? "ready",
    JSON.stringify(asset.metadata ?? {}),
    (/* @__PURE__ */ new Date()).toISOString()
  );
}
function listAssets(projectId) {
  return db.prepare("SELECT * FROM assets WHERE project_id = ? ORDER BY created_at DESC").all(projectId);
}
function saveQCReport(report) {
  db.prepare(
    `INSERT OR REPLACE INTO qc_reports (project_id, overall_status, report_json, generated_at) VALUES (?, ?, ?, ?)`
  ).run(report.projectId, report.overallStatus, JSON.stringify(report), report.generatedAt);
  const dir = getProjectDir(report.projectId);
  fs.writeFileSync(path.join(dir, "qc_report.json"), JSON.stringify(report, null, 2), "utf8");
}
function getQCReport(projectId) {
  const row = db.prepare("SELECT report_json FROM qc_reports WHERE project_id = ?").get(projectId);
  return row ? JSON.parse(row.report_json) : null;
}
function writeEngineLog(message) {
  const line = `[${(/* @__PURE__ */ new Date()).toISOString()}] ${message}
`;
  fs.appendFileSync(path.join(LOGS_DIR, "engine.log"), line, "utf8");
}

// server/engines/characterEngine.ts
function applyCharacterAndEnvironmentConsistency(manifest) {
  const charMap = /* @__PURE__ */ new Map();
  for (const ch of manifest.characters) {
    charMap.set(ch.id, ch);
  }
  const envMap = /* @__PURE__ */ new Map();
  for (const env of manifest.environments) {
    envMap.set(env.id, env);
  }
  const updatedScenes = manifest.scenes.map((scene) => {
    const sceneEnv = envMap.get(scene.environmentId);
    const updatedShots = scene.shots.map((shot) => {
      const env = envMap.get(shot.environmentId || scene.environmentId) || sceneEnv;
      const presentChars = shot.charactersPresent.map((id) => charMap.get(id)).filter((c) => Boolean(c));
      const charBlocks = presentChars.map((ch) => {
        const parts = [
          ch.name,
          ch.appearance,
          ch.faceDetails ? `face: ${ch.faceDetails}` : "",
          ch.clothing ? `wearing ${ch.clothing}` : "",
          ch.accessories ? `with ${ch.accessories}` : "",
          ch.colorPalette.length > 0 ? `palette: ${ch.colorPalette.join(", ")}` : ""
        ].filter(Boolean);
        return parts.join(", ");
      });
      const envBlock = env ? `Environment: ${env.name}, ${env.description}, lighting: ${env.lighting}` : "";
      const refImages = Array.from(
        /* @__PURE__ */ new Set([
          ...shot.referenceImages,
          ...presentChars.flatMap((c) => c.referenceImages),
          ...env?.backgroundImage ? [env.backgroundImage] : []
        ])
      );
      const combinedNegatives = Array.from(
        /* @__PURE__ */ new Set([
          shot.negativePrompt,
          ...presentChars.map((c) => c.negativePrompt).filter(Boolean)
        ])
      ).filter(Boolean).join(", ");
      const primarySeed = presentChars[0]?.fixedSeed ?? shot.seed ?? manifest.generationSettings.defaultSeed;
      const basePrompt = shot.positivePrompt.split("| Consistency:")[0].trim();
      const consistencySuffix = [...charBlocks, envBlock].filter(Boolean).join("; ");
      return {
        ...shot,
        referenceImages: refImages,
        negativePrompt: combinedNegatives || "low quality, blurry, watermark",
        seed: primarySeed,
        positivePrompt: consistencySuffix ? `${basePrompt} | Consistency: ${consistencySuffix}` : basePrompt
      };
    });
    return {
      ...scene,
      shots: updatedShots
    };
  });
  return {
    ...manifest,
    scenes: updatedScenes
  };
}

// server/engines/motionParser.ts
function parseMotionInstruction(instruction) {
  const text = (instruction || "").toLowerCase();
  let camera = "zoom_in";
  if (/\b(zoom[\s-]?out|pull[\s-]?back|widen|retreat|reveal wide)\b/.test(text)) {
    camera = "zoom_out";
  } else if (/\b(pan[\s-]?left|move[\s-]?left|sweep[\s-]?left)\b/.test(text)) {
    camera = "pan_left";
  } else if (/\b(pan[\s-]?right|move[\s-]?right|sweep[\s-]?right|track across)\b/.test(text)) {
    camera = "pan_right";
  } else if (/\b(tilt[\s-]?up|rise|ascend|pan[\s-]?up)\b/.test(text)) {
    camera = "tilt_up";
  } else if (/\b(tilt[\s-]?down|descend|pan[\s-]?down)\b/.test(text)) {
    camera = "tilt_down";
  } else if (/\b(parallax|depth|foreground|layers)\b/.test(text)) {
    camera = "parallax";
  } else if (/\b(static|still|locked|fixed camera|tripod)\b/.test(text)) {
    camera = "static";
  } else if (/\b(push[\s-]?in|zoom[\s-]?in|moves?\s+toward|close[\s-]?up|approach)\b/.test(text)) {
    camera = "zoom_in";
  }
  let cameraSpeed = "slow";
  if (/\b(fast|rapid|quick|urgent|whip)\b/.test(text)) {
    cameraSpeed = "fast";
  } else if (/\b(medium|steady|moderate|smooth)\b/.test(text)) {
    cameraSpeed = "medium";
  }
  let weather = "none";
  if (/\b(storm|thunderstorm|tempest)\b/.test(text)) weather = "storm";
  else if (/\b(rain|downpour|drizzle)\b/.test(text)) weather = "rain";
  else if (/\b(snow|blizzard|snowfall|flakes)\b/.test(text)) weather = "snow";
  else if (/\b(fog|mist|haze)\b/.test(text)) weather = "fog";
  const effects = [];
  if (/\b(lightning|thunder|flash)\b/.test(text)) effects.push("lightning");
  if (/\b(fire|flame|ember|blaze|inferno)\b/.test(text)) effects.push("fire");
  if (/\b(smoke|ash|dust)\b/.test(text)) effects.push("smoke");
  if (/\b(ray|sunbeam|godray|beam|halo)\b/.test(text)) effects.push("light_rays");
  if (/\b(glow|radiance|aura|shimmer|luminous)\b/.test(text)) effects.push("glow");
  if (/\b(particle|spark|floating)\b/.test(text)) effects.push("particles");
  const cameraShake = /\b(shake|tremble|earthquake|impact|vibration|quake)\b/.test(text);
  const motionBlur = /\b(blur|streak|speed)\b/.test(text);
  let transitionIn = "fade";
  if (/\b(cut in|hard cut)\b/.test(text)) transitionIn = "cut";
  else if (/\b(dissolve)\b/.test(text)) transitionIn = "dissolve";
  return MotionSpecSchema.parse({
    rawInstruction: instruction,
    camera,
    cameraSpeed,
    subjectMotion: /\b(dynamic|battle|run|fight|action)\b/.test(text) ? "moderate" : "minimal",
    cameraShake,
    parallaxDepth: camera === "parallax" ? 0.55 : 0.25,
    weather,
    effects,
    transitionIn,
    transitionOut: "dissolve",
    motionBlur,
    preserveCharacterIdentity: true
  });
}

// server/engines/scriptProcessor.ts
import crypto from "node:crypto";
function processScriptToPlan(script, targetDurationSeconds, existingCharacters = [], existingEnvironments = [], visualStyle = "cinematic illustration") {
  const warnings = [];
  const trimmed = (script || "").trim();
  if (!trimmed) {
    warnings.push("Script is empty. Add narration or scene blocks before asset generation.");
    return {
      scenes: [],
      detectedCharacters: [],
      detectedLocations: [],
      estimatedSpeakingSeconds: 0,
      warnings
    };
  }
  const lines = trimmed.split(/\r?\n/);
  const rawBlocks = [];
  let current = null;
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
        location: (locPart || titlePart || "Primary Location").trim(),
        lines: [],
        motionCue: ""
      };
      continue;
    }
    if (!current) {
      current = {
        title: `Scene ${rawBlocks.length + 1}`,
        location: existingEnvironments[0]?.name || "Primary Location",
        lines: [],
        motionCue: ""
      };
    }
    const motionMatch = line.match(/^\[(?:MOTION|CAMERA|ANIMATION)[:\s]+(.+)\]$/i);
    if (motionMatch) {
      current.motionCue = current.motionCue ? `${current.motionCue}; ${motionMatch[1].trim()}` : motionMatch[1].trim();
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
    warnings.push("Could not parse distinct scenes; wrapped entire script as a single scene.");
    rawBlocks.push({
      title: "Scene 1",
      location: "Primary Location",
      lines: [trimmed],
      motionCue: "Slow cinematic zoom-in"
    });
  }
  const detectedCharSet = /* @__PURE__ */ new Set();
  const detectedLocSet = /* @__PURE__ */ new Set();
  const parsedBlockMeta = rawBlocks.map((block, idx) => {
    detectedLocSet.add(block.location);
    const dialogueLines = [];
    const narrationParts = [];
    for (const line of block.lines) {
      const dlgMatch = line.match(/^([A-Z\u0900-\u097F][A-Za-z0-9_\s\u0900-\u097F]{1,28}):\s+(.+)$/);
      if (dlgMatch && !/^(NARRATOR|NARRATION|VOICEOVER)$/i.test(dlgMatch[1].trim())) {
        const speaker = dlgMatch[1].trim();
        detectedCharSet.add(speaker);
        dialogueLines.push({ speaker, text: dlgMatch[2].trim() });
        narrationParts.push(dlgMatch[2].trim());
      } else {
        const cleaned = line.replace(/^(NARRATOR|NARRATION|VOICEOVER):\s*/i, "").trim();
        narrationParts.push(cleaned);
        for (const ch of existingCharacters) {
          if (cleaned.toLowerCase().includes(ch.name.toLowerCase())) {
            detectedCharSet.add(ch.name);
          }
        }
      }
    }
    const fullNarration = narrationParts.join(" ").trim();
    const wordCount = Math.max(1, fullNarration.split(/\s+/).filter(Boolean).length);
    const estimatedSpeechSec = Number((wordCount / 2.25).toFixed(2));
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
      motionCue: block.motionCue || "Slow cinematic zoom-in with gentle atmospheric depth"
    };
  });
  const totalEstimatedSpeech = parsedBlockMeta.reduce((acc, b) => acc + b.estimatedSpeechSec, 0);
  const totalWords = parsedBlockMeta.reduce((acc, b) => acc + b.wordCount, 0);
  if (totalEstimatedSpeech > targetDurationSeconds * 1.35) {
    warnings.push(
      `Script narration (~${Math.round(totalEstimatedSpeech)}s at 135 WPM) exceeds target duration (${targetDurationSeconds}s). Shots will require faster pacing or trimming.`
    );
  }
  if (existingCharacters.length === 0 && detectedCharSet.size === 0) {
    warnings.push("No character names or reference profiles detected; consider adding character profiles for visual consistency.");
  }
  let cursorTime = 0;
  const scenes = parsedBlockMeta.map((b, idx) => {
    const isLast = idx === parsedBlockMeta.length - 1;
    const rawDur = b.wordCount / Math.max(1, totalWords) * targetDurationSeconds;
    const sceneDuration = isLast ? Number(Math.max(4, targetDurationSeconds - cursorTime).toFixed(2)) : Number(Math.max(4, rawDur).toFixed(2));
    const sceneStart = Number(cursorTime.toFixed(2));
    const sceneEnd = Number((sceneStart + sceneDuration).toFixed(2));
    cursorTime = sceneEnd;
    const sceneId = `scene-${idx + 1}`;
    const shotCount = Math.max(2, Math.min(5, Math.round(sceneDuration / 8)));
    const sentences = splitIntoSentences(b.narrationText);
    const shots = [];
    let shotCursor = sceneStart;
    for (let s = 0; s < shotCount; s++) {
      const isLastShot = s === shotCount - 1;
      const shotDur = isLastShot ? Number(Math.max(2, sceneEnd - shotCursor).toFixed(2)) : Number((sceneDuration / shotCount).toFixed(2));
      const shotStart = Number(shotCursor.toFixed(2));
      const shotEnd = Number((shotStart + shotDur).toFixed(2));
      shotCursor = shotEnd;
      const startSent = Math.floor(s * sentences.length / shotCount);
      const endSent = Math.floor((s + 1) * sentences.length / shotCount);
      const shotNarration = sentences.slice(startSent, Math.max(startSent + 1, endSent)).join(" ").trim() || b.narrationText;
      const cameraCycle = [
        b.motionCue,
        "Slow horizontal pan right with subtle atmospheric depth",
        "Slow zoom-out revealing wide environment",
        "Layered parallax drift with soft light rays"
      ];
      const shotMotionPrompt = s === 0 ? b.motionCue : cameraCycle[s % cameraCycle.length];
      const matchedChars = existingCharacters.filter(
        (ch) => shotNarration.toLowerCase().includes(ch.name.toLowerCase()) || b.dialogueLines.some((d) => d.speaker.toLowerCase() === ch.name.toLowerCase())
      ).map((c) => c.id);
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
        negativePrompt: "low quality, blurry, distorted anatomy, text overlay, watermark",
        motionPrompt: shotMotionPrompt,
        motionSpec: parseMotionInstruction(shotMotionPrompt),
        animationModel: "ffmpeg-deterministic-v1",
        generationMethod: "deterministic",
        narrationSegment: shotNarration,
        soundEffects: [],
        subtitleSegment: shotNarration,
        status: "pending",
        approved: false,
        seed: 1e3 + idx * 100 + s
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
      status: "pending",
      shots
    };
  });
  return {
    scenes,
    detectedCharacters: Array.from(detectedCharSet),
    detectedLocations: Array.from(detectedLocSet),
    estimatedSpeakingSeconds: Number(totalEstimatedSpeech.toFixed(2)),
    warnings
  };
}
function validateManifestDurations(manifest) {
  const issues = [];
  if (manifest.scenes.length === 0) {
    issues.push("Manifest contains zero scenes.");
    return { valid: false, totalSceneDuration: 0, issues };
  }
  let totalSceneDuration = 0;
  for (const scene of manifest.scenes) {
    totalSceneDuration += scene.duration;
    if (scene.shots.length === 0) {
      issues.push(`Scene "${scene.title}" has zero shots.`);
    }
    const shotSum = scene.shots.reduce((acc, s) => acc + s.duration, 0);
    if (Math.abs(shotSum - scene.duration) > 1) {
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
    issues
  };
}
function splitIntoSentences(text) {
  const parts = text.split(/(?<=[.!?।])\s+/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [text];
}
function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || crypto.randomBytes(4).toString("hex");
}

// server/engines/videoAssembler.ts
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import fs2 from "node:fs";
import path2 from "node:path";
import { promisify } from "node:util";
var require2 = createRequire(import.meta.url);
var archiver = require2("archiver");
var execFileAsync = promisify(execFile);
function getTargetDimensions(resolution, aspectRatio) {
  if (aspectRatio === "9:16") {
    return resolution === "1080p" ? { width: 1080, height: 1920 } : { width: 720, height: 1280 };
  }
  if (aspectRatio === "1:1") {
    return resolution === "1080p" ? { width: 1080, height: 1080 } : { width: 720, height: 720 };
  }
  return resolution === "1080p" ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
}
async function assembleProjectVideo(manifest) {
  const projectDir = getProjectDir(manifest.projectId);
  const scenesDir = path2.join(projectDir, "scenes");
  const exportsDir = path2.join(projectDir, "exports");
  fs2.mkdirSync(scenesDir, { recursive: true });
  fs2.mkdirSync(exportsDir, { recursive: true });
  const sceneFiles = [];
  const updatedScenes = [];
  for (const scene of manifest.scenes) {
    const shotPaths = scene.shots.map((s) => s.outputFile).filter((p) => Boolean(p && fs2.existsSync(p)));
    if (shotPaths.length === 0) {
      throw new Error(`Scene "${scene.title}" has no rendered shot clips.`);
    }
    const sceneOut = path2.join(scenesDir, `${scene.id}.mp4`);
    const listFile = path2.join(scenesDir, `${scene.id}_concat.txt`);
    fs2.writeFileSync(
      listFile,
      shotPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"),
      "utf8"
    );
    await execFileAsync("ffmpeg", [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listFile,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      sceneOut
    ]);
    sceneFiles.push(sceneOut);
    updatedScenes.push({
      ...scene,
      outputFile: sceneOut,
      status: "completed"
    });
  }
  const episodeConcatList = path2.join(exportsDir, "episode_concat.txt");
  fs2.writeFileSync(
    episodeConcatList,
    sceneFiles.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"),
    "utf8"
  );
  const silentMaster = path2.join(exportsDir, "episode_silent.mp4");
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    episodeConcatList,
    "-c",
    "copy",
    silentMaster
  ]);
  const landscapeMp4 = path2.join(
    exportsDir,
    `${manifest.projectId}_final_${manifest.outputSettings.aspectRatio.replace(":", "x")}.mp4`
  );
  const mixedAudio = manifest.audioConfig.mixedAudioPath && fs2.existsSync(manifest.audioConfig.mixedAudioPath) ? manifest.audioConfig.mixedAudioPath : null;
  const srtPath = manifest.exports.srtPath && fs2.existsSync(manifest.exports.srtPath) ? manifest.exports.srtPath : null;
  const ffmpegArgs = ["-y", "-i", silentMaster];
  if (mixedAudio) ffmpegArgs.push("-i", mixedAudio);
  if (srtPath && !manifest.outputSettings.burnSubtitles) {
    ffmpegArgs.push("-i", srtPath);
  }
  if (manifest.outputSettings.burnSubtitles && srtPath) {
    const escapedSrt = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");
    ffmpegArgs.push("-vf", `subtitles='${escapedSrt}'`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "22");
  } else {
    ffmpegArgs.push("-c:v", "copy");
  }
  if (mixedAudio) {
    ffmpegArgs.push("-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-b:a", "192k", "-shortest");
    if (srtPath && !manifest.outputSettings.burnSubtitles) {
      ffmpegArgs.push("-map", "2:s:0", "-c:s", "mov_text");
    }
  } else {
    ffmpegArgs.push("-map", "0:v:0");
  }
  ffmpegArgs.push("-movflags", "+faststart", landscapeMp4);
  await execFileAsync("ffmpeg", ffmpegArgs, { timeout: 12e4 });
  let verticalMp4;
  if (manifest.outputSettings.exportVerticalAlso && manifest.outputSettings.aspectRatio !== "9:16") {
    const vDim = getTargetDimensions(manifest.outputSettings.resolution, "9:16");
    verticalMp4 = path2.join(exportsDir, `${manifest.projectId}_final_9x16.mp4`);
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        landscapeMp4,
        "-vf",
        `scale=${vDim.width}:${vDim.height}:force_original_aspect_ratio=increase,crop=${vDim.width}:${vDim.height},format=yuv420p`,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
        verticalMp4
      ],
      { timeout: 12e4 }
    );
  }
  let squareMp4;
  if (manifest.outputSettings.exportSquareAlso && manifest.outputSettings.aspectRatio !== "1:1") {
    const sDim = getTargetDimensions(manifest.outputSettings.resolution, "1:1");
    squareMp4 = path2.join(exportsDir, `${manifest.projectId}_final_1x1.mp4`);
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        landscapeMp4,
        "-vf",
        `scale=${sDim.width}:${sDim.height}:force_original_aspect_ratio=increase,crop=${sDim.width}:${sDim.height},format=yuv420p`,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
        squareMp4
      ],
      { timeout: 12e4 }
    );
  }
  if (fs2.existsSync(silentMaster)) fs2.unlinkSync(silentMaster);
  const nextManifest = {
    ...manifest,
    stage: "assembled",
    scenes: updatedScenes,
    exports: {
      ...manifest.exports,
      landscapeMp4,
      verticalMp4,
      squareMp4
    }
  };
  return {
    manifest: nextManifest,
    landscapeMp4,
    verticalMp4,
    squareMp4
  };
}
async function createProjectArchiveZip(projectId) {
  const projectDir = getProjectDir(projectId);
  const exportsDir = path2.join(projectDir, "exports");
  fs2.mkdirSync(exportsDir, { recursive: true });
  const zipPath = path2.join(exportsDir, `${projectId}_archive.zip`);
  return new Promise((resolve, reject) => {
    const output = fs2.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 6 } });
    output.on("close", () => resolve(zipPath));
    archive.on("error", (err) => reject(err));
    archive.pipe(output);
    archive.glob("**/*", {
      cwd: projectDir,
      ignore: ["exports/*.zip"]
    });
    archive.finalize();
  });
}

// server/engines/voiceEngine.ts
import { execFile as execFile2 } from "node:child_process";
import fs3 from "node:fs";
import path3 from "node:path";
import { promisify as promisify2 } from "node:util";
var execFileAsync2 = promisify2(execFile2);
async function validateVoiceSample(filePath) {
  const warnings = [];
  if (!fs3.existsSync(filePath)) {
    return {
      valid: false,
      durationSeconds: 0,
      sampleRate: 0,
      channels: 0,
      warnings: ["Voice sample file not found."]
    };
  }
  try {
    const { stdout } = await execFileAsync2("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=sample_rate,channels",
      "-of",
      "json",
      filePath
    ]);
    const parsed = JSON.parse(stdout);
    const duration = Number(parsed.format?.duration || 0);
    const stream = parsed.streams?.[0];
    const sampleRate = Number(stream?.sample_rate || 0);
    const channels = Number(stream?.channels || 1);
    if (duration < 3) {
      warnings.push("Voice sample is shorter than 3 seconds; XTTS cloning recommends 6\u201330 seconds of clean speech.");
    }
    if (duration > 120) {
      warnings.push("Voice sample exceeds 120 seconds; trimming to a 20-second clean window is recommended.");
    }
    return {
      valid: duration > 0.5,
      durationSeconds: Number(duration.toFixed(2)),
      sampleRate,
      channels,
      warnings
    };
  } catch (err) {
    return {
      valid: false,
      durationSeconds: 0,
      sampleRate: 0,
      channels: 0,
      warnings: [err instanceof Error ? err.message : "Failed to inspect audio stream."]
    };
  }
}
function applyPronunciationDictionary(text, dict) {
  let out = text;
  for (const [term, replacement] of Object.entries(dict || {})) {
    if (!term.trim()) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`\\b${escaped}\\b`, "gi"), replacement);
  }
  return out;
}
async function generateProjectNarration(manifest) {
  const projectDir = getProjectDir(manifest.projectId);
  const audioDir = path3.join(projectDir, "audio");
  fs3.mkdirSync(audioDir, { recursive: true });
  const narrationWavPath = path3.join(audioDir, "narration_master.wav");
  const narrationMp3Path = path3.join(audioDir, "narration_master.mp3");
  if (manifest.voiceConfig.voiceSamplePath && manifest.voiceConfig.voiceIdentity === "cloned" && !manifest.voiceConfig.consentVerified) {
    throw new Error(
      "Voice cloning consent verification is required before using a reference voice sample."
    );
  }
  const piperBin = process.env.PIPER_BINARY_PATH || "";
  const hasPiper = Boolean(piperBin && fs3.existsSync(piperBin));
  const segmentFiles = [];
  let engineUsed = "deterministic-cadence-guide";
  const updatedScenes = [];
  for (const scene of manifest.scenes) {
    const cleanText = applyPronunciationDictionary(
      scene.narrationText || scene.title,
      manifest.voiceConfig.pronunciationDict
    );
    const sceneWav = path3.join(audioDir, `${scene.id}_narration.wav`);
    if (hasPiper) {
      engineUsed = "piper-tts-local";
      await execFileAsync2(
        piperBin,
        ["--output_file", sceneWav],
        { timeout: 3e4 }
      ).catch(async () => {
        await synthesizeCadenceSegment(sceneWav, scene.duration, scene.sceneNumber);
      });
    } else if (manifest.voiceConfig.generatedNarrationPath && fs3.existsSync(manifest.voiceConfig.generatedNarrationPath) && manifest.scenes.length === 1) {
      engineUsed = "user-supplied-narration";
      await normalizeAndPadAudio(
        manifest.voiceConfig.generatedNarrationPath,
        sceneWav,
        scene.duration
      );
    } else {
      await synthesizeCadenceSegment(sceneWav, scene.duration, scene.sceneNumber, cleanText.length);
    }
    segmentFiles.push(sceneWav);
    updatedScenes.push({
      ...scene,
      shots: scene.shots.map((sh) => ({
        ...sh,
        narrationAudioPath: sceneWav
      }))
    });
  }
  const concatListPath = path3.join(audioDir, "narration_concat.txt");
  fs3.writeFileSync(
    concatListPath,
    segmentFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"),
    "utf8"
  );
  await execFileAsync2("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatListPath,
    "-ar",
    "44100",
    "-ac",
    "2",
    "-c:a",
    "pcm_s16le",
    narrationWavPath
  ]);
  await execFileAsync2("ffmpeg", [
    "-y",
    "-i",
    narrationWavPath,
    "-codec:a",
    "libmp3lame",
    "-b:a",
    "192k",
    narrationMp3Path
  ]);
  const nextManifest = {
    ...manifest,
    scenes: updatedScenes,
    voiceConfig: {
      ...manifest.voiceConfig,
      generatedNarrationPath: narrationWavPath
    }
  };
  return {
    manifest: nextManifest,
    engineUsed,
    narrationWavPath,
    narrationMp3Path
  };
}
async function normalizeAndPadAudio(inputPath, outputWav, targetDuration) {
  await execFileAsync2("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-af",
    `silenceremove=start_periods=1:start_threshold=-45dB,loudnorm=I=-16:TP=-1.5:LRA=11,apad=whole_dur=${targetDuration}`,
    "-t",
    String(targetDuration),
    "-ar",
    "44100",
    "-ac",
    "2",
    "-c:a",
    "pcm_s16le",
    outputWav
  ]);
}
async function synthesizeCadenceSegment(outputWav, duration, seedIdx, textLen = 80) {
  const baseFreq = 196 + seedIdx % 4 * 24;
  const pulseRate = Math.min(2.5, Math.max(0.8, textLen / Math.max(1, duration * 35)));
  const fadeOutStart = Math.max(0.1, duration - 0.35).toFixed(2);
  await execFileAsync2("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=${baseFreq}:duration=${duration}:sample_rate=44100`,
    "-af",
    `volume=0.08,tremolo=f=${pulseRate.toFixed(2)}:d=0.65,afade=t=in:st=0:d=0.25,afade=t=out:st=${fadeOutStart}:d=0.35`,
    "-ac",
    "2",
    "-c:a",
    "pcm_s16le",
    outputWav
  ]);
}

// server/services/aiAssistService.ts
async function generateProjectDraftFromTopic(input) {
  const ollamaUrl = (process.env.OLLAMA_API_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL || "qwen2.5:3b";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3e3);
    const ping = await fetch(`${ollamaUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    if (ping.ok) {
      const prompt = `Create a structured 4-scene video narration script in ${input.language} for a ${input.targetDurationSeconds}-second video about: "${input.topic}".
Visual style: ${input.visualStyle}.
Format strictly with headers "SCENE 1: Title - Location", "[MOTION: camera instruction]", and narration paragraphs. Keep total length proportional to ${input.targetDurationSeconds} seconds.`;
      const genRes = await fetch(`${ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, stream: false })
      });
      if (genRes.ok) {
        const data = await genRes.json();
        if (data.response && data.response.trim().length > 40) {
          return {
            source: "ollama-local",
            script: data.response.trim(),
            suggestedCharacters: [
              {
                name: "Protagonist",
                appearance: "Expressive central figure aligned with the narrative theme",
                clothing: "Period-accurate or domain-authentic attire"
              }
            ],
            suggestedEnvironments: [
              {
                name: "Opening Setting",
                description: `Wide atmospheric backdrop establishing ${input.topic}`,
                lighting: "Golden hour cinematic rim lighting"
              }
            ]
          };
        }
      }
    }
  } catch {
  }
  const topicClean = input.topic.trim() || "A New Documentary Story";
  const script = `SCENE 1: Introduction - Opening Vista
[MOTION: Slow zoom-in across wide horizon with soft light rays]
NARRATOR: Every remarkable journey begins with a moment of stillness. Today we explore ${topicClean}, tracing the forces and turning points that shaped its legacy.

SCENE 2: Rising Tension - Central Chamber
[MOTION: Slow pan right with subtle fog and warm glow]
NARRATOR: Beneath the surface, contrasting ambitions and unspoken challenges begin to converge. Each decision carries weight as circumstances shift toward conflict.

SCENE 3: Turning Point - Storm Ridge
[MOTION: Slow push-in with dramatic lightning flash and storm atmosphere]
NARRATOR: At the decisive hour, resolve is tested against overwhelming odds. Through perseverance and clarity of purpose, a new balance begins to emerge.

SCENE 4: Resolution - Dawn Horizon
[MOTION: Slow zoom-out revealing tranquil wide vista with warm light rays]
NARRATOR: As the storm clears, the lasting impact of ${topicClean} comes into focus\u2014reminding us how enduring stories continue to inspire generations.`;
  return {
    source: "structured-outline",
    script,
    suggestedCharacters: [
      {
        name: "Narrator Focus Subject",
        appearance: "Distinctive silhouette and expressive posture suited to the story",
        clothing: "Detailed thematic attire with clear color contrast"
      }
    ],
    suggestedEnvironments: [
      {
        name: "Opening Vista",
        description: `Atmospheric establishing landscape for ${topicClean}`,
        lighting: "Warm directional sunlight with soft atmospheric haze"
      },
      {
        name: "Storm Ridge",
        description: "High-contrast dramatic ridge under gathering clouds",
        lighting: "Cool slate shadows broken by sharp amber highlights"
      }
    ]
  };
}

// server/services/demoSeed.ts
import { execFile as execFile3 } from "node:child_process";
import fs4 from "node:fs";
import path4 from "node:path";
import { promisify as promisify3 } from "node:util";
var execFileAsync3 = promisify3(execFile3);
var DEMO_PROJECT_ID = "mahishasura-ep1";
var DEMO_SCRIPT = `SCENE 1: The Boons of Penance - Mountain Hermitage
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
async function ensureDemoProjectSeeded() {
  const existing = getManifest(DEMO_PROJECT_ID);
  if (existing) return existing;
  const projectDir = getProjectDir(DEMO_PROJECT_ID);
  const charsDir = path4.join(projectDir, "characters");
  const envsDir = path4.join(projectDir, "environments");
  fs4.mkdirSync(charsDir, { recursive: true });
  fs4.mkdirSync(envsDir, { recursive: true });
  const mahishasuraRef = path4.join(charsDir, "mahishasura_ref.png");
  const deviRef = path4.join(charsDir, "devi_ref.png");
  const mountainEnv = path4.join(envsDir, "mandara_peaks.png");
  const fortressEnv = path4.join(envsDir, "obsidian_fortress.png");
  const citadelEnv = path4.join(envsDir, "celestial_citadel.png");
  const battlefieldEnv = path4.join(envsDir, "crimson_battlefield.png");
  await Promise.all([
    renderCharacterCard(mahishasuraRef, "Mahishasura", "#450a0a", "#ea580c", "horned"),
    renderCharacterCard(deviRef, "Devi", "#31102f", "#f59e0b", "radiant"),
    renderEnvironmentPlate(mountainEnv, "Mandara Mountain Peaks", "#0f172a", "#b45309"),
    renderEnvironmentPlate(fortressEnv, "Obsidian Fortress", "#18181b", "#dc2626"),
    renderEnvironmentPlate(citadelEnv, "Celestial Citadel", "#172554", "#38bdf8"),
    renderEnvironmentPlate(battlefieldEnv, "Crimson Battlefield", "#2e1010", "#f97316")
  ]);
  const characters = [
    {
      id: "char-mahishasura",
      name: "Mahishasura",
      description: "Formidable shapeshifting asura monarch driven by fierce ambition.",
      appearance: "Broad-shouldered armored silhouette, curved obsidian horns, intense amber gaze",
      faceDetails: "Strong angular jaw, furrowed brow, bronze skin tone",
      bodyProportions: "Tall towering heroic build",
      clothing: "Dark bronze breastplate, crimson battle waist-sash, iron pauldrons",
      accessories: "Curved steel mace, royal horned crown",
      colorPalette: ["#450a0a", "#ea580c", "#1c1917"],
      voiceIdentity: "deep-commanding",
      referenceImages: [mahishasuraRef],
      negativePrompt: "modern clothing, cartoon, blurry, watermark, extra limbs",
      styleInfo: "epic painterly mythological illustration",
      fixedSeed: 2048
    },
    {
      id: "char-devi",
      name: "Devi",
      description: "Radiant embodiment of cosmic order born from unified celestial light.",
      appearance: "Serene fearless expression, luminous golden aura, flowing dark hair",
      faceDetails: "Calm determined eyes, golden bindu on forehead",
      bodyProportions: "Graceful poised warrior stance",
      clothing: "Crimson and gold silk battle saree, ornate celestial armor",
      accessories: "Golden trident, blazing discus, lotus emblem",
      colorPalette: ["#7c2d12", "#f59e0b", "#fef3c7"],
      voiceIdentity: "calm-resonant",
      referenceImages: [deviRef],
      negativePrompt: "modern clothing, blurry, watermark, low contrast",
      styleInfo: "epic painterly mythological illustration",
      fixedSeed: 4096
    }
  ];
  const environments = [
    {
      id: "env-mandara-mountain-peaks",
      name: "Mountain Hermitage",
      description: "High rocky Himalayan ridges veiled in dawn mist and golden sunbeams",
      backgroundImage: mountainEnv,
      lighting: "Golden dawn shafts piercing mountain mist",
      weatherDefault: "fog",
      colorPalette: ["#0f172a", "#b45309", "#f59e0b"]
    },
    {
      id: "env-obsidian-fortress",
      name: "Obsidian Fortress",
      description: "Monolithic basalt pillars lit by blazing braziers and crimson banners",
      backgroundImage: fortressEnv,
      lighting: "Warm torchlight against deep obsidian stone",
      weatherDefault: "none",
      colorPalette: ["#18181b", "#7f1d1d", "#dc2626"]
    },
    {
      id: "env-celestial-citadel",
      name: "Celestial Citadel",
      description: "Elevated cloud-ringed sanctuary crackling with gathering storm lightning",
      backgroundImage: citadelEnv,
      lighting: "Cool indigo cloud light with electric cyan flashes",
      weatherDefault: "storm",
      colorPalette: ["#172554", "#1e3a8a", "#38bdf8"]
    },
    {
      id: "env-crimson-battlefield",
      name: "Crimson Battlefield",
      description: "Expansive dusty plain under a dramatic crimson twilight horizon",
      backgroundImage: battlefieldEnv,
      lighting: "Deep crimson sunset backlight with drifting embers",
      weatherDefault: "none",
      colorPalette: ["#2e1010", "#7c2d12", "#f97316"]
    }
  ];
  const analysis = processScriptToPlan(
    DEMO_SCRIPT,
    120,
    characters,
    environments,
    "epic painterly mythological illustration"
  );
  const envIds = environments.map((e) => e.id);
  analysis.scenes.forEach((scene, i) => {
    scene.environmentId = envIds[i % envIds.length];
    scene.shots.forEach((sh) => {
      sh.environmentId = scene.environmentId;
      if (i === 0 || i === 1) sh.charactersPresent = ["char-mahishasura"];
      if (i === 2) sh.charactersPresent = ["char-devi"];
      if (i === 3) sh.charactersPresent = ["char-mahishasura", "char-devi"];
    });
  });
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let manifest = ProjectManifestSchema.parse({
    projectId: DEMO_PROJECT_ID,
    name: "Mahishasura \u2014 Episode 1 (Demo)",
    description: "120-second deterministic demonstration project showcasing multi-scene script parsing, character consistency, FFmpeg camera/weather animation, narration, subtitles, and QC.",
    topic: "Mahishasura Episode 1: Rise of the Asura King & Birth of Cosmic Resolve",
    script: DEMO_SCRIPT,
    targetDurationSeconds: 120,
    createdAt: now,
    updatedAt: now,
    stage: "script_processed",
    characters,
    environments,
    scenes: analysis.scenes,
    voiceConfig: {
      language: "en",
      voiceIdentity: "piper-default",
      deliveryStyle: "epic documentary narration",
      speakingSpeed: 1,
      emotionalTone: "dramatic",
      pronunciationDict: {
        Mahishasura: "Ma-hi-sha-su-ra",
        Devi: "Day-vee",
        Mandara: "Man-da-ra"
      }
    },
    generationSettings: {
      imageProvider: "procedural",
      animationProvider: "deterministic",
      lowVramMode: true,
      maxVramMb: 4096,
      visualStyle: "epic painterly mythological illustration",
      defaultSeed: 2048
    },
    outputSettings: {
      resolution: "720p",
      aspectRatio: "16:9",
      fps: 24,
      exportVerticalAlso: true,
      exportSquareAlso: false,
      burnSubtitles: false,
      subtitleLanguage: "en"
    }
  });
  manifest = applyCharacterAndEnvironmentConsistency(manifest);
  return saveManifest(manifest);
}
async function renderCharacterCard(outPath, title, bgHex, accentHex, motif) {
  const motifDraw = motif === "horned" ? [
    "-fill",
    accentHex,
    "-draw",
    "circle 256,210 256,130",
    "-fill",
    "#09090b",
    "-draw",
    "polygon 160,480 205,270 307,270 352,480",
    "-draw",
    "circle 256,215 256,162",
    "-fill",
    accentHex,
    "-draw",
    "polygon 185,180 140,105 205,158",
    "-draw",
    "polygon 327,180 372,105 307,158"
  ] : [
    "-fill",
    accentHex,
    "-draw",
    "circle 256,205 256,110",
    "-fill",
    "#1f091c",
    "-draw",
    "polygon 175,480 212,265 300,265 337,480",
    "-draw",
    "circle 256,205 256,158",
    "-fill",
    "#fef3c7",
    "-draw",
    "circle 256,198 256,192"
  ];
  await execFileAsync3("convert", [
    "-size",
    "512x512",
    `gradient:${bgHex}-#09090b`,
    ...motifDraw,
    "-gravity",
    "south",
    "-fill",
    "#f8fafc",
    "-pointsize",
    "26",
    "-annotate",
    "+0+24",
    title,
    outPath
  ]).catch(async () => {
    await execFileAsync3("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=${bgHex.replace("#", "0x")}:s=512x512:d=1`,
      "-frames:v",
      "1",
      outPath
    ]);
  });
}
async function renderEnvironmentPlate(outPath, label, topHex, bottomHex) {
  await execFileAsync3("convert", [
    "-size",
    "1280x720",
    `gradient:${topHex}-${bottomHex}`,
    "-fill",
    "#090d16",
    "-draw",
    "path 'M 0,720 L 0,480 L 210,410 L 420,465 L 670,355 L 920,455 L 1140,395 L 1280,445 L 1280,720 Z'",
    "-gravity",
    "southwest",
    "-fill",
    "rgba(248,250,252,0.72)",
    "-pointsize",
    "22",
    "-annotate",
    "+28+24",
    label,
    outPath
  ]).catch(async () => {
    await execFileAsync3("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=${topHex.replace("#", "0x")}:s=1280x720:d=1`,
      "-frames:v",
      "1",
      outPath
    ]);
  });
}

// server/services/systemStatus.ts
import { execFile as execFile4 } from "node:child_process";
import fs6 from "node:fs";
import os from "node:os";
import path6 from "node:path";
import { promisify as promisify4 } from "node:util";

// server/engines/assetCache.ts
import crypto2 from "node:crypto";
import fs5 from "node:fs";
import path5 from "node:path";
function computeGenerationHash(params) {
  const canonical = JSON.stringify(sortKeys(params));
  return crypto2.createHash("sha256").update(canonical).digest("hex").slice(0, 24);
}
function sortKeys(obj) {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeys(obj[key]);
    }
    return out;
  }
  return obj;
}
function getCachedFile(hash, ext) {
  const filePath = path5.join(CACHE_DIR, `${hash}.${ext.replace(/^\./, "")}`);
  if (fs5.existsSync(filePath) && fs5.statSync(filePath).size > 0) {
    return filePath;
  }
  return null;
}
function storeCachedFile(hash, ext, sourceFilePath) {
  fs5.mkdirSync(CACHE_DIR, { recursive: true });
  const target = path5.join(CACHE_DIR, `${hash}.${ext.replace(/^\./, "")}`);
  if (sourceFilePath !== target) {
    fs5.copyFileSync(sourceFilePath, target);
  }
  return target;
}
function getCacheStats() {
  if (!fs5.existsSync(CACHE_DIR)) return { fileCount: 0, totalBytes: 0 };
  const files = fs5.readdirSync(CACHE_DIR);
  let totalBytes = 0;
  for (const f of files) {
    const p = path5.join(CACHE_DIR, f);
    if (fs5.statSync(p).isFile()) {
      totalBytes += fs5.statSync(p).size;
    }
  }
  return { fileCount: files.length, totalBytes };
}

// server/services/systemStatus.ts
var execFileAsync4 = promisify4(execFile4);
async function getSystemStatus() {
  const [ffmpegVersion, ffprobeAvailable, imagemagickAvailable, comfyUiReachable, ollamaReachable] = await Promise.all([
    probeCommand("ffmpeg", ["-version"]),
    probeBoolean("ffprobe", ["-version"]),
    probeBoolean("convert", ["-version"]),
    probeHttp(process.env.COMFYUI_API_URL || "http://127.0.0.1:8188", "/system_stats"),
    probeHttp(process.env.OLLAMA_API_URL || "http://127.0.0.1:11434", "/api/tags")
  ]);
  const cacheStats = getCacheStats();
  const projectsBytes = folderBytes(PROJECTS_DIR);
  const piperBin = process.env.PIPER_BINARY_PATH || "";
  return {
    platform: `${os.platform()} (${os.arch()})`,
    cpuModel: os.cpus()[0]?.model || "CPU",
    cpuCores: os.cpus().length,
    totalRamGb: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
    freeRamGb: Number((os.freemem() / 1024 ** 3).toFixed(1)),
    lowVramMode: process.env.LOW_VRAM_MODE !== "false",
    vramBudgetMb: Number(process.env.VRAM_BUDGET_MB || 4096),
    storage: {
      projectsBytes,
      cacheBytes: cacheStats.totalBytes,
      cacheFiles: cacheStats.fileCount
    },
    tools: {
      ffmpegAvailable: Boolean(ffmpegVersion),
      ffmpegVersion: ffmpegVersion || "Not found",
      ffprobeAvailable,
      imagemagickAvailable,
      comfyUiReachable,
      ollamaReachable,
      piperConfigured: Boolean(piperBin && fs6.existsSync(piperBin))
    }
  };
}
async function probeCommand(cmd, args) {
  try {
    const { stdout } = await execFileAsync4(cmd, args, { timeout: 2e3 });
    return stdout.split("\n")[0]?.trim() || "Installed";
  } catch {
    return null;
  }
}
async function probeBoolean(cmd, args) {
  return Boolean(await probeCommand(cmd, args));
}
async function probeHttp(baseUrl, suffix) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}${suffix}`, {
      signal: controller.signal
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}
function folderBytes(dir) {
  if (!fs6.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs6.readdirSync(dir, { withFileTypes: true })) {
    const full = path6.join(dir, entry.name);
    if (entry.isDirectory()) total += folderBytes(full);
    else if (entry.isFile()) total += fs6.statSync(full).size;
  }
  return total;
}
function clearUnusedCache() {
  if (!fs6.existsSync(CACHE_DIR)) return { removedFiles: 0 };
  const files = fs6.readdirSync(CACHE_DIR);
  for (const f of files) {
    const full = path6.join(CACHE_DIR, f);
    if (fs6.statSync(full).isFile()) fs6.unlinkSync(full);
  }
  return { removedFiles: files.length };
}

// server/workers/jobQueue.ts
import crypto4 from "node:crypto";
import fs12 from "node:fs";
import path11 from "node:path";

// server/engines/audioMixer.ts
import { execFile as execFile5 } from "node:child_process";
import fs7 from "node:fs";
import path7 from "node:path";
import { promisify as promisify5 } from "node:util";
var execFileAsync5 = promisify5(execFile5);
async function mixProjectAudio(manifest) {
  const projectDir = getProjectDir(manifest.projectId);
  const audioDir = path7.join(projectDir, "audio");
  fs7.mkdirSync(audioDir, { recursive: true });
  const mixedOut = path7.join(audioDir, "master_mix.wav");
  const duration = manifest.targetDurationSeconds;
  const narrationPath = manifest.voiceConfig.generatedNarrationPath && fs7.existsSync(manifest.voiceConfig.generatedNarrationPath) ? manifest.voiceConfig.generatedNarrationPath : null;
  const musicPath = manifest.audioConfig.backgroundMusicPath && fs7.existsSync(manifest.audioConfig.backgroundMusicPath) ? manifest.audioConfig.backgroundMusicPath : null;
  const bgTrackPath = musicPath || path7.join(audioDir, "ambient_bed.wav");
  if (!musicPath) {
    const fadeOutStart2 = Math.max(0.5, duration - manifest.audioConfig.fadeOutSeconds).toFixed(2);
    await execFileAsync5("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=110:duration=${duration}:sample_rate=44100`,
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=164.81:duration=${duration}:sample_rate=44100`,
      "-filter_complex",
      `[0:a][1:a]amix=inputs=2:weights=0.6 0.4,lowpass=f=420,volume=${manifest.audioConfig.ambientVolume},afade=t=in:st=0:d=${manifest.audioConfig.fadeInSeconds},afade=t=out:st=${fadeOutStart2}:d=${manifest.audioConfig.fadeOutSeconds}`,
      "-ar",
      "44100",
      "-ac",
      "2",
      "-c:a",
      "pcm_s16le",
      bgTrackPath
    ]);
  }
  if (!narrationPath) {
    await execFileAsync5("ffmpeg", [
      "-y",
      "-stream_loop",
      "-1",
      "-i",
      bgTrackPath,
      "-t",
      String(duration),
      "-af",
      `volume=${manifest.audioConfig.musicVolume},loudnorm=I=-16:TP=-1.5:LRA=11`,
      "-ar",
      "44100",
      "-ac",
      "2",
      "-c:a",
      "pcm_s16le",
      mixedOut
    ]);
    return mixedOut;
  }
  const fadeOutStart = Math.max(0.5, duration - manifest.audioConfig.fadeOutSeconds).toFixed(2);
  const musicVol = musicPath ? manifest.audioConfig.musicVolume : 0.65;
  const narVol = manifest.audioConfig.narrationVolume;
  const filterComplex = manifest.audioConfig.duckingEnabled ? `[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=${narVol},asplit=2[nar][sc];[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=${musicVol},afade=t=in:st=0:d=${manifest.audioConfig.fadeInSeconds},afade=t=out:st=${fadeOutStart}:d=${manifest.audioConfig.fadeOutSeconds}[mus];[mus][sc]sidechaincompress=threshold=0.02:ratio=4:attack=80:release=450[ducked];[nar][ducked]amix=inputs=2:duration=first:weights=1 0.9,loudnorm=I=-14:TP=-1.5:LRA=11[out]` : `[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=${narVol}[nar];[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=${musicVol},afade=t=in:st=0:d=${manifest.audioConfig.fadeInSeconds},afade=t=out:st=${fadeOutStart}:d=${manifest.audioConfig.fadeOutSeconds}[mus];[nar][mus]amix=inputs=2:duration=first:weights=1 0.9,loudnorm=I=-14:TP=-1.5:LRA=11[out]`;
  await execFileAsync5("ffmpeg", [
    "-y",
    "-i",
    narrationPath,
    "-stream_loop",
    "-1",
    "-i",
    bgTrackPath,
    "-filter_complex",
    filterComplex,
    "-map",
    "[out]",
    "-t",
    String(duration),
    "-ar",
    "44100",
    "-ac",
    "2",
    "-c:a",
    "pcm_s16le",
    mixedOut
  ]);
  return mixedOut;
}

// server/engines/qcEngine.ts
import { execFile as execFile6 } from "node:child_process";
import fs8 from "node:fs";
import { promisify as promisify6 } from "node:util";
var execFileAsync6 = promisify6(execFile6);
async function runQualityControl(manifest) {
  const checks = [];
  if (manifest.scenes.length === 0) {
    checks.push({
      category: "project",
      name: "Scene presence",
      status: "fail",
      details: "Project contains zero scenes."
    });
  } else {
    checks.push({
      category: "project",
      name: "Scene presence",
      status: "pass",
      details: `${manifest.scenes.length} scenes configured.`
    });
  }
  let missingShots = 0;
  let corruptShotFiles = 0;
  const expectedDim = getTargetDimensions(
    manifest.outputSettings.resolution,
    manifest.outputSettings.aspectRatio
  );
  for (const scene of manifest.scenes) {
    if (scene.shots.length === 0) {
      checks.push({
        category: "project",
        name: `Shots in ${scene.title}`,
        status: "fail",
        details: "Scene has zero shots.",
        target: scene.id
      });
      continue;
    }
    for (const shot of scene.shots) {
      if (!shot.imageAssetPath || !fs8.existsSync(shot.imageAssetPath)) {
        checks.push({
          category: "visual",
          name: `Storyboard image (${shot.id})`,
          status: "warn",
          details: "Shot storyboard image is missing on disk.",
          target: shot.id
        });
      }
      if (!shot.outputFile || !fs8.existsSync(shot.outputFile)) {
        missingShots++;
      } else {
        const size = fs8.statSync(shot.outputFile).size;
        if (size < 1024) corruptShotFiles++;
      }
    }
  }
  checks.push({
    category: "visual",
    name: "Rendered shot clips",
    status: missingShots === 0 && corruptShotFiles === 0 ? "pass" : "fail",
    details: missingShots === 0 && corruptShotFiles === 0 ? "All shot MP4 files exist and are non-empty." : `${missingShots} missing, ${corruptShotFiles} corrupt shot clips.`
  });
  if (manifest.subtitles.length === 0) {
    checks.push({
      category: "subtitle",
      name: "Subtitle entries",
      status: "warn",
      details: "No subtitle entries generated yet."
    });
  } else {
    let overlaps = 0;
    let longLines = 0;
    let invalidTimes = 0;
    const maxLen = manifest.outputSettings.subtitleStyle.maxCharsPerLine || 44;
    for (let i = 0; i < manifest.subtitles.length; i++) {
      const sub = manifest.subtitles[i];
      if (sub.endTime <= sub.startTime) invalidTimes++;
      if (i > 0 && sub.startTime < manifest.subtitles[i - 1].endTime - 0.01) overlaps++;
      for (const line of sub.text.split("\n")) {
        if (line.length > maxLen + 8) longLines++;
      }
    }
    checks.push({
      category: "subtitle",
      name: "Subtitle timing & overlap check",
      status: invalidTimes === 0 && overlaps === 0 ? "pass" : "fail",
      details: invalidTimes === 0 && overlaps === 0 ? `${manifest.subtitles.length} cues validated with zero overlaps.` : `${invalidTimes} invalid timestamps, ${overlaps} overlapping cues.`
    });
    checks.push({
      category: "subtitle",
      name: "Subtitle line length",
      status: longLines === 0 ? "pass" : "warn",
      details: longLines === 0 ? "All lines fit within readable character limit." : `${longLines} lines exceed configured character limit.`
    });
  }
  const masterMix = manifest.audioConfig.mixedAudioPath;
  if (!masterMix || !fs8.existsSync(masterMix)) {
    checks.push({
      category: "audio",
      name: "Master audio mix",
      status: "warn",
      details: "Mixed audio track not found."
    });
  } else {
    try {
      const { stderr } = await execFileAsync6("ffmpeg", [
        "-i",
        masterMix,
        "-af",
        "volumedetect",
        "-f",
        "null",
        "-"
      ]);
      const maxVolMatch = stderr.match(/max_volume:\s*([-\d.]+)\s*dB/);
      const meanVolMatch = stderr.match(/mean_volume:\s*([-\d.]+)\s*dB/);
      const maxVol = maxVolMatch ? Number(maxVolMatch[1]) : -1;
      const meanVol = meanVolMatch ? Number(meanVolMatch[1]) : -20;
      if (meanVol < -55) {
        checks.push({
          category: "audio",
          name: "Audio loudness & silence",
          status: "warn",
          details: `Audio track is nearly silent (mean ${meanVol} dB).`
        });
      } else if (maxVol > -0.1) {
        checks.push({
          category: "audio",
          name: "Audio clipping check",
          status: "warn",
          details: `Peak volume near 0 dB (${maxVol} dB); slight clipping risk.`
        });
      } else {
        checks.push({
          category: "audio",
          name: "Audio loudness & clipping",
          status: "pass",
          details: `Mean ${meanVol} dB, peak ${maxVol} dB (clean headroom).`
        });
      }
    } catch {
      checks.push({
        category: "audio",
        name: "Audio stream inspection",
        status: "warn",
        details: "Could not run volumedetect on master mix."
      });
    }
  }
  let mediaProbe;
  const finalMp4 = manifest.exports.landscapeMp4;
  if (!finalMp4 || !fs8.existsSync(finalMp4)) {
    checks.push({
      category: "visual",
      name: "Final MP4 export",
      status: "fail",
      details: "Final assembled MP4 does not exist yet."
    });
  } else {
    try {
      const { stdout } = await execFileAsync6("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration,size:stream=codec_type,width,height,r_frame_rate",
        "-of",
        "json",
        finalMp4
      ]);
      const data = JSON.parse(stdout);
      const videoStream = data.streams?.find((s) => s.codec_type === "video");
      const audioStream = data.streams?.find((s) => s.codec_type === "audio");
      const dur = Number(data.format?.duration || 0);
      const sizeBytes = Number(data.format?.size || 0);
      const fpsParts = (videoStream?.r_frame_rate || "24/1").split("/");
      const fps = Number(fpsParts[0]) / Math.max(1, Number(fpsParts[1] || 1));
      mediaProbe = {
        durationSeconds: Number(dur.toFixed(2)),
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
        fps: Number(fps.toFixed(2)),
        hasVideo: Boolean(videoStream),
        hasAudio: Boolean(audioStream),
        fileSizeBytes: sizeBytes
      };
      const dimOk = mediaProbe.width === expectedDim.width && mediaProbe.height === expectedDim.height;
      checks.push({
        category: "visual",
        name: "Output dimensions & aspect ratio",
        status: dimOk ? "pass" : "warn",
        details: `Actual ${mediaProbe.width}x${mediaProbe.height} @ ${mediaProbe.fps}fps (expected ${expectedDim.width}x${expectedDim.height}).`
      });
      const durDiff = Math.abs(dur - manifest.targetDurationSeconds);
      checks.push({
        category: "audio",
        name: "Audio/video target duration sync",
        status: durDiff <= 3 ? "pass" : "warn",
        details: `Rendered ${dur.toFixed(2)}s vs target ${manifest.targetDurationSeconds}s (delta ${durDiff.toFixed(2)}s).`
      });
      const { stderr: blackErr } = await execFileAsync6("ffmpeg", [
        "-i",
        finalMp4,
        "-vf",
        "blackdetect=d=1.2:pix_th=0.10",
        "-an",
        "-f",
        "null",
        "-"
      ]);
      const blackMatches = blackErr.match(/black_duration:([\d.]+)/g) || [];
      checks.push({
        category: "visual",
        name: "Extended black-frame detection",
        status: blackMatches.length === 0 ? "pass" : "warn",
        details: blackMatches.length === 0 ? "No unintended black segments (>=1.2s) detected." : `${blackMatches.length} extended black segment(s) detected.`
      });
    } catch (err) {
      checks.push({
        category: "visual",
        name: "Final MP4 probe",
        status: "fail",
        details: err instanceof Error ? err.message : "Failed to probe final video."
      });
    }
  }
  const passed = checks.filter((c) => c.status === "pass").length;
  const warnings = checks.filter((c) => c.status === "warn").length;
  const failed = checks.filter((c) => c.status === "fail").length;
  const overallStatus = failed > 0 ? "fail" : warnings > 0 ? "warn" : "pass";
  const report = {
    projectId: manifest.projectId,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    overallStatus,
    summary: { passed, warnings, failed },
    checks,
    mediaProbe
  };
  saveQCReport(report);
  return report;
}

// server/engines/subtitleEngine.ts
import fs9 from "node:fs";
import path8 from "node:path";
function buildSubtitleEntries(manifest) {
  const entries = [];
  const maxChars = manifest.outputSettings.subtitleStyle.maxCharsPerLine || 44;
  const lang = manifest.outputSettings.subtitleLanguage || "en";
  let idx = 1;
  for (const scene of manifest.scenes) {
    for (const shot of scene.shots) {
      const rawText = (shot.subtitleSegment || shot.narrationSegment || "").trim();
      if (!rawText) continue;
      const chunks = splitCaptionChunks(rawText, maxChars * 2);
      const chunkDur = shot.duration / Math.max(1, chunks.length);
      for (let i = 0; i < chunks.length; i++) {
        const startTime = Number((shot.startTime + i * chunkDur).toFixed(3));
        const endTime = Number(
          Math.max(startTime + 0.4, shot.startTime + (i + 1) * chunkDur - 0.04).toFixed(3)
        );
        entries.push({
          index: idx++,
          startTime,
          endTime: Math.min(endTime, shot.endTime),
          text: wrapLines(chunks[i], maxChars),
          language: lang
        });
      }
    }
  }
  return entries;
}
function exportSubtitlesToFiles(manifest, entries) {
  const projectDir = getProjectDir(manifest.projectId);
  const subDir = path8.join(projectDir, "subtitles");
  fs9.mkdirSync(subDir, { recursive: true });
  const srtPath = path8.join(subDir, "subtitles.srt");
  const vttPath = path8.join(subDir, "subtitles.vtt");
  const assPath = path8.join(subDir, "subtitles.ass");
  fs9.writeFileSync(srtPath, formatSRT(entries), "utf8");
  fs9.writeFileSync(vttPath, formatVTT(entries), "utf8");
  fs9.writeFileSync(assPath, formatASS(entries, manifest.outputSettings.subtitleStyle), "utf8");
  return { srtPath, vttPath, assPath };
}
function formatSRT(entries) {
  return entries.map(
    (e) => `${e.index}
${toSrtTimestamp(e.startTime)} --> ${toSrtTimestamp(e.endTime)}
${e.text}`
  ).join("\n\n") + "\n";
}
function formatVTT(entries) {
  const body = entries.map(
    (e) => `${toVttTimestamp(e.startTime)} --> ${toVttTimestamp(e.endTime)}
${e.text}`
  ).join("\n\n");
  return `WEBVTT

${body}
`;
}
function formatASS(entries, style) {
  const alignment = style.position === "top" ? 8 : style.position === "center" ? 5 : 2;
  const primaryColor = hexToAssColor(style.color || "#FFFFFF");
  const backAlpha = Math.round((1 - (style.backgroundOpacity ?? 0.55)) * 255).toString(16).padStart(2, "0").toUpperCase();
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.font || "Arial"},${style.size || 24},${primaryColor},&H000000FF,&H00000000,&H${backAlpha}000000,0,0,0,0,100,100,0,0,1,${style.outlineWidth ?? 2},1,${alignment},24,24,28,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const lines = entries.map(
    (e) => `Dialogue: 0,${toAssTimestamp(e.startTime)},${toAssTimestamp(e.endTime)},Default,,0,0,0,,${e.text.replace(/\n/g, "\\N")}`
  );
  return header + lines.join("\n") + "\n";
}
function splitCaptionChunks(text, maxChars) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let buf = "";
  for (const w of words) {
    if ((buf + " " + w).trim().length > maxChars && buf.length > 0) {
      chunks.push(buf.trim());
      buf = w;
    } else {
      buf = (buf + " " + w).trim();
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.length > 0 ? chunks : [text];
}
function wrapLines(text, maxLineLen) {
  if (text.length <= maxLineLen) return text;
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > maxLineLen && line) {
      lines.push(line.trim());
      line = w;
    } else {
      line = (line + " " + w).trim();
    }
  }
  if (line) lines.push(line.trim());
  return lines.slice(0, 2).join("\n");
}
function toSrtTimestamp(sec) {
  const totalMs = Math.max(0, Math.round(sec * 1e3));
  const h = Math.floor(totalMs / 36e5);
  const m = Math.floor(totalMs % 36e5 / 6e4);
  const s = Math.floor(totalMs % 6e4 / 1e3);
  const ms = totalMs % 1e3;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}
function toVttTimestamp(sec) {
  return toSrtTimestamp(sec).replace(",", ".");
}
function toAssTimestamp(sec) {
  const csTotal = Math.max(0, Math.round(sec * 100));
  const h = Math.floor(csTotal / 36e4);
  const m = Math.floor(csTotal % 36e4 / 6e3);
  const s = Math.floor(csTotal % 6e3 / 100);
  const cs = csTotal % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
function hexToAssColor(hex) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "&H00FFFFFF";
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

// server/providers/animationProvider.ts
import crypto3 from "node:crypto";
import { execFile as execFile7 } from "node:child_process";
import fs10 from "node:fs";
import path9 from "node:path";
import { promisify as promisify7 } from "node:util";
var execFileAsync7 = promisify7(execFile7);
var DeterministicFFmpegAnimationProvider = class {
  constructor() {
    this.id = "ffmpeg-deterministic";
  }
  async animate(req) {
    const start = Date.now();
    fs10.mkdirSync(path9.dirname(req.outputPath), { recursive: true });
    if (!fs10.existsSync(req.imagePath)) {
      return {
        success: false,
        providerUsed: this.id,
        durationMs: Date.now() - start,
        outputFile: req.outputPath,
        fromCache: false,
        usedFallback: false,
        errorMessage: `Source image does not exist: ${req.imagePath}`
      };
    }
    const imageDigest = crypto3.createHash("sha256").update(fs10.readFileSync(req.imagePath)).digest("hex").slice(0, 16);
    const hash = computeGenerationHash({
      provider: this.id,
      imageDigest,
      duration: req.durationSeconds,
      fps: req.fps,
      w: req.width,
      h: req.height,
      motionSpec: req.motionSpec
    });
    const cached = getCachedFile(hash, "mp4");
    if (cached) {
      fs10.copyFileSync(cached, req.outputPath);
      return {
        success: true,
        providerUsed: this.id,
        durationMs: Date.now() - start,
        outputFile: req.outputPath,
        fromCache: true,
        usedFallback: false
      };
    }
    try {
      const totalFrames = Math.max(12, Math.round(req.durationSeconds * req.fps));
      const speedMul = req.motionSpec.cameraSpeed === "fast" ? 2 : req.motionSpec.cameraSpeed === "medium" ? 1.35 : 0.8;
      const preW = Math.round(req.width * 1.35);
      const preH = Math.round(req.height * 1.35);
      let motionFilter = "";
      const cam = req.motionSpec.camera;
      if (cam === "zoom_in") {
        const step = (14e-4 * speedMul).toFixed(5);
        motionFilter = `scale=${preW}:${preH}:force_original_aspect_ratio=increase,crop=${preW}:${preH},zoompan=z='min(zoom+${step},1.32)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${req.width}x${req.height}:fps=${req.fps}`;
      } else if (cam === "zoom_out") {
        const step = (14e-4 * speedMul).toFixed(5);
        motionFilter = `scale=${preW}:${preH}:force_original_aspect_ratio=increase,crop=${preW}:${preH},zoompan=z='if(lte(on,1),1.28,max(1.0,zoom-${step}))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${req.width}x${req.height}:fps=${req.fps}`;
      } else if (cam === "pan_left") {
        motionFilter = `scale=${preW}:${preH}:force_original_aspect_ratio=increase,crop=${preW}:${preH},zoompan=z='1.18':x='max(0,(iw-iw/zoom)*(1-on/${totalFrames}))':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${req.width}x${req.height}:fps=${req.fps}`;
      } else if (cam === "pan_right") {
        motionFilter = `scale=${preW}:${preH}:force_original_aspect_ratio=increase,crop=${preW}:${preH},zoompan=z='1.18':x='min(iw-iw/zoom,(iw-iw/zoom)*(on/${totalFrames}))':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${req.width}x${req.height}:fps=${req.fps}`;
      } else if (cam === "tilt_up") {
        motionFilter = `scale=${preW}:${preH}:force_original_aspect_ratio=increase,crop=${preW}:${preH},zoompan=z='1.18':x='iw/2-(iw/zoom/2)':y='max(0,(ih-ih/zoom)*(1-on/${totalFrames}))':d=${totalFrames}:s=${req.width}x${req.height}:fps=${req.fps}`;
      } else if (cam === "tilt_down") {
        motionFilter = `scale=${preW}:${preH}:force_original_aspect_ratio=increase,crop=${preW}:${preH},zoompan=z='1.18':x='iw/2-(iw/zoom/2)':y='min(ih-ih/zoom,(ih-ih/zoom)*(on/${totalFrames}))':d=${totalFrames}:s=${req.width}x${req.height}:fps=${req.fps}`;
      } else if (cam === "parallax") {
        const shift = (12e-4 * speedMul).toFixed(5);
        motionFilter = `scale=${preW}:${preH}:force_original_aspect_ratio=increase,crop=${preW}:${preH},zoompan=z='min(1.24,1.06+${shift}*on)':x='(iw-iw/zoom)*0.5+sin(on/18)*18':y='(ih-ih/zoom)*0.5':d=${totalFrames}:s=${req.width}x${req.height}:fps=${req.fps}`;
      } else {
        motionFilter = `scale=${req.width}:${req.height}:force_original_aspect_ratio=increase,crop=${req.width}:${req.height},fps=${req.fps}`;
      }
      const postFilters = [motionFilter];
      if (req.motionSpec.cameraShake || cam === "shake") {
        postFilters.push(
          `crop=w=${req.width - 16}:h=${req.height - 16}:x='8+6*sin(n*1.9)':y='8+5*cos(n*2.3)',scale=${req.width}:${req.height}`
        );
      }
      const weather = req.motionSpec.weather;
      const fx = new Set(req.motionSpec.effects || []);
      if (weather === "fog" || fx.has("smoke")) {
        postFilters.push(`eq=contrast=0.94:brightness=0.04:saturation=0.88`);
      }
      if (fx.has("glow") || fx.has("light_rays")) {
        postFilters.push(`eq=brightness=0.05:saturation=1.12`);
      }
      if (fx.has("fire")) {
        postFilters.push(`colorbalance=rs=0.08:gs=0.02:bs=-0.06`);
      }
      if (weather === "rain" || weather === "storm") {
        postFilters.push(`eq=brightness=-0.05:contrast=1.08:saturation=0.85,noise=alls=14:allf=t`);
      }
      if (weather === "snow") {
        postFilters.push(`eq=brightness=0.05:saturation=0.82,noise=alls=8:allf=t`);
      }
      if (fx.has("lightning") || weather === "storm") {
        const t1 = (req.durationSeconds * 0.35).toFixed(2);
        const t2 = (req.durationSeconds * 0.72).toFixed(2);
        postFilters.push(
          `eq=brightness='if(between(t,${t1},${Number(t1) + 0.14})+between(t,${t2},${Number(t2) + 0.12}),0.42,0)'`
        );
      }
      if (req.motionSpec.motionBlur) {
        postFilters.push(`tblend=all_mode=average`);
      }
      const fadeDur = Math.min(0.6, req.durationSeconds * 0.15);
      if (req.motionSpec.transitionIn !== "cut") {
        postFilters.push(`fade=t=in:st=0:d=${fadeDur.toFixed(2)}`);
      }
      if (req.motionSpec.transitionOut !== "cut") {
        const outStart = Math.max(0, req.durationSeconds - fadeDur).toFixed(2);
        postFilters.push(`fade=t=out:st=${outStart}:d=${fadeDur.toFixed(2)}`);
      }
      postFilters.push("format=yuv420p");
      const vf = postFilters.join(",");
      await execFileAsync7(
        "ffmpeg",
        [
          "-y",
          "-loop",
          "1",
          "-t",
          String(req.durationSeconds),
          "-i",
          req.imagePath,
          "-vf",
          vf,
          "-t",
          String(req.durationSeconds),
          "-r",
          String(req.fps),
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "23",
          "-an",
          req.outputPath
        ],
        { timeout: 6e4 }
      );
      storeCachedFile(hash, "mp4", req.outputPath);
      return {
        success: true,
        providerUsed: this.id,
        durationMs: Date.now() - start,
        outputFile: req.outputPath,
        fromCache: false,
        usedFallback: false
      };
    } catch (err) {
      return {
        success: false,
        providerUsed: this.id,
        durationMs: Date.now() - start,
        outputFile: req.outputPath,
        fromCache: false,
        usedFallback: false,
        errorMessage: err instanceof Error ? err.message : String(err)
      };
    }
  }
};
async function animateShot(req) {
  const det = new DeterministicFFmpegAnimationProvider();
  if (req.method === "deterministic") {
    return det.animate(req);
  }
  const comfyUrl = process.env.COMFYUI_API_URL || "http://127.0.0.1:8188";
  let comfyUp = false;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 1e3);
    const res = await fetch(`${comfyUrl}/system_stats`, { signal: controller.signal });
    clearTimeout(t);
    comfyUp = res.ok;
  } catch {
    comfyUp = false;
  }
  if (!comfyUp) {
    const fallbackRes = await det.animate(req);
    return {
      ...fallbackRes,
      usedFallback: true,
      providerUsed: `${det.id} (fallback: generative server offline)`
    };
  }
  if (req.durationSeconds > 4 && process.env.LOW_VRAM_MODE !== "false") {
    const fallbackRes = await det.animate(req);
    return {
      ...fallbackRes,
      usedFallback: true,
      providerUsed: `${det.id} (low-VRAM guard >4s)`
    };
  }
  return det.animate(req);
}

// server/providers/imageProvider.ts
import { execFile as execFile8 } from "node:child_process";
import fs11 from "node:fs";
import path10 from "node:path";
import { promisify as promisify8 } from "node:util";
var execFileAsync8 = promisify8(execFile8);
var ComfyUIImageProvider = class {
  constructor(baseUrl = process.env.COMFYUI_API_URL || "http://127.0.0.1:8188") {
    this.id = "comfyui";
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }
  async isAvailable() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${this.baseUrl}/system_stats`, { signal: controller.signal });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  }
  async generate(req) {
    const start = Date.now();
    const available = await this.isAvailable();
    if (!available) {
      return {
        success: false,
        modelUsed: "comfyui-unavailable",
        durationMs: Date.now() - start,
        outputFile: req.outputPath,
        fromCache: false,
        errorMessage: `ComfyUI server not reachable at ${this.baseUrl}. Falling back to procedural/imported asset pipeline.`
      };
    }
    const workflow = {
      "3": {
        class_type: "KSampler",
        inputs: {
          seed: req.seed,
          steps: 20,
          cfg: 7,
          sampler_name: "euler",
          scheduler: "normal",
          denoise: 1,
          model: ["4", 0],
          positive: ["6", 0],
          negative: ["7", 0],
          latent_image: ["5", 0]
        }
      },
      "4": {
        class_type: "CheckpointLoaderSimple",
        inputs: { ckpt_name: "v1-5-pruned-emaonly.safetensors" }
      },
      "5": {
        class_type: "EmptyLatentImage",
        inputs: { width: Math.min(768, req.width), height: Math.min(768, req.height), batch_size: 1 }
      },
      "6": {
        class_type: "CLIPTextEncode",
        inputs: { text: req.prompt, clip: ["4", 1] }
      },
      "7": {
        class_type: "CLIPTextEncode",
        inputs: { text: req.negativePrompt, clip: ["4", 1] }
      },
      "8": {
        class_type: "VAEDecode",
        inputs: { samples: ["3", 0], vae: ["4", 2] }
      },
      "9": {
        class_type: "SaveImage",
        inputs: { filename_prefix: "frameforge", images: ["8", 0] }
      }
    };
    try {
      const submitRes = await fetch(`${this.baseUrl}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: workflow })
      });
      if (!submitRes.ok) {
        throw new Error(`ComfyUI rejected prompt (${submitRes.status})`);
      }
      const { prompt_id } = await submitRes.json();
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const histRes = await fetch(`${this.baseUrl}/history/${prompt_id}`);
        if (!histRes.ok) continue;
        const hist = await histRes.json();
        const item = hist[prompt_id];
        const img = item?.outputs?.["9"]?.images?.[0];
        if (img) {
          const viewUrl = `${this.baseUrl}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${encodeURIComponent(img.type)}`;
          const imgBuf = Buffer.from(await (await fetch(viewUrl)).arrayBuffer());
          fs11.mkdirSync(path10.dirname(req.outputPath), { recursive: true });
          fs11.writeFileSync(req.outputPath, imgBuf);
          return {
            success: true,
            modelUsed: "comfyui-sd15",
            durationMs: Date.now() - start,
            outputFile: req.outputPath,
            fromCache: false
          };
        }
      }
      throw new Error("ComfyUI generation timed out.");
    } catch (err) {
      return {
        success: false,
        modelUsed: "comfyui-sd15",
        durationMs: Date.now() - start,
        outputFile: req.outputPath,
        fromCache: false,
        errorMessage: err instanceof Error ? err.message : String(err)
      };
    }
  }
};
var ProceduralPlateImageProvider = class {
  constructor() {
    this.id = "procedural";
  }
  async isAvailable() {
    return true;
  }
  async generate(req) {
    const start = Date.now();
    fs11.mkdirSync(path10.dirname(req.outputPath), { recursive: true });
    const validRef = req.referenceImages.find((p) => p && fs11.existsSync(p));
    const hash = computeGenerationHash({
      provider: this.id,
      prompt: req.prompt,
      ref: validRef ? path10.basename(validRef) : "none",
      w: req.width,
      h: req.height,
      seed: req.seed,
      palette: req.palette || []
    });
    const cached = getCachedFile(hash, "png");
    if (cached) {
      fs11.copyFileSync(cached, req.outputPath);
      return {
        success: true,
        modelUsed: "procedural-compositor-v1",
        durationMs: Date.now() - start,
        outputFile: req.outputPath,
        fromCache: true
      };
    }
    try {
      const palette = derivePalette(req.seed, req.palette);
      const args = [
        "-size",
        `${req.width}x${req.height}`,
        `gradient:${palette.top}-${palette.bottom}`,
        // Radial atmospheric glow
        "(",
        "-size",
        `${req.width}x${req.height}`,
        `radial-gradient:${palette.accent}-none`,
        ")",
        "-compose",
        "screen",
        "-composite"
      ];
      const horizonY = Math.round(req.height * 0.64);
      const ridgePath = `M 0,${req.height} L 0,${horizonY + 30} L ${Math.round(req.width * 0.18)},${horizonY - 40} L ${Math.round(req.width * 0.36)},${horizonY + 15} L ${Math.round(req.width * 0.54)},${horizonY - 65} L ${Math.round(req.width * 0.76)},${horizonY + 10} L ${req.width},${horizonY - 25} L ${req.width},${req.height} Z`;
      args.push(
        "-fill",
        palette.silhouette,
        "-draw",
        `path '${ridgePath}'`
      );
      if (validRef) {
        const refSizeW = Math.round(req.width * 0.44);
        const refSizeH = Math.round(req.height * 0.76);
        args.push(
          "(",
          validRef,
          "-resize",
          `${refSizeW}x${refSizeH}`,
          ")",
          "-gravity",
          "center",
          "-compose",
          "over",
          "-composite"
        );
      }
      if (!validRef && req.label) {
        args.push(
          "-gravity",
          "south",
          "-fill",
          "rgba(10,14,23,0.58)",
          "-draw",
          `rectangle 0,${req.height - 96} ${req.width},${req.height}`,
          "-fill",
          "#F8FAFC",
          "-pointsize",
          String(Math.max(18, Math.round(req.height * 0.03))),
          "-annotate",
          "+0+34",
          req.label.slice(0, 72)
        );
      }
      args.push(req.outputPath);
      await execFileAsync8("convert", args, { timeout: 15e3 });
      storeCachedFile(hash, "png", req.outputPath);
      return {
        success: true,
        modelUsed: "procedural-compositor-v1",
        durationMs: Date.now() - start,
        outputFile: req.outputPath,
        fromCache: false
      };
    } catch (err) {
      try {
        await execFileAsync8("ffmpeg", [
          "-y",
          "-f",
          "lavfi",
          "-i",
          `color=c=0x1e293b:s=${req.width}x${req.height}:d=1`,
          "-frames:v",
          "1",
          req.outputPath
        ]);
        return {
          success: true,
          modelUsed: "ffmpeg-plate-fallback",
          durationMs: Date.now() - start,
          outputFile: req.outputPath,
          fromCache: false
        };
      } catch (e2) {
        return {
          success: false,
          modelUsed: "procedural-compositor-v1",
          durationMs: Date.now() - start,
          outputFile: req.outputPath,
          fromCache: false,
          errorMessage: err instanceof Error ? err.message : String(e2)
        };
      }
    }
  }
};
function derivePalette(seed, custom) {
  if (custom && custom.length >= 2) {
    return {
      top: custom[0],
      bottom: custom[1],
      accent: custom[2] || "#d97706",
      silhouette: "#090d16"
    };
  }
  const palettes = [
    { top: "#0f172a", bottom: "#334155", accent: "#c2410c", silhouette: "#070b14" },
    { top: "#1e1b4b", bottom: "#4c1d95", accent: "#f59e0b", silhouette: "#0d091f" },
    { top: "#14261c", bottom: "#2d4a3e", accent: "#eab308", silhouette: "#08120c" },
    { top: "#2b1313", bottom: "#6b211a", accent: "#fb923c", silhouette: "#140707" },
    { top: "#0c1e2e", bottom: "#1e425e", accent: "#38bdf8", silhouette: "#060f18" }
  ];
  return palettes[Math.abs(seed) % palettes.length];
}
async function generateImageWithFallback(preferredProvider, req) {
  if (preferredProvider === "comfyui") {
    const comfy = new ComfyUIImageProvider();
    const res = await comfy.generate(req);
    if (res.success) return res;
  }
  const procedural = new ProceduralPlateImageProvider();
  return procedural.generate(req);
}

// server/workers/jobQueue.ts
var SequentialJobQueue = class {
  constructor() {
    this.isProcessing = false;
    this.cancelledIds = /* @__PURE__ */ new Set();
  }
  enqueue(params) {
    const job = {
      id: `job-${crypto4.randomBytes(6).toString("hex")}`,
      projectId: params.projectId,
      sceneId: params.sceneId ?? null,
      shotId: params.shotId ?? null,
      jobType: params.jobType,
      priority: params.priority ?? 5,
      status: "pending",
      progress: 0,
      message: "Queued for sequential execution",
      retryCount: 0,
      maxRetries: 2,
      errorMessage: null,
      outputFile: null,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      startedAt: null,
      completedAt: null
    };
    insertJob(job);
    writeEngineLog(`Enqueued ${job.jobType} (${job.id}) for project ${job.projectId}`);
    void this.kick();
    return job;
  }
  cancel(jobId) {
    this.cancelledIds.add(jobId);
    const updated = updateJob(jobId, {
      status: "cancelled",
      message: "Cancelled by user",
      completedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    writeEngineLog(`Cancelled job ${jobId}`);
    return updated;
  }
  retry(jobId) {
    const job = getJob(jobId);
    if (!job) return null;
    this.cancelledIds.delete(jobId);
    const updated = updateJob(jobId, {
      status: "pending",
      progress: 0,
      errorMessage: null,
      message: "Re-queued manually by user",
      completedAt: null
    });
    void this.kick();
    return updated;
  }
  async kick() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      while (true) {
        const pending = listJobs().filter((j) => j.status === "pending").sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt));
        if (pending.length === 0) break;
        const job = pending[0];
        if (this.cancelledIds.has(job.id)) {
          updateJob(job.id, { status: "cancelled", completedAt: (/* @__PURE__ */ new Date()).toISOString() });
          continue;
        }
        await this.executeJob(job);
      }
    } finally {
      this.isProcessing = false;
    }
  }
  async executeJob(job) {
    updateJob(job.id, {
      status: "running",
      progress: 5,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      message: `Starting ${job.jobType}...`
    });
    const handlers = {
      generate_assets: handleGenerateAssets,
      generate_narration: handleGenerateNarration,
      generate_subtitles: handleGenerateSubtitles,
      animate_shot: handleAnimateSingleShot,
      generate_video: handleFullVideoPipeline,
      run_qc: handleRunQC
    };
    const handler = handlers[job.jobType];
    if (!handler) {
      updateJob(job.id, {
        status: "failed",
        errorMessage: `Unknown job type: ${job.jobType}`,
        completedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      return;
    }
    try {
      await handler(job);
      if (!this.cancelledIds.has(job.id)) {
        const fresh = getJob(job.id);
        if (fresh && fresh.status !== "failed" && fresh.status !== "cancelled") {
          updateJob(job.id, {
            status: "completed",
            progress: 100,
            completedAt: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      writeEngineLog(`Job ${job.id} (${job.jobType}) failed: ${msg}`);
      const current = getJob(job.id);
      if (current && current.retryCount < current.maxRetries && !this.cancelledIds.has(job.id)) {
        updateJob(job.id, {
          status: "pending",
          retryCount: current.retryCount + 1,
          errorMessage: msg,
          message: `Transient failure, retrying (${current.retryCount + 1}/${current.maxRetries})...`
        });
      } else {
        updateJob(job.id, {
          status: "failed",
          errorMessage: msg,
          message: `Failed: ${msg}`,
          completedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
  }
};
var jobQueue = new SequentialJobQueue();
async function handleGenerateAssets(job) {
  const manifest = requireManifest(job.projectId);
  const synced = applyCharacterAndEnvironmentConsistency(manifest);
  const projectDir = getProjectDir(manifest.projectId);
  const dim = getTargetDimensions(
    synced.outputSettings.resolution,
    synced.outputSettings.aspectRatio
  );
  const totalShots = synced.scenes.reduce((a, s) => a + s.shots.length, 0) || 1;
  let done = 0;
  for (const scene of synced.scenes) {
    const env = synced.environments.find((e) => e.id === scene.environmentId);
    for (const shot of scene.shots) {
      if (shot.imageAssetPath && fs12.existsSync(shot.imageAssetPath) && fs12.statSync(shot.imageAssetPath).size > 512) {
        done++;
        continue;
      }
      const outImg = path11.join(projectDir, "storyboard", `${shot.id}.png`);
      const res = await generateImageWithFallback(synced.generationSettings.imageProvider, {
        prompt: shot.positivePrompt,
        negativePrompt: shot.negativePrompt,
        referenceImages: shot.referenceImages,
        width: dim.width,
        height: dim.height,
        seed: shot.seed,
        outputPath: outImg,
        label: `${scene.title} \xB7 Shot ${shot.shotNumber}`,
        palette: env?.colorPalette
      });
      if (!res.success) {
        throw new Error(res.errorMessage || `Image generation failed for ${shot.id}`);
      }
      shot.imageAssetPath = res.outputFile;
      registerAsset({
        id: `img-${shot.id}`,
        projectId: synced.projectId,
        assetType: "storyboard_image",
        filePath: res.outputFile,
        prompt: shot.positivePrompt,
        model: res.modelUsed,
        seed: shot.seed,
        qualityStatus: "ready"
      });
      done++;
      updateJob(job.id, {
        progress: Math.min(95, Math.round(done / totalShots * 90)),
        message: `Generated storyboard image ${done}/${totalShots} (${res.fromCache ? "cache hit" : res.modelUsed})`
      });
    }
  }
  synced.stage = "storyboard_ready";
  saveManifest(synced);
  updateJob(job.id, {
    progress: 100,
    message: `Prepared ${done} storyboard image assets.`
  });
}
async function handleAnimateSingleShot(job) {
  const manifest = requireManifest(job.projectId);
  const projectDir = getProjectDir(manifest.projectId);
  const dim = getTargetDimensions(
    manifest.outputSettings.resolution,
    manifest.outputSettings.aspectRatio
  );
  for (const scene of manifest.scenes) {
    for (const shot of scene.shots) {
      if (shot.id !== job.shotId) continue;
      if (!shot.imageAssetPath || !fs12.existsSync(shot.imageAssetPath)) {
        const outImg = path11.join(projectDir, "storyboard", `${shot.id}.png`);
        const imgRes = await generateImageWithFallback(manifest.generationSettings.imageProvider, {
          prompt: shot.positivePrompt,
          negativePrompt: shot.negativePrompt,
          referenceImages: shot.referenceImages,
          width: dim.width,
          height: dim.height,
          seed: shot.seed,
          outputPath: outImg,
          label: `${scene.title} \xB7 Shot ${shot.shotNumber}`
        });
        shot.imageAssetPath = imgRes.outputFile;
      }
      const shotOut = path11.join(projectDir, "shots", `${shot.id}.mp4`);
      if (fs12.existsSync(shotOut)) fs12.unlinkSync(shotOut);
      const animRes = await animateShot({
        imagePath: shot.imageAssetPath,
        durationSeconds: shot.duration,
        fps: manifest.outputSettings.fps,
        width: dim.width,
        height: dim.height,
        motionSpec: shot.motionSpec,
        outputPath: shotOut,
        method: shot.generationMethod
      });
      if (!animRes.success) {
        shot.status = "failed";
        shot.error = animRes.errorMessage;
        saveManifest(manifest);
        throw new Error(animRes.errorMessage || `Animation failed for ${shot.id}`);
      }
      shot.outputFile = animRes.outputFile;
      shot.animationModel = animRes.providerUsed;
      shot.status = "completed";
      shot.error = void 0;
      saveManifest(manifest);
      updateJob(job.id, {
        progress: 100,
        outputFile: animRes.outputFile,
        message: `Rendered shot ${shot.id} via ${animRes.providerUsed}`
      });
      return;
    }
  }
  throw new Error(`Shot ${job.shotId} not found in project.`);
}
async function handleGenerateNarration(job) {
  const manifest = requireManifest(job.projectId);
  updateJob(job.id, { progress: 25, message: "Synthesizing scene-aligned narration..." });
  const res = await generateProjectNarration(manifest);
  res.manifest.stage = "audio_generated";
  saveManifest(res.manifest);
  registerAsset({
    id: `narration-${manifest.projectId}`,
    projectId: manifest.projectId,
    assetType: "narration_master",
    filePath: res.narrationMp3Path,
    model: res.engineUsed,
    qualityStatus: "ready"
  });
  updateJob(job.id, {
    progress: 100,
    outputFile: res.narrationMp3Path,
    message: `Narration generated via ${res.engineUsed}`
  });
}
async function handleGenerateSubtitles(job) {
  const manifest = requireManifest(job.projectId);
  updateJob(job.id, { progress: 30, message: "Aligning subtitle cues..." });
  const entries = buildSubtitleEntries(manifest);
  const files = exportSubtitlesToFiles(manifest, entries);
  manifest.subtitles = entries;
  manifest.exports = {
    ...manifest.exports,
    srtPath: files.srtPath,
    vttPath: files.vttPath,
    assPath: files.assPath
  };
  saveManifest(manifest);
  updateJob(job.id, {
    progress: 100,
    outputFile: files.srtPath,
    message: `Generated ${entries.length} synchronized cues (SRT, VTT, ASS).`
  });
}
async function handleFullVideoPipeline(job) {
  let manifest = applyCharacterAndEnvironmentConsistency(requireManifest(job.projectId));
  const projectDir = getProjectDir(manifest.projectId);
  const dim = getTargetDimensions(
    manifest.outputSettings.resolution,
    manifest.outputSettings.aspectRatio
  );
  const totalShots = manifest.scenes.reduce((a, s) => a + s.shots.length, 0) || 1;
  let idx = 0;
  for (const scene of manifest.scenes) {
    const env = manifest.environments.find((e) => e.id === scene.environmentId);
    for (const shot of scene.shots) {
      idx++;
      if (!shot.imageAssetPath || !fs12.existsSync(shot.imageAssetPath)) {
        const imgOut = path11.join(projectDir, "storyboard", `${shot.id}.png`);
        const imgRes = await generateImageWithFallback(manifest.generationSettings.imageProvider, {
          prompt: shot.positivePrompt,
          negativePrompt: shot.negativePrompt,
          referenceImages: shot.referenceImages,
          width: dim.width,
          height: dim.height,
          seed: shot.seed,
          outputPath: imgOut,
          label: `${scene.title} \xB7 Shot ${shot.shotNumber}`,
          palette: env?.colorPalette
        });
        if (!imgRes.success) throw new Error(imgRes.errorMessage || "Image generation failed");
        shot.imageAssetPath = imgRes.outputFile;
      }
      const shotOut = path11.join(projectDir, "shots", `${shot.id}.mp4`);
      if (!shot.outputFile || !fs12.existsSync(shot.outputFile) || shot.status !== "completed") {
        const animRes = await animateShot({
          imagePath: shot.imageAssetPath,
          durationSeconds: shot.duration,
          fps: manifest.outputSettings.fps,
          width: dim.width,
          height: dim.height,
          motionSpec: shot.motionSpec,
          outputPath: shotOut,
          method: shot.generationMethod
        });
        if (!animRes.success) throw new Error(animRes.errorMessage || "Animation failed");
        shot.outputFile = animRes.outputFile;
        shot.animationModel = animRes.providerUsed;
        shot.status = "completed";
      }
      updateJob(job.id, {
        progress: Math.min(60, Math.round(idx / totalShots * 60)),
        message: `Animated shot ${idx}/${totalShots}: ${shot.id}`
      });
    }
  }
  manifest.stage = "animation_generated";
  manifest = saveManifest(manifest);
  updateJob(job.id, { progress: 65, message: "Generating narration & mixing multi-track audio..." });
  const narRes = await generateProjectNarration(manifest);
  manifest = narRes.manifest;
  const subEntries = buildSubtitleEntries(manifest);
  const subFiles = exportSubtitlesToFiles(manifest, subEntries);
  manifest.subtitles = subEntries;
  manifest.exports = { ...manifest.exports, ...subFiles };
  const mixedAudio = await mixProjectAudio(manifest);
  manifest.audioConfig.mixedAudioPath = mixedAudio;
  manifest.stage = "audio_generated";
  manifest = saveManifest(manifest);
  updateJob(job.id, { progress: 80, message: "Assembling scene videos & final episode MP4..." });
  const assembled = await assembleProjectVideo(manifest);
  manifest = saveManifest(assembled.manifest);
  updateJob(job.id, { progress: 92, message: "Running automated Quality Control checks..." });
  const qc = await runQualityControl(manifest);
  const zipPath = await createProjectArchiveZip(manifest.projectId);
  manifest.exports.archiveZip = zipPath;
  manifest.stage = qc.overallStatus === "fail" ? "assembled" : "exported";
  saveManifest(manifest);
  updateJob(job.id, {
    progress: 100,
    outputFile: assembled.landscapeMp4,
    message: `Render complete (QC: ${qc.overallStatus.toUpperCase()} \u2014 ${qc.summary.passed} passed, ${qc.summary.warnings} warnings).`
  });
}
async function handleRunQC(job) {
  const manifest = requireManifest(job.projectId);
  const report = await runQualityControl(manifest);
  updateJob(job.id, {
    progress: 100,
    message: `QC finished: ${report.overallStatus.toUpperCase()} (${report.summary.passed} pass, ${report.summary.warnings} warn, ${report.summary.failed} fail)`
  });
}
function requireManifest(projectId) {
  const m = getManifest(projectId);
  if (!m) throw new Error(`Project "${projectId}" not found.`);
  return m;
}

// server.ts
var require3 = createRequire2(import.meta.url);
var AdmZip = require3("adm-zip");
dotenv.config();
var PORT = Number(process.env.PORT || 3e3);
var upload = multer({
  dest: path12.join(PROJECTS_DIR, "_uploads"),
  limits: { fileSize: 150 * 1024 * 1024 }
});
async function startServer() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  await ensureDemoProjectSeeded().catch((e) => console.error("Demo seed warning:", e));
  app.get("/api/system/status", async (_req, res) => {
    try {
      res.json(await getSystemStatus());
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Status check failed" });
    }
  });
  app.post("/api/system/clear-cache", (_req, res) => {
    res.json(clearUnusedCache());
  });
  app.post("/api/ai-assist/draft", async (req, res) => {
    const { topic, targetDurationSeconds = 120, language = "en", visualStyle = "cinematic illustration" } = req.body || {};
    if (!topic || typeof topic !== "string") {
      return res.status(400).json({ error: "Topic or story description is required." });
    }
    const draft = await generateProjectDraftFromTopic({
      topic,
      targetDurationSeconds: Number(targetDurationSeconds),
      language,
      visualStyle
    });
    res.json(draft);
  });
  app.get("/api/media", (req, res) => {
    const rawPath = String(req.query.path || "");
    if (!rawPath) return res.status(400).send("Missing path query parameter");
    const resolved = path12.resolve(rawPath);
    if (!resolved.startsWith(PROJECTS_DIR) && !resolved.startsWith(WORKSPACE_ROOT)) {
      return res.status(403).send("Access denied");
    }
    if (!fs13.existsSync(resolved)) return res.status(404).send("Media file not found");
    res.sendFile(resolved);
  });
  app.get("/api/projects", (_req, res) => {
    res.json({ projects: listManifests() });
  });
  app.post("/api/projects", (req, res) => {
    try {
      const body = req.body || {};
      const name = String(body.name || "").trim();
      if (!name) return res.status(400).json({ error: "Project name is required." });
      const projectId = String(body.projectId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "") || `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}-${crypto5.randomBytes(3).toString("hex")}`;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const targetDur = Number(body.targetDurationSeconds || 60);
      const script = String(body.script || "");
      const visualStyle = String(body.visualStyle || "cinematic painterly illustration");
      const initialChars = Array.isArray(body.characters) ? body.characters.map((c) => CharacterSchema.parse(c)) : [];
      const initialEnvs = Array.isArray(body.environments) ? body.environments.map((e) => EnvironmentSchema.parse(e)) : [];
      const analysis = script.trim() ? processScriptToPlan(script, targetDur, initialChars, initialEnvs, visualStyle) : { scenes: [], detectedCharacters: [], detectedLocations: [], estimatedSpeakingSeconds: 0, warnings: [] };
      let manifest = ProjectManifestSchema.parse({
        projectId,
        name,
        description: String(body.description || ""),
        topic: String(body.topic || ""),
        script,
        targetDurationSeconds: targetDur,
        createdAt: now,
        updatedAt: now,
        stage: analysis.scenes.length > 0 ? "script_processed" : "created",
        characters: initialChars,
        environments: initialEnvs,
        scenes: analysis.scenes,
        voiceConfig: {
          language: String(body.narrationLanguage || "en"),
          voiceIdentity: String(body.voiceIdentity || "piper-default"),
          consentVerified: Boolean(body.consentVerified),
          consentStatement: String(body.consentStatement || "")
        },
        generationSettings: {
          imageProvider: body.imageProvider || "procedural",
          animationProvider: body.animationProvider || "deterministic",
          visualStyle,
          lowVramMode: true,
          maxVramMb: 4096
        },
        outputSettings: {
          resolution: body.resolution || "720p",
          aspectRatio: body.aspectRatio || "16:9",
          fps: body.fps === 30 ? 30 : 24,
          exportVerticalAlso: Boolean(body.exportVerticalAlso ?? true),
          exportSquareAlso: Boolean(body.exportSquareAlso ?? false),
          subtitleLanguage: String(body.subtitleLanguage || "en")
        }
      });
      manifest = applyCharacterAndEnvironmentConsistency(manifest);
      const saved = saveManifest(manifest);
      res.status(201).json({ project: saved, analysisWarnings: analysis.warnings });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Invalid project payload" });
    }
  });
  app.post("/api/projects/import-package", upload.single("packageFile"), (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No manifest JSON or ZIP package uploaded." });
      const ext = path12.extname(req.file.originalname).toLowerCase();
      if (ext === ".json") {
        const raw = JSON.parse(fs13.readFileSync(req.file.path, "utf8"));
        const manifest = ProjectManifestSchema.parse({
          ...raw,
          projectId: raw.projectId || `import-${crypto5.randomBytes(4).toString("hex")}`,
          createdAt: raw.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        fs13.unlinkSync(req.file.path);
        return res.status(201).json({ project: saveManifest(manifest) });
      }
      if (ext === ".zip") {
        const zip = new AdmZip(req.file.path);
        const manifestEntry = zip.getEntries().find((e) => e.entryName.endsWith("manifest.json"));
        const projectId = `pkg-${crypto5.randomBytes(4).toString("hex")}`;
        const targetDir = getProjectDir(projectId);
        zip.extractAllTo(targetDir, true);
        fs13.unlinkSync(req.file.path);
        if (manifestEntry) {
          const parsed = ProjectManifestSchema.parse({
            ...JSON.parse(manifestEntry.getData().toString("utf8")),
            projectId,
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          });
          return res.status(201).json({ project: saveManifest(parsed) });
        }
        const txtEntry = zip.getEntries().find((e) => e.entryName.endsWith(".txt"));
        const script = txtEntry ? txtEntry.getData().toString("utf8") : "";
        const analysis = processScriptToPlan(script, 60);
        const manifest = ProjectManifestSchema.parse({
          projectId,
          name: path12.basename(req.file.originalname, ".zip"),
          script,
          targetDurationSeconds: 60,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          scenes: analysis.scenes,
          stage: analysis.scenes.length > 0 ? "script_processed" : "created"
        });
        return res.status(201).json({ project: saveManifest(manifest) });
      }
      fs13.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Unsupported package format. Upload .json or .zip." });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Package import failed" });
    }
  });
  app.get("/api/projects/:projectId", (req, res) => {
    const project = getManifest(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json({
      project,
      assets: listAssets(project.projectId),
      jobs: listJobs(project.projectId),
      qcReport: getQCReport(project.projectId)
    });
  });
  app.put("/api/projects/:projectId", (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: "Project not found" });
    try {
      const merged = ProjectManifestSchema.parse({
        ...existing,
        ...req.body,
        projectId: existing.projectId,
        createdAt: existing.createdAt,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.json({ project: saveManifest(merged) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Manifest validation failed" });
    }
  });
  app.delete("/api/projects/:projectId", (req, res) => {
    deleteProjectRecord(req.params.projectId);
    res.json({ deleted: true });
  });
  app.post("/api/projects/:projectId/process-script", (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: "Project not found" });
    const scriptText = typeof req.body?.script === "string" ? req.body.script : existing.script;
    const targetDur = Number(req.body?.targetDurationSeconds || existing.targetDurationSeconds);
    const analysis = processScriptToPlan(
      scriptText,
      targetDur,
      existing.characters,
      existing.environments,
      existing.generationSettings.visualStyle
    );
    const updated = applyCharacterAndEnvironmentConsistency({
      ...existing,
      script: scriptText,
      targetDurationSeconds: targetDur,
      scenes: analysis.scenes,
      stage: analysis.scenes.length > 0 ? "script_processed" : existing.stage
    });
    res.json({
      project: saveManifest(updated),
      analysis
    });
  });
  app.post("/api/projects/:projectId/validate", (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: "Project not found" });
    const durationValidation = validateManifestDurations(existing);
    const schemaCheck = ProjectManifestSchema.safeParse(existing);
    const valid = schemaCheck.success && durationValidation.valid;
    if (valid && existing.stage === "created") {
      existing.stage = "validated";
      saveManifest(existing);
    }
    res.json({
      valid,
      schemaErrors: schemaCheck.success ? [] : schemaCheck.error.issues,
      durationValidation
    });
  });
  app.post("/api/projects/:projectId/characters", (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: "Project not found" });
    try {
      const body = req.body || {};
      const char = CharacterSchema.parse({
        ...body,
        id: body.id || `char-${crypto5.randomBytes(4).toString("hex")}`
      });
      const idx = existing.characters.findIndex((c) => c.id === char.id);
      if (idx >= 0) existing.characters[idx] = char;
      else existing.characters.push(char);
      const updated = applyCharacterAndEnvironmentConsistency(existing);
      res.json({ project: saveManifest(updated), character: char });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Invalid character payload" });
    }
  });
  app.post("/api/projects/:projectId/environments", (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: "Project not found" });
    try {
      const body = req.body || {};
      const env = EnvironmentSchema.parse({
        ...body,
        id: body.id || `env-${crypto5.randomBytes(4).toString("hex")}`
      });
      const idx = existing.environments.findIndex((e) => e.id === env.id);
      if (idx >= 0) existing.environments[idx] = env;
      else existing.environments.push(env);
      const updated = applyCharacterAndEnvironmentConsistency(existing);
      res.json({ project: saveManifest(updated), environment: env });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Invalid environment payload" });
    }
  });
  app.post("/api/projects/:projectId/scenes", (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: "Project not found" });
    try {
      const scenes = req.body?.scenes;
      if (!Array.isArray(scenes)) return res.status(400).json({ error: "scenes array required" });
      for (const sc of scenes) {
        if (Array.isArray(sc.shots)) {
          for (const sh of sc.shots) {
            if (typeof sh.motionPrompt === "string" && !req.body?.preserveMotionSpec) {
              sh.motionSpec = parseMotionInstruction(sh.motionPrompt);
            }
          }
        }
      }
      const next = applyCharacterAndEnvironmentConsistency(
        ProjectManifestSchema.parse({ ...existing, scenes })
      );
      res.json({ project: saveManifest(next) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Invalid scenes payload" });
    }
  });
  app.post("/api/projects/:projectId/assets", upload.single("file"), async (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: "Project not found" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const assetCategory = String(req.body?.category || "inputs");
    const targetId = String(req.body?.targetId || "");
    const projectDir = getProjectDir(existing.projectId);
    const folderMap = {
      character: "characters",
      environment: "environments",
      voice_sample: "audio",
      music: "audio",
      narration: "audio",
      shot_image: "storyboard",
      inputs: "inputs"
    };
    const subDir = folderMap[assetCategory] || "inputs";
    const safeName = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const destPath = path12.join(projectDir, subDir, safeName);
    fs13.renameSync(req.file.path, destPath);
    let extraInfo = {};
    if (assetCategory === "character" && targetId) {
      const ch = existing.characters.find((c) => c.id === targetId);
      if (ch) ch.referenceImages = Array.from(/* @__PURE__ */ new Set([...ch.referenceImages, destPath]));
    } else if (assetCategory === "environment" && targetId) {
      const env = existing.environments.find((e) => e.id === targetId);
      if (env) env.backgroundImage = destPath;
    } else if (assetCategory === "voice_sample") {
      const validation = await validateVoiceSample(destPath);
      existing.voiceConfig.voiceSamplePath = destPath;
      extraInfo = { voiceValidation: validation };
    } else if (assetCategory === "music") {
      existing.audioConfig.backgroundMusicPath = destPath;
    } else if (assetCategory === "narration") {
      existing.voiceConfig.generatedNarrationPath = destPath;
    } else if (assetCategory === "shot_image" && targetId) {
      for (const sc of existing.scenes) {
        const sh = sc.shots.find((s) => s.id === targetId);
        if (sh) sh.imageAssetPath = destPath;
      }
    }
    registerAsset({
      id: `asset-${crypto5.randomBytes(5).toString("hex")}`,
      projectId: existing.projectId,
      assetType: assetCategory,
      filePath: destPath,
      metadata: { originalName: req.file.originalname, ...extraInfo }
    });
    const saved = saveManifest(applyCharacterAndEnvironmentConsistency(existing));
    res.json({ project: saved, filePath: destPath, ...extraInfo });
  });
  app.post("/api/projects/:projectId/generate-assets", (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: "Project not found" });
    const job = jobQueue.enqueue({ projectId: existing.projectId, jobType: "generate_assets", priority: 2 });
    res.status(202).json({ job });
  });
  app.post("/api/projects/:projectId/approve-storyboard", (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: "Project not found" });
    existing.stage = "storyboard_approved";
    res.json({ project: saveManifest(existing) });
  });
  app.post("/api/projects/:projectId/generate-narration", (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: "Project not found" });
    const job = jobQueue.enqueue({ projectId: existing.projectId, jobType: "generate_narration", priority: 3 });
    res.status(202).json({ job });
  });
  app.post("/api/projects/:projectId/generate-subtitles", (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: "Project not found" });
    const job = jobQueue.enqueue({ projectId: existing.projectId, jobType: "generate_subtitles", priority: 3 });
    res.status(202).json({ job });
  });
  app.post("/api/projects/:projectId/generate-video", (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: "Project not found" });
    const job = jobQueue.enqueue({ projectId: existing.projectId, jobType: "generate_video", priority: 1 });
    res.status(202).json({ job });
  });
  app.post("/api/projects/:projectId/shots/:shotId/regenerate", (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: "Project not found" });
    const job = jobQueue.enqueue({
      projectId: existing.projectId,
      shotId: req.params.shotId,
      jobType: "animate_shot",
      priority: 1
    });
    res.status(202).json({ job });
  });
  app.post("/api/projects/:projectId/shots/:shotId/approve", (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: "Project not found" });
    const approved = Boolean(req.body?.approved ?? true);
    for (const sc of existing.scenes) {
      const sh = sc.shots.find((s) => s.id === req.params.shotId);
      if (sh) sh.approved = approved;
    }
    res.json({ project: saveManifest(existing) });
  });
  app.post("/api/projects/:projectId/qc", (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: "Project not found" });
    const job = jobQueue.enqueue({ projectId: existing.projectId, jobType: "run_qc", priority: 2 });
    res.status(202).json({ job });
  });
  app.get("/api/projects/:projectId/preview", (req, res) => {
    const project = getManifest(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json({
      projectId: project.projectId,
      stage: project.stage,
      exports: project.exports,
      scenes: project.scenes.map((sc) => ({
        id: sc.id,
        title: sc.title,
        duration: sc.duration,
        outputFile: sc.outputFile,
        shots: sc.shots.map((sh) => ({
          id: sh.id,
          shotNumber: sh.shotNumber,
          duration: sh.duration,
          imageAssetPath: sh.imageAssetPath,
          outputFile: sh.outputFile,
          approved: sh.approved,
          status: sh.status,
          motionPrompt: sh.motionPrompt
        }))
      }))
    });
  });
  app.get("/api/projects/:projectId/export", (req, res) => {
    const project = getManifest(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json({
      projectId: project.projectId,
      exports: project.exports,
      sceneVideos: project.scenes.filter((s) => s.outputFile).map((s) => ({ sceneId: s.id, title: s.title, file: s.outputFile })),
      qcReport: getQCReport(project.projectId)
    });
  });
  app.post("/api/projects/:projectId/archive", async (req, res) => {
    const project = getManifest(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const zipPath = await createProjectArchiveZip(project.projectId);
    project.exports.archiveZip = zipPath;
    saveManifest(project);
    res.json({ archiveZip: zipPath });
  });
  app.get("/api/jobs", (req, res) => {
    const projectId = req.query.projectId ? String(req.query.projectId) : void 0;
    res.json({ jobs: listJobs(projectId) });
  });
  app.get("/api/jobs/:jobId", (req, res) => {
    const job = getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json({ job });
  });
  app.post("/api/jobs/:jobId/retry", (req, res) => {
    const job = jobQueue.retry(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json({ job });
  });
  app.post("/api/jobs/:jobId/cancel", (req, res) => {
    const job = jobQueue.cancel(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json({ job });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path12.resolve(WORKSPACE_ROOT, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path12.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`FrameForge Studio server listening on http://localhost:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Fatal server startup error:", err);
  process.exit(1);
});
