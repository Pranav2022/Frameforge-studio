import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  getJob,
  getManifest,
  getProjectDir,
  insertJob,
  listJobs,
  registerAsset,
  saveManifest,
  updateJob,
  writeEngineLog,
} from '../db/database.ts';
import { mixProjectAudio } from '../engines/audioMixer.ts';
import { applyCharacterAndEnvironmentConsistency } from '../engines/characterEngine.ts';
import { runQualityControl } from '../engines/qcEngine.ts';
import { buildSubtitleEntries, exportSubtitlesToFiles } from '../engines/subtitleEngine.ts';
import {
  assembleProjectVideo,
  createProjectArchiveZip,
  getTargetDimensions,
} from '../engines/videoAssembler.ts';
import { generateProjectNarration } from '../engines/voiceEngine.ts';
import { animateShot } from '../providers/animationProvider.ts';
import { generateImageWithFallback } from '../providers/imageProvider.ts';
import { JobRecord, ProjectManifest } from '../types/manifest.ts';

type JobHandler = (job: JobRecord) => Promise<void>;

class SequentialJobQueue {
  private isProcessing = false;
  private cancelledIds = new Set<string>();

  enqueue(params: {
    projectId: string;
    sceneId?: string | null;
    shotId?: string | null;
    jobType: string;
    priority?: number;
  }): JobRecord {
    const job: JobRecord = {
      id: `job-${crypto.randomBytes(6).toString('hex')}`,
      projectId: params.projectId,
      sceneId: params.sceneId ?? null,
      shotId: params.shotId ?? null,
      jobType: params.jobType,
      priority: params.priority ?? 5,
      status: 'pending',
      progress: 0,
      message: 'Queued for sequential execution',
      retryCount: 0,
      maxRetries: 2,
      errorMessage: null,
      outputFile: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
    };
    insertJob(job);
    writeEngineLog(`Enqueued ${job.jobType} (${job.id}) for project ${job.projectId}`);
    void this.kick();
    return job;
  }

  cancel(jobId: string): JobRecord | null {
    this.cancelledIds.add(jobId);
    const updated = updateJob(jobId, {
      status: 'cancelled',
      message: 'Cancelled by user',
      completedAt: new Date().toISOString(),
    });
    writeEngineLog(`Cancelled job ${jobId}`);
    return updated;
  }

  retry(jobId: string): JobRecord | null {
    const job = getJob(jobId);
    if (!job) return null;
    this.cancelledIds.delete(jobId);
    const updated = updateJob(jobId, {
      status: 'pending',
      progress: 0,
      errorMessage: null,
      message: 'Re-queued manually by user',
      completedAt: null,
    });
    void this.kick();
    return updated;
  }

  private async kick(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (true) {
        const pending = listJobs()
          .filter((j) => j.status === 'pending')
          .sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt));

        if (pending.length === 0) break;
        const job = pending[0];

        if (this.cancelledIds.has(job.id)) {
          updateJob(job.id, { status: 'cancelled', completedAt: new Date().toISOString() });
          continue;
        }

