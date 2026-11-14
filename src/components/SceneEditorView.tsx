import React, { useState } from 'react';
import { Check, Copy, Film, Image as ImageIcon, RefreshCw, Save, Upload, Video } from 'lucide-react';
import { api, mediaUrl } from '../api';
import { MotionSpec, ProjectManifest, Scene, Shot, TransitionType, VisualEffect } from '../types';

interface Props {
  project: ProjectManifest;
  onProjectUpdated: (p: ProjectManifest) => void;
}

const VFX_OPTIONS: Array<{ id: VisualEffect; label: string }> = [
  { id: 'golden_embers', label: 'Golden Embers' },
  { id: 'god_rays', label: 'God Rays' },
  { id: 'violet_aura', label: 'Violet Aura' },
  { id: 'ground_mist', label: 'Ground Mist' },
  { id: 'fire', label: 'Fire Glow' },
  { id: 'lightning', label: 'Lightning' },
  { id: 'particles', label: 'Particles' },
  { id: 'smoke', label: 'Smoke' },
];

export const SceneEditorView: React.FC<Props> = ({ project, onProjectUpdated }) => {
  const [selectedSceneIdx, setSelectedSceneIdx] = useState(0);
  const [scriptText, setScriptText] = useState(project.script);
  const [pacingMode, setPacingMode] = useState<'standard' | 'shorts_rapid'>(
    project.outputSettings.pacingMode || 'standard'
  );
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const activeScene: Scene | undefined = project.scenes[selectedSceneIdx];

  async function handleReprocessScript() {
    setSaving(true);
    setNotice(null);
    try {
      const res = await api.processScript(
        project.projectId,
        scriptText,
        project.targetDurationSeconds,
        pacingMode
      );
      onProjectUpdated(res.project);
      setNotice(
        `Parsed ${res.project.scenes.length} scenes (${pacingMode === 'shorts_rapid' ? 'Shorts rapid beats' : 'standard pacing'}, est. speech ${res.analysis.estimatedSpeakingSeconds}s).`
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateShot(shotId: string, updater: (s: Shot) => Shot) {
    const nextScenes = project.scenes.map((sc, idx) =>
      idx !== selectedSceneIdx
        ? sc
        : {
            ...sc,
            shots: sc.shots.map((sh) => (sh.id === shotId ? updater(sh) : sh)),
          }
    );
    const res = await api.saveScenes(project.projectId, nextScenes, true);
    onProjectUpdated(res.project);
    setNotice(`Saved settings for shot ${shotId}.`);
  }

  async function handleApproveStoryboard() {
    setSaving(true);
    try {
      const res = await api.approveStoryboard(project.projectId);
      onProjectUpdated(res.project);
      setNotice('Storyboard approved. Ready for animation and video assembly.');
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateImages() {
    setSaving(true);
    try {
      await api.generateAssets(project.projectId);
      setNotice('Storyboard image generation job queued. Check Jobs & Queue for progress.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadShotAsset(category: 'shot_image' | 'shot_clip', shotId: string, file: File) {
    setSaving(true);
    try {
      const res = await api.uploadAsset(project.projectId, category, file, shotId);
      onProjectUpdated(res.project);
      setNotice(
        category === 'shot_clip'
          ? `Attached AI video clip to ${shotId}. Render Video will composite VFX transitions onto it.`
          : `Updated storyboard image for ${shotId}.`
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Scene & Shot Storyboard Editor</h1>
          <p className="mt-1 text-sm text-slate-600">
            Configure camera motion, VFX overlays, transitions, AI video clips, and shot narration.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={handleGenerateImages}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Generate Storyboard Images
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleApproveStoryboard}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Check className="h-3.5 w-3.5" />
            Approve Storyboard
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-700">
          {notice}
        </div>
      )}

      {/* Script Editor Accordion / Panel */}
      <details className="rounded-lg border border-slate-200 bg-white">
        <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-slate-900">
          Master Script Editor ({project.scenes.length} scenes · {project.targetDurationSeconds}s ·{' '}
          {project.outputSettings.pacingMode === 'shorts_rapid' ? 'Shorts Rapid Beats' : 'Standard Pacing'})
        </summary>
        <div className="border-t border-slate-200 p-5 space-y-3">
          <textarea
            rows={7}
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            className="w-full rounded-md border border-slate-300 p-3 font-mono text-xs leading-relaxed"
          />
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={pacingMode}
              onChange={(e) => setPacingMode(e.target.value as 'standard' | 'shorts_rapid')}
              className="rounded-md border border-slate-300 px-3 py-2 text-xs"
            >
              <option value="standard">Standard Pacing (~8–12s shots)</option>
              <option value="shorts_rapid">Shorts Rapid Pacing (~2.5–3.8s beats)</option>
            </select>
            <button
              type="button"
              disabled={saving}
              onClick={handleReprocessScript}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-parse Script into Scenes & Shots
            </button>
          </div>
        </div>
      </details>

      {/* Main Split: Scene List + Shot Editor */}
      {project.scenes.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          No scenes found. Expand the Master Script Editor above and click Re-parse Script.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Scene Selector */}
          <aside className="lg:col-span-4 space-y-2">
            {project.scenes.map((sc, idx) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => setSelectedSceneIdx(idx)}
                className={`w-full rounded-lg border p-3.5 text-left transition-colors ${
                  idx === selectedSceneIdx
                    ? 'border-slate-900 bg-white'
                    : 'border-slate-200 bg-slate-50 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-900 truncate">
                    {sc.sceneNumber}. {sc.title}
                  </span>
                  <span className="font-mono text-xs text-slate-500 tabular-nums shrink-0">
                    {sc.duration}s
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">{sc.narrationText}</p>
                <div className="mt-2 text-[11px] text-slate-500 tabular-nums">
                  {sc.shots.length} shots · {sc.startTime}s – {sc.endTime}s
                </div>
              </button>
            ))}
          </aside>

          {/* Active Scene Shots */}
          <div className="lg:col-span-8 space-y-4">
            {activeScene && (
              <>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900">{activeScene.title}</h2>
                    <span className="font-mono text-xs text-slate-500 tabular-nums">
                      {activeScene.startTime}s – {activeScene.endTime}s ({activeScene.duration}s)
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600">{activeScene.narrationText}</p>
                </div>

                {activeScene.shots.map((shot) => (
                  <ShotCard
                    key={shot.id}
                    shot={shot}
                    onUpdate={(updater) => void handleUpdateShot(shot.id, updater)}
                    onUploadImage={(file) => void handleUploadShotAsset('shot_image', shot.id, file)}
                    onUploadClip={(file) => void handleUploadShotAsset('shot_clip', shot.id, file)}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ShotCard: React.FC<{
  shot: Shot;
  onUpdate: (updater: (s: Shot) => Shot) => void;
  onUploadImage: (file: File) => void;
  onUploadClip: (file: File) => void;
}> = ({ shot, onUpdate, onUploadImage, onUploadClip }) => {
  const [motionPrompt, setMotionPrompt] = useState(shot.motionPrompt);
  const [narration, setNarration] = useState(shot.narrationSegment);
  const [camera, setCamera] = useState<MotionSpec['camera']>(shot.motionSpec.camera);
  const [weather, setWeather] = useState<MotionSpec['weather']>(shot.motionSpec.weather);
  const [transitionOut, setTransitionOut] = useState<TransitionType>(
    shot.motionSpec.transitionOut || 'dissolve'
  );
  const [effects, setEffects] = useState<VisualEffect[]>(shot.motionSpec.effects || []);
  const [copied, setCopied] = useState(false);

  function toggleEffect(fx: VisualEffect) {
    setEffects((prev) => (prev.includes(fx) ? prev.filter((item) => item !== fx) : [...prev, fx]));
  }

  function handleCopyPrompt() {
    const text = `IMAGE PROMPT:\n${shot.positivePrompt}\n\nNEGATIVE:\n${shot.negativePrompt}\n\nMOTION CUE:\n${motionPrompt}`;
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="text-sm font-semibold text-slate-900">
          Shot {shot.shotNumber} <span className="font-mono text-xs font-normal text-slate-500">· {shot.id}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 font-mono tabular-nums">
          <span>{shot.duration}s</span>
          <span>·</span>
          <span className="capitalize">{shot.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
        <div className="sm:col-span-5 space-y-2">
          <div className="aspect-video w-full overflow-hidden rounded-md border border-slate-200 bg-slate-100 flex items-center justify-center">
            {shot.importedClipPath ? (
              <video
                src={mediaUrl(shot.importedClipPath)}
                controls
                muted
                className="h-full w-full object-cover"
              />
            ) : shot.imageAssetPath ? (
              <img
                src={mediaUrl(shot.imageAssetPath)}
                alt={shot.id}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="text-center p-4">
                <Film className="mx-auto h-6 w-6 text-slate-400" />
                <p className="mt-1 text-xs text-slate-500">No storyboard image yet</p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0">
              <Upload className="h-3 w-3" />
              Image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadImage(f);
                }}
              />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0">
              <Video className="h-3 w-3" />
              AI Clip (.mp4)
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadClip(f);
                }}
              />
            </label>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Copy className="h-3 w-3" />
              {copied ? 'Copied!' : 'Copy Prompt'}
            </button>
          </div>
          {shot.importedClipPath && (
            <p className="font-mono text-[11px] text-emerald-700 truncate">
              AI Clip: {shot.importedClipPath.split('/').pop()}
            </p>
          )}
        </div>

        <div className="sm:col-span-7 space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-600">
              Animation Instruction (Natural Language)
            </label>
            <input
              type="text"
              value={motionPrompt}
              onChange={(e) => setMotionPrompt(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-600">Camera</label>
              <select
                value={camera}
                onChange={(e) => setCamera(e.target.value as MotionSpec['camera'])}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
              >
                <option value="zoom_in">Slow Zoom In</option>
                <option value="zoom_out">Slow Zoom Out</option>
                <option value="pan_left">Pan Left</option>
                <option value="pan_right">Pan Right</option>
                <option value="tilt_up">Tilt Up</option>
                <option value="tilt_down">Tilt Down</option>
                <option value="parallax">Parallax</option>
                <option value="shake">Camera Shake</option>
                <option value="static">Static Frame</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600">Weather</label>
              <select
                value={weather}
                onChange={(e) => setWeather(e.target.value as MotionSpec['weather'])}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
              >
                <option value="none">None</option>
                <option value="fog">Fog / Mist</option>
                <option value="rain">Rain</option>
                <option value="snow">Snow</option>
                <option value="storm">Storm + Lightning</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600">Transition Out</label>
              <select
                value={transitionOut}
                onChange={(e) => setTransitionOut(e.target.value as TransitionType)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
              >
                <option value="dissolve">Dissolve</option>
                <option value="flash_white">White Energy Flash</option>
                <option value="flash_violet">Violet Mystic Portal</option>
                <option value="diagonal_slice">Diagonal Slice</option>
                <option value="wipe_left">Wipe Left</option>
                <option value="slide_up">Slide Up</option>
                <option value="circle_open">Circle Open</option>
                <option value="fade">Smooth Fade</option>
                <option value="cut">Hard Cut</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Atmospheric VFX Overlays
            </label>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
              {VFX_OPTIONS.map((fx) => (
                <label key={fx.id} className="inline-flex items-center gap-1.5 text-[11px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={effects.includes(fx.id)}
                    onChange={() => toggleEffect(fx.id)}
                  />
                  {fx.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600">
              Narration & Subtitle Segment
            </label>
            <textarea
              rows={2}
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
            />
          </div>

          <button
            type="button"
            onClick={() =>
              onUpdate((s) => ({
                ...s,
                motionPrompt,
                narrationSegment: narration,
                subtitleSegment: narration,
                motionSpec: {
                  ...s.motionSpec,
                  camera,
                  weather,
                  transitionOut,
                  effects,
                  rawInstruction: motionPrompt,
                },
              }))
            }
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            <Save className="h-3.5 w-3.5" />
            Save Shot Settings
          </button>
        </div>
      </div>
    </div>
  );
};
