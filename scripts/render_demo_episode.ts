import fs from 'node:fs';
import { getQCReport, saveManifest } from '../server/db/database.ts';
import { mixProjectAudio } from '../server/engines/audioMixer.ts';
import { applyCharacterAndEnvironmentConsistency } from '../server/engines/characterEngine.ts';
import { runQualityControl } from '../server/engines/qcEngine.ts';
import { buildSubtitleEntries, exportSubtitlesToFiles } from '../server/engines/subtitleEngine.ts';
import {
  assembleProjectVideo,
  createProjectArchiveZip,
  getTargetDimensions,
} from '../server/engines/videoAssembler.ts';
import { generateProjectNarration } from '../server/engines/voiceEngine.ts';
import { animateShot } from '../server/providers/animationProvider.ts';
import { generateImageWithFallback } from '../server/providers/imageProvider.ts';
import { ensureDemoProjectSeeded } from '../server/services/demoSeed.ts';
import path from 'node:path';
import { getProjectDir } from '../server/db/database.ts';

async function main() {
  console.log('=== Rendering Mahishasura Episode 1 (120s Deterministic Demo) ===');
  let manifest = await ensureDemoProjectSeeded();
  manifest = applyCharacterAndEnvironmentConsistency(manifest);

  const projectDir = getProjectDir(manifest.projectId);
  const dim = getTargetDimensions(
    manifest.outputSettings.resolution,
    manifest.outputSettings.aspectRatio
  );

  for (const scene of manifest.scenes) {
    const env = manifest.environments.find((e) => e.id === scene.environmentId);
    for (const shot of scene.shots) {
      const imgPath = path.join(projectDir, 'storyboard', `${shot.id}.png`);
      const imgRes = await generateImageWithFallback('procedural', {
        prompt: shot.positivePrompt,
        negativePrompt: shot.negativePrompt,
        referenceImages: shot.referenceImages,
        width: dim.width,
        height: dim.height,
        seed: shot.seed,
        outputPath: imgPath,
        label: `${scene.title} · Shot ${shot.shotNumber}`,
        palette: env?.colorPalette,
      });
      if (!imgRes.success) throw new Error(imgRes.errorMessage);
      shot.imageAssetPath = imgRes.outputFile;

      const shotOut = path.join(projectDir, 'shots', `${shot.id}.mp4`);
      if (fs.existsSync(shotOut) && fs.statSync(shotOut).size > 4096) {
        shot.outputFile = shotOut;
        shot.status = 'completed';
        console.log(`  Reused existing ${shot.id} (${shot.duration}s)`);
      } else {
        const animRes = await animateShot({
          imagePath: shot.imageAssetPath,
          durationSeconds: shot.duration,
          fps: manifest.outputSettings.fps,
          width: dim.width,
          height: dim.height,
          motionSpec: shot.motionSpec,
          outputPath: shotOut,
          method: 'deterministic',
        });
        if (!animRes.success) throw new Error(animRes.errorMessage);
        shot.outputFile = animRes.outputFile;
        shot.animationModel = animRes.providerUsed;
        shot.status = 'completed';
        console.log(`  Rendered ${shot.id} (${shot.duration}s) -> ${animRes.fromCache ? 'cache' : 'fresh'}`);
      }
    }
  }

  const nar = await generateProjectNarration(manifest);
  manifest = nar.manifest;

  const subs = buildSubtitleEntries(manifest);
  const subFiles = exportSubtitlesToFiles(manifest, subs);
  manifest.subtitles = subs;
  manifest.exports = { ...manifest.exports, ...subFiles };

  manifest.audioConfig.mixedAudioPath = await mixProjectAudio(manifest);
  manifest = saveManifest(manifest);

  const assembled = await assembleProjectVideo(manifest);
  manifest = saveManifest(assembled.manifest);

  const qc = await runQualityControl(manifest);
  const zip = await createProjectArchiveZip(manifest.projectId);
  manifest.exports.archiveZip = zip;
  manifest.stage = 'exported';
  saveManifest(manifest);

  const savedQc = getQCReport(manifest.projectId);
  console.log('Demo Video Rendered:', assembled.landscapeMp4);
  console.log('Vertical Video Rendered:', assembled.verticalMp4);
  console.log('ZIP Archive:', zip);
  console.log('QC Summary:', savedQc?.summary, 'MediaProbe:', savedQc?.mediaProbe);

  if (!fs.existsSync(assembled.landscapeMp4)) {
    throw new Error('Demo landscape MP4 missing!');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
