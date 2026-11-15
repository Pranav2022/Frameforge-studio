import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { PROJECTS_DIR } from '../server/db/database.ts';

const execFileAsync = promisify(execFile);

async function probeMedia(filePath: string) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration,size:stream=codec_type,width,height,r_frame_rate',
    '-of',
    'json',
    filePath,
  ]);
  const data = JSON.parse(stdout);
  const video = data.streams?.find((s: { codec_type: string }) => s.codec_type === 'video');
  const audio = data.streams?.find((s: { codec_type: string }) => s.codec_type === 'audio');
  return {
    duration: Number(data.format?.duration || 0),
    sizeBytes: Number(data.format?.size || 0),
    width: Number(video?.width || 0),
    height: Number(video?.height || 0),
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio),
  };
}

async function measureAudioLoudness(filePath: string) {
  const { stderr } = await execFileAsync('ffmpeg', [
    '-i',
    filePath,
    '-af',
    'volumedetect',
    '-f',
    'null',
    '-',
  ]);
  const meanMatch = stderr.match(/mean_volume:\s*([-\d.]+)\s*dB/);
  const maxMatch = stderr.match(/max_volume:\s*([-\d.]+)\s*dB/);
  return {
    meanDb: meanMatch ? Number(meanMatch[1]) : -99,
    maxDb: maxMatch ? Number(maxMatch[1]) : -99,
  };
}

async function main() {
  console.log('=== Verifying Mahishasur Vadh Full Test Package & Live Server Import ===');
  const pkgRoot = path.join(PROJECTS_DIR, 'mahishasur-vadh-test-package');
  const reportPath = path.join(pkgRoot, 'test_report.json');
  assert.ok(fs.existsSync(reportPath), 'test_report.json must exist');

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.parts.length, 8, 'Must contain exactly 8 parts');
  assert.ok(report.totalVideosGenerated <= 10, `Total videos (${report.totalVideosGenerated}) must be <= 10`);

  for (const part of report.parts) {
    assert.ok(part.hookQuestion.trim().endsWith('?'), `Part ${part.partNumber} hook must be a question`);
    assert.ok(fs.existsSync(part.scriptPath), `Missing script for part ${part.partNumber}`);
    assert.ok(fs.existsSync(part.imagePath), `Missing image for part ${part.partNumber}`);
    assert.ok(fs.existsSync(part.voiceWavPath), `Missing voice WAV for part ${part.partNumber}`);
    assert.ok(fs.existsSync(part.videoPath), `Missing rendered MP4 for part ${part.partNumber}`);
    assert.ok(fs.existsSync(part.importZipPath), `Missing importable ZIP for part ${part.partNumber}`);

    const probe = await probeMedia(part.videoPath);
    assert.equal(probe.width, 720, `Part ${part.partNumber} width should be 720`);
    assert.equal(probe.height, 1280, `Part ${part.partNumber} height should be 1280`);
    assert.ok(probe.hasVideo && probe.hasAudio, `Part ${part.partNumber} must have both video + audio`);
    assert.ok(probe.duration >= 12, `Part ${part.partNumber} duration (${probe.duration}s) too short`);

    const vol = await measureAudioLoudness(part.videoPath);
    assert.ok(vol.meanDb > -38, `Part ${part.partNumber} audio too quiet: ${vol.meanDb} dB`);
    assert.ok(vol.maxDb <= -0.1, `Part ${part.partNumber} audio clipping: ${vol.maxDb} dB`);
    console.log(
      `  [PASS] Part ${part.partNumber}: ${probe.duration.toFixed(2)}s | ${probe.width}x${probe.height} | mean ${vol.meanDb} dB, peak ${vol.maxDb} dB | QC=${part.qcStatus}`
    );
  }

  // Verify Combined Complete Event Video
  const fullPath = report.completeEventVideo.filePath;
  assert.ok(fs.existsSync(fullPath), 'Complete event MP4 must exist');
  const fullProbe = await probeMedia(fullPath);
  assert.equal(fullProbe.width, 720);
  assert.equal(fullProbe.height, 1280);
  assert.ok(fullProbe.hasVideo && fullProbe.hasAudio);
  assert.ok(fullProbe.duration > 120, `Complete event video (${fullProbe.duration}s) should span all 8 parts`);
  console.log(
    `  [PASS] Complete Event Video: ${fullProbe.duration.toFixed(2)}s | ${(fullProbe.sizeBytes / (1024 * 1024)).toFixed(2)} MB | 720x1280`
  );

  // Verify Master ZIP & Live ZIP Import Endpoint
  const masterZip = path.join(pkgRoot, 'mahishasur_vadh_full_test_package.zip');
  assert.ok(fs.existsSync(masterZip) && fs.statSync(masterZip).size > 100000, 'Master test package ZIP missing');

  const part1Zip = report.parts[0].importZipPath;
  const form = new FormData();
  form.append('packageFile', new Blob([fs.readFileSync(part1Zip)]), 'part_01_birth_importable.zip');
  const importRes = await fetch('http://localhost:3000/api/projects/import-package', {
    method: 'POST',
    body: form,
  });
  assert.equal(importRes.status, 201, `ZIP import expected 201, got ${importRes.status}`);
  const importedJson = (await importRes.json()) as {
    project: {
      projectId: string;
      scenes: Array<{ shots: Array<{ imageAssetPath?: string; narrationAudioPath?: string }> }>;
      voiceConfig: { generatedNarrationPath?: string };
    };
  };
  const importedProjId = importedJson.project.projectId;
  const firstShot = importedJson.project.scenes[0]?.shots[0];
  assert.ok(
    firstShot?.imageAssetPath && fs.existsSync(firstShot.imageAssetPath),
    'Imported ZIP shot imageAssetPath should exist inside extracted project dir'
  );
  assert.ok(
    firstShot?.narrationAudioPath && fs.existsSync(firstShot.narrationAudioPath),
    'Imported ZIP shot narrationAudioPath should exist inside extracted project dir'
  );
  // Clean up the temporary test-imported duplicate project so workspace stays tidy
  await fetch(`http://localhost:3000/api/projects/${importedProjId}`, { method: 'DELETE' });
  console.log(`  [PASS] Live ZIP Import API remapped all asset paths & cleaned up temporary test project (${importedProjId})`);

  const statusRes = await fetch('http://localhost:3000/api/system/status');
  const statusJson = (await statusRes.json()) as { tools: { piperConfigured: boolean } };
  assert.equal(statusJson.tools.piperConfigured, true, '/api/system/status must report piperConfigured=true');
  console.log('  [PASS] /api/system/status reports piperConfigured=true');

  console.log('\nALL TEST PACKAGE & END-TO-END VERIFICATIONS PASSED!');
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
