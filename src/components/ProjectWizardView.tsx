import React, { useState } from 'react';
import { FileUp, Sparkles, Video } from 'lucide-react';
import { api } from '../api';
import { AspectRatio, ProjectManifest, Resolution } from '../types';

interface Props {
  onProjectCreated: (project: ProjectManifest) => void;
}

export const ProjectWizardView: React.FC<Props> = ({ onProjectCreated }) => {
  const [mode, setMode] = useState<'guided' | 'package' | 'assist'>('guided');
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [script, setScript] = useState(
    `SCENE 1: Opening - Dawn Horizon
[MOTION: Slow zoom-in with warm golden light rays]
NARRATOR: Every story begins before the first light breaks across the horizon.

SCENE 2: Rising Action - Central Courtyard
[MOTION: Slow pan right with subtle fog]
NARRATOR: Piece by piece, the tension builds until decisive action becomes unavoidable.`
  );
  const [duration, setDuration] = useState<number>(60);
  const [narrationLanguage, setNarrationLanguage] = useState('en');
  const [subtitleLanguage, setSubtitleLanguage] = useState('en');
  const [visualStyle, setVisualStyle] = useState('cinematic painterly illustration');
  const [resolution, setResolution] = useState<Resolution>('720p');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [fps, setFps] = useState<24 | 25 | 30>(24);
  const [pacingMode, setPacingMode] = useState<'standard' | 'shorts_rapid'>('standard');
  const [burnSubtitles, setBurnSubtitles] = useState(false);
  const [watermarkText, setWatermarkText] = useState('');
  const [exportVerticalAlso, setExportVerticalAlso] = useState(true);
  const [consentVerified, setConsentVerified] = useState(false);

  const [assistTopic, setAssistTopic] = useState('');
  const [assistSource, setAssistSource] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyShortsPreset() {
    setAspectRatio('9:16');
    setResolution('720p');
    setFps(25);
    setPacingMode('shorts_rapid');
    setDuration(60);
    setBurnSubtitles(true);
    setExportVerticalAlso(false);
    setVisualStyle('3D cinematic mythological fantasy illustration, volumetric god rays, golden embers');
    if (!watermarkText) setWatermarkText('MY CHANNEL');
  }

  async function handleCreateGuided(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a project name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.createProject({
        name,
        topic,
        description,
        script,
        targetDurationSeconds: duration,
        narrationLanguage,
        subtitleLanguage,
        visualStyle,
        resolution,
        aspectRatio,
        fps,
        pacingMode,
        burnSubtitles,
        watermarkText,
        exportVerticalAlso,
        consentVerified,
      });
      onProjectCreated(res.project);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadScriptFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setScript(text);
  }

  async function handleImportPackage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.importPackage(file);
      onProjectCreated(res.project);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Package import failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateDraft() {
    if (!assistTopic.trim()) {
      setError('Enter a topic or story summary first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const draft = await api.aiDraftFromTopic({
        topic: assistTopic,
        targetDurationSeconds: duration,
        language: narrationLanguage,
        visualStyle,
      });
      setScript(draft.script);
      if (!name.trim()) setName(assistTopic.slice(0, 48));
      setTopic(assistTopic);
      setAssistSource(
        draft.source === 'ollama-local'
          ? 'Draft generated using local Ollama model.'
          : 'Draft generated using offline structured outline builder (Ollama not running).'
      );
      setMode('guided');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate story draft');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-semibold text-slate-900">Create Video Project</h1>
        <p className="mt-1 text-sm text-slate-600">
          Start with a complete script, upload an existing manifest/ZIP package, or draft scenes from a short topic.
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode('guided')}
          className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            mode === 'guided' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          1. Guided Form & Script
        </button>
        <button
          type="button"
          onClick={() => setMode('package')}
          className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            mode === 'package' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          2. Import JSON / ZIP Package
        </button>
        <button
          type="button"
          onClick={() => setMode('assist')}
          className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            mode === 'assist' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          3. Story-to-Script Draft
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {assistSource && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          {assistSource} Review and customize the script below before creating your project.
        </div>
      )}

      {mode === 'package' && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-start gap-3">
            <FileUp className="h-5 w-5 text-slate-600 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">Import Manifest or Project ZIP</h2>
              <p className="mt-1 text-xs text-slate-600">
                Upload a versioned <span className="font-mono">manifest.json</span> or a <span className="font-mono">.zip</span> bundle containing your script and reference assets.
              </p>
            </div>
          </div>
          <input
            type="file"
            accept=".json,.zip"
            disabled={busy}
            onChange={handleImportPackage}
            className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-slate-800"
          />
        </div>
      )}

      {mode === 'assist' && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">Story-to-Script Draft Builder</h2>
              <p className="mt-1 text-xs text-slate-600">
                Uses your local Ollama LLM if running on port 11434, or our offline structured scene planner at zero cost.
              </p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Topic or Story Summary</label>
            <textarea
              rows={4}
              value={assistTopic}
              onChange={(e) => setAssistTopic(e.target.value)}
              placeholder="Example: A 2-minute educational documentary explaining how deep-ocean hydrothermal vents sustain life without sunlight..."
              className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={handleGenerateDraft}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? 'Generating Draft...' : 'Generate Editable Script Draft'}
          </button>
        </div>
      )}

      {mode === 'guided' && (
        <form onSubmit={handleCreateGuided} className="rounded-lg border border-slate-200 bg-white p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50/70 px-4 py-3">
            <div className="text-xs text-slate-700">
              <span className="font-semibold text-slate-900">Shorts / Reels Format:</span> Auto-configure 9:16 vertical, 25 FPS, rapid 3s micro-beats, burned-in captions, and corner watermark.
            </div>
            <button
              type="button"
              onClick={applyShortsPreset}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              9:16 Vertical Short / Reel (25 FPS · Rapid 3s Beats)
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Project Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Mahishasura Birth Mystery Short"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Topic / Theme</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Mythology & Storytelling"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary of goals and audience"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            />
          </div>

          {/* Output & Duration Settings */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <label className="block text-xs font-medium text-slate-700">Target Duration</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              >
                <option value={30}>30 seconds</option>
                <option value={45}>45 seconds</option>
                <option value={60}>60 seconds</option>
                <option value={75}>75 seconds (Short)</option>
                <option value={120}>120 seconds (2 min)</option>
                <option value={300}>5 minutes</option>
                <option value={900}>15 minutes</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Resolution</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as Resolution)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              >
                <option value="720p">720p (Fastest)</option>
                <option value="1080p">1080p Full HD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Aspect Ratio</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              >
                <option value="16:9">16:9 Landscape</option>
                <option value="9:16">9:16 Vertical</option>
                <option value="1:1">1:1 Square</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Frame Rate</label>
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value) as 24 | 25 | 30)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              >
                <option value={24}>24 FPS (Cinema)</option>
                <option value={25}>25 FPS (Reels / PAL)</option>
                <option value={30}>30 FPS (Standard)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Cut Pacing</label>
              <select
                value={pacingMode}
                onChange={(e) => setPacingMode(e.target.value as 'standard' | 'shorts_rapid')}
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              >
                <option value="standard">Standard (~8–12s shots)</option>
                <option value="shorts_rapid">Shorts Rapid (~2.5–3.8s)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Language</label>
              <select
                value={narrationLanguage}
                onChange={(e) => {
                  setNarrationLanguage(e.target.value);
                  setSubtitleLanguage(e.target.value);
                }}
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
              >
                <option value="en">English</option>
                <option value="hi">Hindi (हिन्दी)</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Visual Style Preference</label>
              <input
                type="text"
                value={visualStyle}
                onChange={(e) => setVisualStyle(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Channel Watermark Text (Optional)</label>
              <input
                type="text"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                placeholder="e.g., THE DIVINE JOURNEY"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col justify-end gap-2 pb-1">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={burnSubtitles}
                  onChange={(e) => setBurnSubtitles(e.target.checked)}
                />
                Burn bold captions directly into MP4
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={exportVerticalAlso}
                  onChange={(e) => setExportVerticalAlso(e.target.checked)}
                />
                Also export reframed 9:16 vertical version
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={consentVerified}
                  onChange={(e) => setConsentVerified(e.target.checked)}
                />
                Confirm voice sample ownership permission
              </label>
            </div>
          </div>

          {/* Script Input */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-700">
                Complete Script (Supports SCENE headers, [MOTION: ...] cues, CHARACTER: dialogue)
              </label>
              <label className="cursor-pointer text-xs font-medium text-slate-700 underline hover:text-slate-900">
                Load .txt script file
                <input type="file" accept=".txt,.md" onChange={handleUploadScriptFile} className="hidden" />
              </label>
            </div>
            <textarea
              rows={9}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs leading-relaxed focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Video className="h-4 w-4" />
              {busy ? 'Creating & Parsing Script...' : 'Create Project & Break Down Scenes'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
