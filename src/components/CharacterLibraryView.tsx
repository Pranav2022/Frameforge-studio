import React, { useState } from 'react';
import { ImagePlus, Mic, Music, Plus, ShieldCheck, UserCheck } from 'lucide-react';
import { api, mediaUrl } from '../api';
import { Character, Environment, ProjectManifest } from '../types';

interface Props {
  project: ProjectManifest;
  onProjectUpdated: (p: ProjectManifest) => void;
}

export const CharacterLibraryView: React.FC<Props> = ({ project, onProjectUpdated }) => {
  const [newCharName, setNewCharName] = useState('');
  const [newCharAppearance, setNewCharAppearance] = useState('');
  const [newCharClothing, setNewCharClothing] = useState('');
  const [newCharSeed, setNewCharSeed] = useState('2048');

  const [newEnvName, setNewEnvName] = useState('');
  const [newEnvDesc, setNewEnvDesc] = useState('');
  const [newEnvLighting, setNewEnvLighting] = useState('warm dramatic sunlight');

  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [wmText, setWmText] = useState(project.brandingConfig?.watermarkText || '');
  const [wmColor, setWmColor] = useState(project.brandingConfig?.color || '#F59E0B');
  const [wmPosition, setWmPosition] = useState<
    'bottom_right' | 'bottom_left' | 'top_right' | 'top_left'
  >(project.brandingConfig?.position || 'bottom_right');
  const [wmOpacity, setWmOpacity] = useState(project.brandingConfig?.opacity ?? 0.82);
  const [busy, setBusy] = useState(false);

  async function handleAddCharacter(e: React.FormEvent) {
    e.preventDefault();
    if (!newCharName.trim()) return;
    setBusy(true);
    try {
      const res = await api.saveCharacter(project.projectId, {
        name: newCharName.trim(),
        appearance: newCharAppearance.trim(),
        clothing: newCharClothing.trim(),
        fixedSeed: Number(newCharSeed) || 1024,
      });
      onProjectUpdated(res.project);
      setNewCharName('');
      setNewCharAppearance('');
      setNewCharClothing('');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddEnvironment(e: React.FormEvent) {
    e.preventDefault();
    if (!newEnvName.trim()) return;
    setBusy(true);
    try {
      const res = await api.saveEnvironment(project.projectId, {
        name: newEnvName.trim(),
        description: newEnvDesc.trim(),
        lighting: newEnvLighting.trim(),
      });
      onProjectUpdated(res.project);
      setNewEnvName('');
      setNewEnvDesc('');
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadAsset(category: string, file: File, targetId?: string) {
    setBusy(true);
    setVoiceMessage(null);
    try {
      const res = await api.uploadAsset(project.projectId, category, file, targetId);
      onProjectUpdated(res.project);
      if (res.voiceValidation) {
        const v = res.voiceValidation as { durationSeconds?: number; sampleRate?: number; warnings?: string[] };
        setVoiceMessage(
          `Voice sample validated: ${v.durationSeconds ?? 0}s @ ${v.sampleRate ?? 0} Hz. ${(v.warnings || []).join(' ')}`
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleConsent(checked: boolean) {
    const res = await api.updateProject(project.projectId, {
      voiceConfig: { ...project.voiceConfig, consentVerified: checked },
    });
    onProjectUpdated(res.project);
  }

  async function saveBranding(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.updateProject(project.projectId, {
        brandingConfig: {
          ...project.brandingConfig,
          watermarkText: wmText.trim(),
          color: wmColor,
          position: wmPosition,
          opacity: wmOpacity,
        },
      });
      onProjectUpdated(res.project);
      setVoiceMessage('Channel watermark settings saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-semibold text-slate-900">Characters, Environments & Voice Identity</h1>
        <p className="mt-1 text-sm text-slate-600">
          Lock character visual descriptors, reference images, world backdrops, and consent-verified audio assets.
        </p>
      </div>

      {/* Characters Section */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Character Library ({project.characters.length})</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {project.characters.map((ch: Character) => (
            <div key={ch.id} className="flex gap-4 rounded-lg border border-slate-200 bg-white p-4">
              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 flex items-center justify-center">
                {ch.referenceImages[0] ? (
                  <img
                    src={mediaUrl(ch.referenceImages[0])}
                    alt={ch.name}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserCheck className="h-7 w-7 text-slate-400" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900 truncate">{ch.name}</h3>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    Seed {ch.fixedSeed ?? 'auto'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2">{ch.appearance || ch.description || 'No appearance notes'}</p>
                {ch.clothing && (
                  <p className="text-xs text-slate-500 truncate">Attire: {ch.clothing}</p>
                )}
                <div className="pt-1">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    <ImagePlus className="h-3.5 w-3.5" />
                    Upload Reference
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleUploadAsset('character', f, ch.id);
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Character Form */}
        <form onSubmit={handleAddCharacter} className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-800 mb-3">Add Character Profile</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input
              type="text"
              placeholder="Character Name *"
              value={newCharName}
              onChange={(e) => setNewCharName(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <input
              type="text"
              placeholder="Face & Appearance"
              value={newCharAppearance}
              onChange={(e) => setNewCharAppearance(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <input
              type="text"
              placeholder="Clothing & Accessories"
              value={newCharClothing}
              onChange={(e) => setNewCharClothing(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Seed"
                value={newCharSeed}
                onChange={(e) => setNewCharSeed(e.target.value)}
                className="w-24 rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
              />
              <button
                type="submit"
                disabled={busy}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Environments Section */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Environments ({project.environments.length})</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {project.environments.map((env: Environment) => (
            <div key={env.id} className="flex gap-4 rounded-lg border border-slate-200 bg-white p-4">
              <div className="h-24 w-36 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 flex items-center justify-center">
                {env.backgroundImage ? (
                  <img
                    src={mediaUrl(env.backgroundImage)}
                    alt={env.name}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-slate-400">No Plate</span>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="font-semibold text-slate-900 truncate">{env.name}</h3>
                <p className="text-xs text-slate-600 line-clamp-2">{env.description}</p>
                <p className="text-xs text-slate-500 truncate">Lighting: {env.lighting}</p>
                <label className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  <ImagePlus className="h-3.5 w-3.5" />
                  Upload Backdrop
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUploadAsset('environment', f, env.id);
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddEnvironment} className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-800 mb-3">Add Environment Backdrop</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input
              type="text"
              placeholder="Location Name *"
              value={newEnvName}
              onChange={(e) => setNewEnvName(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <input
              type="text"
              placeholder="Visual Description"
              value={newEnvDesc}
              onChange={(e) => setNewEnvDesc(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <input
              type="text"
              placeholder="Lighting Style"
              value={newEnvLighting}
              onChange={(e) => setNewEnvLighting(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Add World
            </button>
          </div>
        </form>
      </section>

      {/* Voice & Background Audio Section */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-slate-700" />
            <h2 className="text-sm font-semibold text-slate-900">Voice Sample & Consent</h2>
          </div>
          <p className="text-xs text-slate-600">
            Upload a clean WAV/MP3 reference voice (for consent-based cloning) or upload your own recorded narration track.
          </p>
          <label className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={project.voiceConfig.consentVerified}
              onChange={(e) => void toggleConsent(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-emerald-700" />
              I confirm this voice belongs to me or I hold explicit permission from the voice artist.
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50">
              Upload Voice Sample
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUploadAsset('voice_sample', f);
                }}
              />
            </label>
            <label className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50">
              Upload Recorded Narration
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUploadAsset('narration', f);
                }}
              />
            </label>
          </div>
          {voiceMessage && <p className="text-xs text-emerald-700">{voiceMessage}</p>}
          {project.voiceConfig.voiceSamplePath && (
            <p className="font-mono text-xs text-slate-500 truncate">
              Sample: {project.voiceConfig.voiceSamplePath.split('/').pop()}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Music className="h-4 w-4 text-slate-700" />
            <h2 className="text-sm font-semibold text-slate-900">Background Music & Audio Ducking</h2>
          </div>
          <p className="text-xs text-slate-600">
            Upload royalty-free / licensed background music. The audio mixer automatically ducks music underneath narration.
          </p>
          <label className="inline-block cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50">
            Upload Music Track (WAV / MP3)
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUploadAsset('music', f);
              }}
            />
          </label>
          <div className="text-xs text-slate-600">
            {project.audioConfig.backgroundMusicPath
              ? `Music: ${project.audioConfig.backgroundMusicPath.split('/').pop()}`
              : 'No custom music uploaded (zero-copyright ambient tone bed will be synthesized automatically).'}
          </div>
        </div>
      </section>

      {/* Channel Watermark & Branding Section */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Channel Watermark & Branding</h2>
          <p className="text-xs text-slate-500">
            Overlay a persistent channel handle text or transparent PNG logo onto the exported video corner.
          </p>
        </div>
        <form onSubmit={saveBranding} className="grid grid-cols-1 gap-3 sm:grid-cols-5 items-end">
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-medium text-slate-600">Watermark Text</label>
            <input
              type="text"
              value={wmText}
              onChange={(e) => setWmText(e.target.value)}
              placeholder="e.g., THE DIVINE JOURNEY"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600">Corner</label>
            <select
              value={wmPosition}
              onChange={(e) =>
                setWmPosition(
                  e.target.value as 'bottom_right' | 'bottom_left' | 'top_right' | 'top_left'
                )
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
            >
              <option value="bottom_right">Bottom Right</option>
              <option value="bottom_left">Bottom Left</option>
              <option value="top_right">Top Right</option>
              <option value="top_left">Top Left</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600">
              Color & Opacity ({Math.round(wmOpacity * 100)}%)
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={wmColor}
                onChange={(e) => setWmColor(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
              />
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={wmOpacity}
                onChange={(e) => setWmOpacity(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              Save Branding
            </button>
            <label className="cursor-pointer rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0">
              PNG Logo
              <input
                type="file"
                accept="image/png,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUploadAsset('watermark', f);
                }}
              />
            </label>
          </div>
        </form>
        {project.brandingConfig?.watermarkImagePath && (
          <p className="font-mono text-xs text-slate-500">
            Logo active: {project.brandingConfig.watermarkImagePath.split('/').pop()}
          </p>
        )}
      </section>
    </div>
  );
};
