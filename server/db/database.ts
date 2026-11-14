import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { JobRecord, ProjectManifest, ProjectManifestSchema, QCReport } from '../types/manifest.ts';

export const WORKSPACE_ROOT = process.cwd();
export const PROJECTS_DIR = path.resolve(WORKSPACE_ROOT, process.env.PROJECTS_DIR || 'projects');
export const CACHE_DIR = path.resolve(WORKSPACE_ROOT, process.env.CACHE_DIR || 'cache');
export const LOGS_DIR = path.resolve(WORKSPACE_ROOT, process.env.LOGS_DIR || 'logs');
export const MODELS_DIR = path.resolve(WORKSPACE_ROOT, process.env.MODELS_DIR || 'models');
export const DB_PATH = path.join(PROJECTS_DIR, 'engine.sqlite');

for (const dir of [PROJECTS_DIR, CACHE_DIR, LOGS_DIR, MODELS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);

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

export function getProjectDir(projectId: string): string {
  const safeId = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
  const dir = path.join(PROJECTS_DIR, safeId);
  for (const sub of [
    'inputs',
    'characters',
    'environments',
    'storyboard',
    'shots',
    'scenes',
    'audio',
    'subtitles',
    'exports',
  ]) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
  }
  return dir;
}

export function saveManifest(manifest: ProjectManifest): ProjectManifest {
  const parsed = ProjectManifestSchema.parse({
    ...manifest,
    updatedAt: new Date().toISOString(),
  });
  const dir = getProjectDir(parsed.projectId);
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(parsed, null, 2), 'utf8');

  const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(parsed.projectId);
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

export function getManifest(projectId: string): ProjectManifest | null {
  const row = db.prepare('SELECT manifest_json FROM projects WHERE id = ?').get(projectId) as
    | { manifest_json: string }
    | undefined;
  if (!row) {
    const diskPath = path.join(PROJECTS_DIR, projectId, 'manifest.json');
    if (fs.existsSync(diskPath)) {
      const parsed = ProjectManifestSchema.parse(JSON.parse(fs.readFileSync(diskPath, 'utf8')));
      saveManifest(parsed);
      return parsed;
    }
    return null;
  }
  return ProjectManifestSchema.parse(JSON.parse(row.manifest_json));
}

export function listManifests(): ProjectManifest[] {
  const rows = db
    .prepare('SELECT manifest_json FROM projects ORDER BY updated_at DESC')
    .all() as Array<{ manifest_json: string }>;
  return rows.map((r) => ProjectManifestSchema.parse(JSON.parse(r.manifest_json)));
}

export function deleteProjectRecord(projectId: string): void {
  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  const dir = path.join(PROJECTS_DIR, projectId.replace(/[^a-zA-Z0-9_-]/g, ''));
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function insertJob(job: JobRecord): JobRecord {
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

export function updateJob(jobId: string, patch: Partial<JobRecord>): JobRecord | null {
  const current = getJob(jobId);
  if (!current) return null;
  const next: JobRecord = { ...current, ...patch };
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

export function getJob(jobId: string): JobRecord | null {
  const r = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as Record<string, unknown> | undefined;
  return r ? mapJobRow(r) : null;
}

export function listJobs(projectId?: string): JobRecord[] {
  const rows = (
    projectId
      ? db.prepare('SELECT * FROM jobs WHERE project_id = ? ORDER BY created_at DESC').all(projectId)
      : db.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT 100').all()
  ) as Array<Record<string, unknown>>;
  return rows.map(mapJobRow);
}

function mapJobRow(r: Record<string, unknown>): JobRecord {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    sceneId: r.scene_id ? String(r.scene_id) : null,
    shotId: r.shot_id ? String(r.shot_id) : null,
    jobType: String(r.job_type),
    priority: Number(r.priority),
    status: r.status as JobRecord['status'],
    progress: Number(r.progress),
    message: String(r.message ?? ''),
    retryCount: Number(r.retry_count),
    maxRetries: Number(r.max_retries),
    errorMessage: r.error_message ? String(r.error_message) : null,
    outputFile: r.output_file ? String(r.output_file) : null,
    createdAt: String(r.created_at),
    startedAt: r.started_at ? String(r.started_at) : null,
    completedAt: r.completed_at ? String(r.completed_at) : null,
  };
}

export function registerAsset(asset: {
  id: string;
  projectId: string;
  assetType: string;
  filePath: string;
  cacheHash?: string;
  prompt?: string;
  model?: string;
  seed?: number;
  license?: string;
  qualityStatus?: string;
  metadata?: Record<string, unknown>;
}): void {
  db.prepare(
    `INSERT OR REPLACE INTO assets (id, project_id, asset_type, file_path, cache_hash, prompt, model, seed, license, quality_status, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    asset.id,
    asset.projectId,
    asset.assetType,
    asset.filePath,
    asset.cacheHash ?? null,
    asset.prompt ?? '',
    asset.model ?? '',
    asset.seed ?? null,
    asset.license ?? 'user-owned',
    asset.qualityStatus ?? 'ready',
    JSON.stringify(asset.metadata ?? {}),
    new Date().toISOString()
  );
}

export function listAssets(projectId: string): Array<Record<string, unknown>> {
  return db.prepare('SELECT * FROM assets WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as Array<
    Record<string, unknown>
  >;
}

export function saveQCReport(report: QCReport): void {
  db.prepare(
    `INSERT OR REPLACE INTO qc_reports (project_id, overall_status, report_json, generated_at) VALUES (?, ?, ?, ?)`
  ).run(report.projectId, report.overallStatus, JSON.stringify(report), report.generatedAt);
  const dir = getProjectDir(report.projectId);
  fs.writeFileSync(path.join(dir, 'qc_report.json'), JSON.stringify(report, null, 2), 'utf8');
}

export function getQCReport(projectId: string): QCReport | null {
  const row = db.prepare('SELECT report_json FROM qc_reports WHERE project_id = ?').get(projectId) as
    | { report_json: string }
    | undefined;
  return row ? (JSON.parse(row.report_json) as QCReport) : null;
}

export function writeEngineLog(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(path.join(LOGS_DIR, 'engine.log'), line, 'utf8');
}