        await this.executeJob(job);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeJob(job: JobRecord): Promise<void> {
    updateJob(job.id, {
      status: 'running',
      progress: 5,
      startedAt: new Date().toISOString(),
      message: `Starting ${job.jobType}...`,
    });

    const handlers: Record<string, JobHandler> = {
      generate_assets: handleGenerateAssets,
      generate_narration: handleGenerateNarration,
      generate_subtitles: handleGenerateSubtitles,
      animate_shot: handleAnimateSingleShot,
      generate_video: handleFullVideoPipeline,
      run_qc: handleRunQC,
    };

    const handler = handlers[job.jobType];
    if (!handler) {
      updateJob(job.id, {
        status: 'failed',
        errorMessage: `Unknown job type: ${job.jobType}`,
        completedAt: new Date().toISOString(),
      });
      return;
    }

    try {
      await handler(job);
      if (!this.cancelledIds.has(job.id)) {
        const fresh = getJob(job.id);
        if (fresh && fresh.status !== 'failed' && fresh.status !== 'cancelled') {
          updateJob(job.id, {
            status: 'completed',
            progress: 100,
            completedAt: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      writeEngineLog(`Job ${job.id} (${job.jobType}) failed: ${msg}`);
      const current = getJob(job.id);
      if (current && current.retryCount < current.maxRetries && !this.cancelledIds.has(job.id)) {
        updateJob(job.id, {
          status: 'pending',
          retryCount: current.retryCount + 1,
          errorMessage: msg,
          message: `Transient failure, retrying (${current.retryCount + 1}/${current.maxRetries})...`,
        });
      } else {
        updateJob(job.id, {
          status: 'failed',
          errorMessage: msg,
          message: `Failed: ${msg}`,
          completedAt: new Date().toISOString(),
        });
      }
    }
  }
}

export const jobQueue = new SequentialJobQueue();

async function handleGenerateAssets(job: JobRecord): Promise<void> {
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
      // Skip shots that already have a valid existing image asset (resumable / avoid duplicate regeneration)
      if (shot.imageAssetPath && fs.existsSync(shot.imageAssetPath) && fs.statSync(shot.imageAssetPath).size > 512) {
        done++;
        continue;
      }

      const outImg = path.join(projectDir, 'storyboard', `${shot.id}.png`);
      const res = await generateImageWithFallback(synced.generationSettings.imageProvider, {
        prompt: shot.positivePrompt,
        negativePrompt: shot.negativePrompt,
        referenceImages: shot.referenceImages,
        width: dim.width,
        height: dim.height,
        seed: shot.seed,
        outputPath: outImg,
        label: `${scene.title} · Shot ${shot.shotNumber}`,
        palette: env?.colorPalette,
      });

      if (!res.success) {
        throw new Error(res.errorMessage || `Image generation failed for ${shot.id}`);
      }

      shot.imageAssetPath = res.outputFile;
      registerAsset({
        id: `img-${shot.id}`,
        projectId: synced.projectId,
        assetType: 'storyboard_image',
        filePath: res.outputFile,
        prompt: shot.positivePrompt,
        model: res.modelUsed,
        seed: shot.seed,
        qualityStatus: 'ready',
      });

      done++;
      updateJob(job.id, {
        progress: Math.min(95, Math.round((done / totalShots) * 90)),
        message: `Generated storyboard image ${done}/${totalShots} (${res.fromCache ? 'cache hit' : res.modelUsed})`,
      });
    }
  }

  synced.stage = 'storyboard_ready';
  saveManifest(synced);
  updateJob(job.id, {
    progress: 100,
    message: `Prepared ${done} storyboard image assets.`,
  });
}

async function handleAnimateSingleShot(job: JobRecord): Promise<void> {
  const manifest = requireManifest(job.projectId);
  const projectDir = getProjectDir(manifest.projectId);
  const dim = getTargetDimensions(
    manifest.outputSettings.resolution,
    manifest.outputSettings.aspectRatio
  );

  for (const scene of manifest.scenes) {
    for (const shot of scene.shots) {
      if (shot.id !== job.shotId) continue;

      if (!shot.imageAssetPath || !fs.existsSync(shot.imageAssetPath)) {
        const outImg = path.join(projectDir, 'storyboard', `${shot.id}.png`);
        const imgRes = await generateImageWithFallback(manifest.generationSettings.imageProvider, {
          prompt: shot.positivePrompt,
          negativePrompt: shot.negativePrompt,
          referenceImages: shot.referenceImages,
          width: dim.width,
          height: dim.height,
          seed: shot.seed,
          outputPath: outImg,
          label: `${scene.title} · Shot ${shot.shotNumber}`,
        });
        shot.imageAssetPath = imgRes.outputFile;
      }

      const shotOut = path.join(projectDir, 'shots', `${shot.id}.mp4`);
      // Force fresh render by removing old shot clip on explicit regeneration
      if (fs.existsSync(shotOut)) fs.unlinkSync(shotOut);

      const animRes = await animateShot({
        imagePath: shot.imageAssetPath!,
        importedClipPath: shot.importedClipPath,
        durationSeconds: shot.duration,
        fps: manifest.outputSettings.fps,
        width: dim.width,
        height: dim.height,
        motionSpec: shot.motionSpec,
        outputPath: shotOut,
        method: shot.generationMethod,
        skipBlackFadeEdges: true,
      });

      if (!animRes.success) {
        shot.status = 'failed';
        shot.error = animRes.errorMessage;
        saveManifest(manifest);
        throw new Error(animRes.errorMessage || `Animation failed for ${shot.id}`);
      }

      shot.outputFile = animRes.outputFile;
      shot.animationModel = animRes.providerUsed;
      shot.status = 'completed';
      shot.error = undefined;
      saveManifest(manifest);

      updateJob(job.id, {
        progress: 100,
        outputFile: animRes.outputFile,
        message: `Rendered shot ${shot.id} via ${animRes.providerUsed}`,
      });
      return;
    }
  }
  throw new Error(`Shot ${job.shotId} not found in project.`);
}

async function handleGenerateNarration(job: JobRecord): Promise<void> {
  const manifest = requireManifest(job.projectId);
  updateJob(job.id, { progress: 25, message: 'Synthesizing scene-aligned narration...' });
  const res = await generateProjectNarration(manifest);
  res.manifest.stage = 'audio_generated';
  saveManifest(res.manifest);

  registerAsset({
    id: `narration-${manifest.projectId}`,
    projectId: manifest.projectId,
    assetType: 'narration_master',
    filePath: res.narrationMp3Path,
    model: res.engineUsed,
    qualityStatus: 'ready',
  });

  updateJob(job.id, {
    progress: 100,
    outputFile: res.narrationMp3Path,
    message: `Narration generated via ${res.engineUsed}`,
  });
}

async function handleGenerateSubtitles(job: JobRecord): Promise<void> {
  const manifest = requireManifest(job.projectId);
  updateJob(job.id, { progress: 30, message: 'Aligning subtitle cues...' });
  const entries = buildSubtitleEntries(manifest);
  const files = exportSubtitlesToFiles(manifest, entries);

  manifest.subtitles = entries;
  manifest.exports = {
    ...manifest.exports,
    srtPath: files.srtPath,
    vttPath: files.vttPath,
    assPath: files.assPath,
  };
  saveManifest(manifest);

  updateJob(job.id, {
    progress: 100,
    outputFile: files.srtPath,
    message: `Generated ${entries.length} synchronized cues (SRT, VTT, ASS).`,
  });
}

async function handleFullVideoPipeline(job: JobRecord): Promise<void> {
  let manifest = applyCharacterAndEnvironmentConsistency(requireManifest(job.projectId));
  const projectDir = getProjectDir(manifest.projectId);
  const dim = getTargetDimensions(
    manifest.outputSettings.resolution,
    manifest.outputSettings.aspectRatio
  );

  // Step A: Ensure storyboard images exist
  const totalShots = manifest.scenes.reduce((a, s) => a + s.shots.length, 0) || 1;
  let idx = 0;

  for (const scene of manifest.scenes) {
    const env = manifest.environments.find((e) => e.id === scene.environmentId);
    for (const shot of scene.shots) {
      idx++;
      if (!shot.imageAssetPath || !fs.existsSync(shot.imageAssetPath)) {
        const imgOut = path.join(projectDir, 'storyboard', `${shot.id}.png`);
        const imgRes = await generateImageWithFallback(manifest.generationSettings.imageProvider, {
          prompt: shot.positivePrompt,
          negativePrompt: shot.negativePrompt,
          referenceImages: shot.referenceImages,
          width: dim.width,
          height: dim.height,
          seed: shot.seed,
          outputPath: imgOut,
          label: `${scene.title} · Shot ${shot.shotNumber}`,
          palette: env?.colorPalette,
        });
        if (!imgRes.success) throw new Error(imgRes.errorMessage || 'Image generation failed');
        shot.imageAssetPath = imgRes.outputFile;
      }

      // Step B: Animate each shot (resume-safe: reuse valid completed shot clip unless missing)
      const shotOut = path.join(projectDir, 'shots', `${shot.id}.mp4`);
      if (!shot.outputFile || !fs.existsSync(shot.outputFile) || shot.status !== 'completed') {
        const animRes = await animateShot({
          imagePath: shot.imageAssetPath,
          importedClipPath: shot.importedClipPath,
          durationSeconds: shot.duration,
          fps: manifest.outputSettings.fps,
          width: dim.width,
          height: dim.height,
          motionSpec: shot.motionSpec,
          outputPath: shotOut,
          method: shot.generationMethod,
          skipBlackFadeEdges: true,
        });
        if (!animRes.success) throw new Error(animRes.errorMessage || 'Animation failed');
        shot.outputFile = animRes.outputFile;
        shot.animationModel = animRes.providerUsed;
        shot.status = 'completed';
      }

      updateJob(job.id, {
        progress: Math.min(60, Math.round((idx / totalShots) * 60)),
        message: `Animated shot ${idx}/${totalShots}: ${shot.id}`,
      });
    }
  }
  manifest.stage = 'animation_generated';
  manifest = saveManifest(manifest);

  // Step C: Generate narration if missing
  updateJob(job.id, { progress: 65, message: 'Generating narration & mixing multi-track audio...' });
  const narRes = await generateProjectNarration(manifest);
  manifest = narRes.manifest;

  // Step D: Subtitles
  const subEntries = buildSubtitleEntries(manifest);
  const subFiles = exportSubtitlesToFiles(manifest, subEntries);
  manifest.subtitles = subEntries;
  manifest.exports = { ...manifest.exports, ...subFiles };

  // Step E: Mix audio
  const mixedAudio = await mixProjectAudio(manifest);
  manifest.audioConfig.mixedAudioPath = mixedAudio;
  manifest.stage = 'audio_generated';
  manifest = saveManifest(manifest);

  // Step F: Assemble scenes + full episode + optional vertical/square
  updateJob(job.id, { progress: 80, message: 'Assembling scene videos & final episode MP4...' });
  const assembled = await assembleProjectVideo(manifest);
  manifest = saveManifest(assembled.manifest);

  // Step G: Run QC + build ZIP archive
  updateJob(job.id, { progress: 92, message: 'Running automated Quality Control checks...' });
  const qc = await runQualityControl(manifest);
  const zipPath = await createProjectArchiveZip(manifest.projectId);
  manifest.exports.archiveZip = zipPath;
  manifest.stage = qc.overallStatus === 'fail' ? 'assembled' : 'exported';
  saveManifest(manifest);

  updateJob(job.id, {
    progress: 100,
    outputFile: assembled.landscapeMp4,
    message: `Render complete (QC: ${qc.overallStatus.toUpperCase()} — ${qc.summary.passed} passed, ${qc.summary.warnings} warnings).`,
  });
}

async function handleRunQC(job: JobRecord): Promise<void> {
  const manifest = requireManifest(job.projectId);
  const report = await runQualityControl(manifest);
  updateJob(job.id, {
    progress: 100,
    message: `QC finished: ${report.overallStatus.toUpperCase()} (${report.summary.passed} pass, ${report.summary.warnings} warn, ${report.summary.failed} fail)`,
  });
}

function requireManifest(projectId: string): ProjectManifest {
  const m = getManifest(projectId);
  if (!m) throw new Error(`Project "${projectId}" not found.`);
  return m;
}
