import { createRequire } from 'node:module';
import type AdmZipType from 'adm-zip';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import multer from 'multer';
import path from 'node:path';

const require = createRequire(import.meta.url);
const AdmZip = require('adm-zip') as typeof AdmZipType;
import { createServer as createViteServer } from 'vite';
import {
  deleteProjectRecord,
  getJob,
  getManifest,
  getProjectDir,
  getQCReport,
  listAssets,
  listJobs,
  listManifests,
  PROJECTS_DIR,
  registerAsset,
  saveManifest,
  WORKSPACE_ROOT,
} from './server/db/database.ts';
import { applyCharacterAndEnvironmentConsistency } from './server/engines/characterEngine.ts';
import { parseMotionInstruction } from './server/engines/motionParser.ts';
import { processScriptToPlan, validateManifestDurations } from './server/engines/scriptProcessor.ts';
import { createProjectArchiveZip } from './server/engines/videoAssembler.ts';
import { validateVoiceSample } from './server/engines/voiceEngine.ts';
import { generateProjectDraftFromTopic } from './server/services/aiAssistService.ts';
import { ensureDemoProjectSeeded, ensureShortsDemoSeeded } from './server/services/demoSeed.ts';
import { clearUnusedCache, getSystemStatus } from './server/services/systemStatus.ts';
import {
  CharacterSchema,
  EnvironmentSchema,
  ProjectManifest,
  ProjectManifestSchema,
} from './server/types/manifest.ts';
import { jobQueue } from './server/workers/jobQueue.ts';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const upload = multer({
  dest: path.join(PROJECTS_DIR, '_uploads'),
  limits: { fileSize: 150 * 1024 * 1024 },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Seed Mahishasura Episode 1 demo manifest cleanly on first startup
  await ensureDemoProjectSeeded().catch((e) => console.error('Demo seed warning:', e));

  // ---------------- System & Hardware ----------------
  app.get('/api/system/status', async (_req, res) => {
    try {
      res.json(await getSystemStatus());
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Status check failed' });
    }
  });

  app.post('/api/system/clear-cache', (_req, res) => {
    res.json(clearUnusedCache());
  });

  app.get('/api/test-packages', (_req, res) => {
    const pkgDir = path.join(PROJECTS_DIR, 'mahishasur-vadh-test-package');
    const zipPath = path.join(pkgDir, 'mahishasur_vadh_full_test_package.zip');
    const reportPath = path.join(pkgDir, 'test_report.json');
    if (!fs.existsSync(zipPath)) {
      return res.json({ packages: [] });
    }
    const stat = fs.statSync(zipPath);
    let report: Record<string, unknown> | null = null;
    try {
      if (fs.existsSync(reportPath)) {
        report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      }
    } catch {
      report = null;
    }
    res.json({
      packages: [
        {
          id: 'mahishasur-vadh-test-package',
          name: 'Mahishasur Vadh — 8-Part Full Test Package',
          zipPath,
          sizeBytes: stat.size,
          report,
        },
      ],
    });
  });

  app.post('/api/ai-assist/draft', async (req, res) => {
    const { topic, targetDurationSeconds = 120, language = 'en', visualStyle = 'cinematic illustration' } =
      req.body || {};
    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: 'Topic or story description is required.' });
    }
    const draft = await generateProjectDraftFromTopic({
      topic,
      targetDurationSeconds: Number(targetDurationSeconds),
      language,
      visualStyle,
    });
    res.json(draft);
  });

  // ---------------- Local Media Streaming ----------------
  app.get('/api/media', (req, res) => {
    const rawPath = String(req.query.path || '');
    if (!rawPath) return res.status(400).send('Missing path query parameter');
    const resolved = path.resolve(rawPath);
    if (!resolved.startsWith(PROJECTS_DIR) && !resolved.startsWith(WORKSPACE_ROOT)) {
      return res.status(403).send('Access denied');
    }
    if (!fs.existsSync(resolved)) return res.status(404).send('Media file not found');
    res.sendFile(resolved);
  });

  // ---------------- Projects CRUD ----------------
  app.get('/api/projects', (_req, res) => {
    res.json({ projects: listManifests() });
  });

  app.post('/api/projects', (req, res) => {
    try {
      const body = req.body || {};
      const name = String(body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'Project name is required.' });

      const projectId =
        String(body.projectId || '')
          .trim()
          .replace(/[^a-zA-Z0-9_-]/g, '') ||
        `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}-${crypto.randomBytes(3).toString('hex')}`;

      const now = new Date().toISOString();
      const targetDur = Number(body.targetDurationSeconds || 60);
      const script = String(body.script || '');
      const visualStyle = String(body.visualStyle || 'cinematic painterly illustration');

      const initialChars = Array.isArray(body.characters)
        ? body.characters.map((c: unknown) => CharacterSchema.parse(c))
        : [];
      const initialEnvs = Array.isArray(body.environments)
        ? body.environments.map((e: unknown) => EnvironmentSchema.parse(e))
        : [];

      const pacingMode = body.pacingMode === 'shorts_rapid' ? 'shorts_rapid' : 'standard';
      const analysis = script.trim()
        ? processScriptToPlan(script, targetDur, initialChars, initialEnvs, visualStyle, pacingMode)
        : { scenes: [], detectedCharacters: [], detectedLocations: [], estimatedSpeakingSeconds: 0, warnings: [] };

      const parsedFps = body.fps === 30 ? 30 : body.fps === 25 ? 25 : 24;
      let manifest = ProjectManifestSchema.parse({
        projectId,
        name,
        description: String(body.description || ''),
        topic: String(body.topic || ''),
        script,
        targetDurationSeconds: targetDur,
        createdAt: now,
        updatedAt: now,
        stage: analysis.scenes.length > 0 ? 'script_processed' : 'created',
        characters: initialChars,
        environments: initialEnvs,
        scenes: analysis.scenes,
        voiceConfig: {
          language: String(body.narrationLanguage || 'en'),
          voiceIdentity: String(body.voiceIdentity || 'piper-default'),
          consentVerified: Boolean(body.consentVerified),
          consentStatement: String(body.consentStatement || ''),
        },
        brandingConfig: {
          watermarkText: String(body.watermarkText || ''),
          position: body.watermarkPosition || 'bottom_right',
          opacity: body.watermarkOpacity !== undefined ? Number(body.watermarkOpacity) : 0.82,
          color: String(body.watermarkColor || '#F59E0B'),
        },
        generationSettings: {
          imageProvider: body.imageProvider || 'procedural',
          animationProvider: body.animationProvider || 'deterministic',
          visualStyle,
          lowVramMode: true,
          maxVramMb: 4096,
        },
        outputSettings: {
          resolution: body.resolution || '720p',
          aspectRatio: body.aspectRatio || '16:9',
          fps: parsedFps,
          pacingMode,
          exportVerticalAlso: Boolean(body.exportVerticalAlso ?? (body.aspectRatio !== '9:16')),
          exportSquareAlso: Boolean(body.exportSquareAlso ?? false),
          burnSubtitles: Boolean(body.burnSubtitles ?? (pacingMode === 'shorts_rapid')),
          subtitleLanguage: String(body.subtitleLanguage || 'en'),
        },
      });

      manifest = applyCharacterAndEnvironmentConsistency(manifest);
      const saved = saveManifest(manifest);
      res.status(201).json({ project: saved, analysisWarnings: analysis.warnings });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid project payload' });
    }
  });

  function resolveImportedAssetPath(rawPath: string | undefined, targetDir: string): string | undefined {
    if (!rawPath) return rawPath;
    if (fs.existsSync(rawPath)) return rawPath;
    const normalized = rawPath.replace(/\\/g, '/');
    const direct = path.resolve(targetDir, normalized.replace(/^\/+/, ''));
    if (fs.existsSync(direct)) return direct;

    for (const sub of ['storyboard', 'characters', 'environments', 'audio', 'shots', 'scenes', 'subtitles', 'exports', 'inputs']) {
      const idx = normalized.lastIndexOf(`/${sub}/`);
      if (idx >= 0) {
        const rel = normalized.slice(idx + 1);
        const candidate = path.join(targetDir, rel);
        if (fs.existsSync(candidate)) return candidate;
      }
      const byBase = path.join(targetDir, sub, path.basename(normalized));
      if (fs.existsSync(byBase)) return byBase;
    }
    return rawPath;
  }

  function remapImportedManifestPaths(manifest: ProjectManifest, targetDir: string): ProjectManifest {
    return {
      ...manifest,
      characters: manifest.characters.map((ch) => ({
        ...ch,
        referenceImages: ch.referenceImages
          .map((p) => resolveImportedAssetPath(p, targetDir) || p)
          .filter((p) => fs.existsSync(p)),
      })),
      environments: manifest.environments.map((env) => ({
        ...env,
        backgroundImage: resolveImportedAssetPath(env.backgroundImage, targetDir),
        foregroundLayer: resolveImportedAssetPath(env.foregroundLayer, targetDir),
        ambientAudio: resolveImportedAssetPath(env.ambientAudio, targetDir),
      })),
      voiceConfig: {
        ...manifest.voiceConfig,
        voiceSamplePath: resolveImportedAssetPath(manifest.voiceConfig.voiceSamplePath, targetDir),
        generatedNarrationPath: resolveImportedAssetPath(manifest.voiceConfig.generatedNarrationPath, targetDir),
      },
      audioConfig: {
        ...manifest.audioConfig,
        backgroundMusicPath: resolveImportedAssetPath(manifest.audioConfig.backgroundMusicPath, targetDir),
        mixedAudioPath: resolveImportedAssetPath(manifest.audioConfig.mixedAudioPath, targetDir),
      },
      brandingConfig: {
        ...manifest.brandingConfig,
        watermarkImagePath: resolveImportedAssetPath(manifest.brandingConfig.watermarkImagePath, targetDir),
      },
      exports: {
        landscapeMp4: resolveImportedAssetPath(manifest.exports.landscapeMp4, targetDir),
        verticalMp4: resolveImportedAssetPath(manifest.exports.verticalMp4, targetDir),
        squareMp4: resolveImportedAssetPath(manifest.exports.squareMp4, targetDir),
        srtPath: resolveImportedAssetPath(manifest.exports.srtPath, targetDir),
        vttPath: resolveImportedAssetPath(manifest.exports.vttPath, targetDir),
        assPath: resolveImportedAssetPath(manifest.exports.assPath, targetDir),
        archiveZip: resolveImportedAssetPath(manifest.exports.archiveZip, targetDir),
      },
      scenes: manifest.scenes.map((sc) => ({
        ...sc,
        ambientAudioPath: resolveImportedAssetPath(sc.ambientAudioPath, targetDir),
        outputFile: resolveImportedAssetPath(sc.outputFile, targetDir),
        shots: sc.shots.map((sh) => ({
          ...sh,
          referenceImages: sh.referenceImages
            .map((p) => resolveImportedAssetPath(p, targetDir) || p)
            .filter((p) => fs.existsSync(p)),
          imageAssetPath: resolveImportedAssetPath(sh.imageAssetPath, targetDir),
          importedClipPath: resolveImportedAssetPath(sh.importedClipPath, targetDir),
          narrationAudioPath: resolveImportedAssetPath(sh.narrationAudioPath, targetDir),
          outputFile: resolveImportedAssetPath(sh.outputFile, targetDir),
        })),
      })),
    };
  }

  app.post('/api/projects/import-package', upload.single('packageFile'), (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No manifest JSON or ZIP package uploaded.' });
      const ext = path.extname(req.file.originalname).toLowerCase();

      if (ext === '.json') {
        const raw = JSON.parse(fs.readFileSync(req.file.path, 'utf8'));
        const manifest = ProjectManifestSchema.parse({
          ...raw,
          projectId: raw.projectId || `import-${crypto.randomBytes(4).toString('hex')}`,
          createdAt: raw.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        fs.unlinkSync(req.file.path);
        return res.status(201).json({ project: saveManifest(manifest) });
      }

      if (ext === '.zip') {
        const zip = new AdmZip(req.file.path);
        const manifestEntry = zip.getEntries().find((e) => e.entryName.endsWith('manifest.json'));
        const projectId = `pkg-${crypto.randomBytes(4).toString('hex')}`;
        const targetDir = getProjectDir(projectId);
        zip.extractAllTo(targetDir, true);
        fs.unlinkSync(req.file.path);

        if (manifestEntry) {
          const parsed = ProjectManifestSchema.parse({
            ...JSON.parse(manifestEntry.getData().toString('utf8')),
            projectId,
            updatedAt: new Date().toISOString(),
          });
          const remapped = remapImportedManifestPaths(parsed, targetDir);
          return res.status(201).json({ project: saveManifest(remapped) });
        }

        // Fallback: look for any .txt script inside ZIP
        const txtEntry = zip.getEntries().find((e) => e.entryName.endsWith('.txt'));
        const script = txtEntry ? txtEntry.getData().toString('utf8') : '';
        const analysis = processScriptToPlan(script, 60);
        const manifest = ProjectManifestSchema.parse({
          projectId,
          name: path.basename(req.file.originalname, '.zip'),
          script,
          targetDurationSeconds: 60,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          scenes: analysis.scenes,
          stage: analysis.scenes.length > 0 ? 'script_processed' : 'created',
        });
        return res.status(201).json({ project: saveManifest(manifest) });
      }

      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Unsupported package format. Upload .json or .zip.' });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Package import failed' });
    }
  });

  app.get('/api/projects/:projectId', (req, res) => {
    const project = getManifest(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({
      project,
      assets: listAssets(project.projectId),
      jobs: listJobs(project.projectId),
      qcReport: getQCReport(project.projectId),
    });
  });

  app.put('/api/projects/:projectId', (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    try {
      const merged = ProjectManifestSchema.parse({
        ...existing,
        ...req.body,
        projectId: existing.projectId,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      });
      res.json({ project: saveManifest(merged) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Manifest validation failed' });
    }
  });

  app.delete('/api/projects/:projectId', (req, res) => {
    deleteProjectRecord(req.params.projectId);
    res.json({ deleted: true });
  });

  app.post('/api/demo/create-shorts-sample', async (_req, res) => {
    try {
      const project = await ensureShortsDemoSeeded(true);
      res.json({ project });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create Shorts demo' });
    }
  });

  // ---------------- Script Processing & Validation ----------------
  app.post('/api/projects/:projectId/process-script', (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    const scriptText = typeof req.body?.script === 'string' ? req.body.script : existing.script;
    const targetDur = Number(req.body?.targetDurationSeconds || existing.targetDurationSeconds);
    const pacingMode =
      req.body?.pacingMode === 'shorts_rapid' || req.body?.pacingMode === 'standard'
        ? req.body.pacingMode
        : existing.outputSettings.pacingMode;

    const analysis = processScriptToPlan(
      scriptText,
      targetDur,
      existing.characters,
      existing.environments,
      existing.generationSettings.visualStyle,
      pacingMode
    );

    const updated = applyCharacterAndEnvironmentConsistency({
      ...existing,
      script: scriptText,
      targetDurationSeconds: targetDur,
      outputSettings: {
        ...existing.outputSettings,
        pacingMode,
      },
      scenes: analysis.scenes,
      stage: analysis.scenes.length > 0 ? 'script_processed' : existing.stage,
    });

    res.json({
      project: saveManifest(updated),
      analysis,
    });
  });

  app.post('/api/projects/:projectId/validate', (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    const durationValidation = validateManifestDurations(existing);
    const schemaCheck = ProjectManifestSchema.safeParse(existing);
    const valid = schemaCheck.success && durationValidation.valid;

    if (valid && existing.stage === 'created') {
      existing.stage = 'validated';
      saveManifest(existing);
    }

    res.json({
      valid,
      schemaErrors: schemaCheck.success ? [] : schemaCheck.error.issues,
      durationValidation,
    });
  });

  // ---------------- Characters, Environments & Assets ----------------
  app.post('/api/projects/:projectId/characters', (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    try {
      const body = req.body || {};
      const char = CharacterSchema.parse({
        ...body,
        id: body.id || `char-${crypto.randomBytes(4).toString('hex')}`,
      });
      const idx = existing.characters.findIndex((c) => c.id === char.id);
      if (idx >= 0) existing.characters[idx] = char;
      else existing.characters.push(char);

      const updated = applyCharacterAndEnvironmentConsistency(existing);
      res.json({ project: saveManifest(updated), character: char });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid character payload' });
    }
  });

  app.post('/api/projects/:projectId/environments', (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    try {
      const body = req.body || {};
      const env = EnvironmentSchema.parse({
        ...body,
        id: body.id || `env-${crypto.randomBytes(4).toString('hex')}`,
      });
      const idx = existing.environments.findIndex((e) => e.id === env.id);
      if (idx >= 0) existing.environments[idx] = env;
      else existing.environments.push(env);

      const updated = applyCharacterAndEnvironmentConsistency(existing);
      res.json({ project: saveManifest(updated), environment: env });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid environment payload' });
    }
  });

  app.post('/api/projects/:projectId/scenes', (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    try {
      const scenes = req.body?.scenes;
      if (!Array.isArray(scenes)) return res.status(400).json({ error: 'scenes array required' });
      // Re-parse any updated motion prompts into structured MotionSpec
      for (const sc of scenes) {
        if (Array.isArray(sc.shots)) {
          for (const sh of sc.shots) {
            if (typeof sh.motionPrompt === 'string' && !req.body?.preserveMotionSpec) {
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
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid scenes payload' });
    }
  });

  app.post('/api/projects/:projectId/assets', upload.single('file'), async (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const assetCategory = String(req.body?.category || 'inputs');
    const targetId = String(req.body?.targetId || '');
    const projectDir = getProjectDir(existing.projectId);

    const folderMap: Record<string, string> = {
      character: 'characters',
      environment: 'environments',
      voice_sample: 'audio',
      music: 'audio',
      narration: 'audio',
      shot_image: 'storyboard',
      shot_clip: 'shots',
      watermark: 'inputs',
      inputs: 'inputs',
    };
    const subDir = folderMap[assetCategory] || 'inputs';
    const safeName = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const destPath = path.join(projectDir, subDir, safeName);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.renameSync(req.file.path, destPath);

    let extraInfo: Record<string, unknown> = {};

    if (assetCategory === 'character' && targetId) {
      const ch = existing.characters.find((c) => c.id === targetId);
      if (ch) ch.referenceImages = Array.from(new Set([...ch.referenceImages, destPath]));
    } else if (assetCategory === 'environment' && targetId) {
      const env = existing.environments.find((e) => e.id === targetId);
      if (env) env.backgroundImage = destPath;
    } else if (assetCategory === 'voice_sample') {
      const validation = await validateVoiceSample(destPath);
      existing.voiceConfig.voiceSamplePath = destPath;
      extraInfo = { voiceValidation: validation };
    } else if (assetCategory === 'music') {
      existing.audioConfig.backgroundMusicPath = destPath;
    } else if (assetCategory === 'narration') {
      existing.voiceConfig.generatedNarrationPath = destPath;
    } else if (assetCategory === 'watermark') {
      existing.brandingConfig.watermarkImagePath = destPath;
    } else if (assetCategory === 'shot_image' && targetId) {
      for (const sc of existing.scenes) {
        const sh = sc.shots.find((s) => s.id === targetId);
        if (sh) sh.imageAssetPath = destPath;
      }
    } else if (assetCategory === 'shot_clip' && targetId) {
      for (const sc of existing.scenes) {
        const sh = sc.shots.find((s) => s.id === targetId);
        if (sh) {
          sh.importedClipPath = destPath;
          sh.generationMethod = 'generative_i2v';
          sh.status = 'pending';
        }
      }
    }

    registerAsset({
      id: `asset-${crypto.randomBytes(5).toString('hex')}`,
      projectId: existing.projectId,
      assetType: assetCategory,
      filePath: destPath,
      metadata: { originalName: req.file.originalname, ...extraInfo },
    });

    const saved = saveManifest(applyCharacterAndEnvironmentConsistency(existing));
    res.json({ project: saved, filePath: destPath, ...extraInfo });
  });

  // ---------------- Production Pipeline Triggers ----------------
  app.post('/api/projects/:projectId/generate-assets', (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    const job = jobQueue.enqueue({ projectId: existing.projectId, jobType: 'generate_assets', priority: 2 });
    res.status(202).json({ job });
  });

  app.post('/api/projects/:projectId/approve-storyboard', (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    existing.stage = 'storyboard_approved';
    res.json({ project: saveManifest(existing) });
  });

  app.post('/api/projects/:projectId/generate-narration', (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    const job = jobQueue.enqueue({ projectId: existing.projectId, jobType: 'generate_narration', priority: 3 });
    res.status(202).json({ job });
  });

  app.post('/api/projects/:projectId/generate-subtitles', (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    const job = jobQueue.enqueue({ projectId: existing.projectId, jobType: 'generate_subtitles', priority: 3 });
    res.status(202).json({ job });
  });

  app.post('/api/projects/:projectId/generate-video', (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    const job = jobQueue.enqueue({ projectId: existing.projectId, jobType: 'generate_video', priority: 1 });
    res.status(202).json({ job });
  });

  app.post('/api/projects/:projectId/shots/:shotId/regenerate', (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    const job = jobQueue.enqueue({
      projectId: existing.projectId,
      shotId: req.params.shotId,
      jobType: 'animate_shot',
      priority: 1,
    });
    res.status(202).json({ job });
  });

  app.post('/api/projects/:projectId/shots/:shotId/approve', (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    const approved = Boolean(req.body?.approved ?? true);
    for (const sc of existing.scenes) {
      const sh = sc.shots.find((s) => s.id === req.params.shotId);
      if (sh) sh.approved = approved;
    }
    res.json({ project: saveManifest(existing) });
  });

  app.post('/api/projects/:projectId/qc', (req, res) => {
    const existing = getManifest(req.params.projectId);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    const job = jobQueue.enqueue({ projectId: existing.projectId, jobType: 'run_qc', priority: 2 });
    res.status(202).json({ job });
  });

  // ---------------- Preview & Export ----------------
  app.get('/api/projects/:projectId/preview', (req, res) => {
    const project = getManifest(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
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
          importedClipPath: sh.importedClipPath,
          outputFile: sh.outputFile,
          approved: sh.approved,
          status: sh.status,
          motionPrompt: sh.motionPrompt,
        })),
      })),
    });
  });

  app.get('/api/projects/:projectId/export', (req, res) => {
    const project = getManifest(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({
      projectId: project.projectId,
      exports: project.exports,
      sceneVideos: project.scenes
        .filter((s) => s.outputFile)
        .map((s) => ({ sceneId: s.id, title: s.title, file: s.outputFile })),
      qcReport: getQCReport(project.projectId),
    });
  });

  app.post('/api/projects/:projectId/archive', async (req, res) => {
    const project = getManifest(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const zipPath = await createProjectArchiveZip(project.projectId);
    project.exports.archiveZip = zipPath;
    saveManifest(project);
    res.json({ archiveZip: zipPath });
  });

  // ---------------- Jobs Queue ----------------
  app.get('/api/jobs', (req, res) => {
    const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
    res.json({ jobs: listJobs(projectId) });
  });

  app.get('/api/jobs/:jobId', (req, res) => {
    const job = getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ job });
  });

  app.post('/api/jobs/:jobId/retry', (req, res) => {
    const job = jobQueue.retry(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ job });
  });

  app.post('/api/jobs/:jobId/cancel', (req, res) => {
    const job = jobQueue.cancel(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ job });
  });

  // ---------------- Vite / Static Frontend ----------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(WORKSPACE_ROOT, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FrameForge Studio server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
