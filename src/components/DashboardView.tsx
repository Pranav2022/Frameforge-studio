import React from 'react';
import {
  CheckCircle2,
  FolderOpen,
  HardDrive,
  Plus,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Cpu,
} from 'lucide-react';
import { ProjectManifest, SystemStatusReport } from '../types';

interface Props {
  projects: ProjectManifest[];
  activeProjectId: string | null;
  systemStatus: SystemStatusReport | null;
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onCreateNew: () => void;
  onCreateShortsSample: () => void;
  onRefreshStatus: () => void;
  onClearCache: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export const DashboardView: React.FC<Props> = ({
  projects,
  activeProjectId,
  systemStatus,
  onSelectProject,
  onDeleteProject,
  onCreateNew,
  onCreateShortsSample,
  onRefreshStatus,
  onClearCache,
}) => {
  return (
    <div className="space-y-8">
      {/* Header Row */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Production Workspace
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage video projects, inspect local rendering tools, and monitor disk cache on low-VRAM hardware.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onCreateShortsSample}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            Load 9:16 Short Demo
          </button>
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            New Video Project
          </button>
        </div>
      </div>

      {/* Hardware & Storage Summary Grid (4-column KPI strip) */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Host Hardware</span>
            <Cpu className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-lg font-semibold text-slate-900 tabular-nums">
            {systemStatus ? `${systemStatus.cpuCores} Cores · ${systemStatus.totalRamGb} GB RAM` : 'Checking...'}
          </p>
          <p className="mt-1 text-xs text-slate-500 truncate">
            {systemStatus ? `${systemStatus.freeRamGb} GB RAM free · ${systemStatus.platform}` : 'Reading host metrics'}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>VRAM Guardrail</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-lg font-semibold text-slate-900 tabular-nums">
            {systemStatus ? `${(systemStatus.vramBudgetMb / 1024).toFixed(0)} GB Budget` : '4 GB Budget'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {systemStatus?.lowVramMode ? 'Sequential single-model mode active' : 'Standard memory mode'}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Projects Storage</span>
            <HardDrive className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-lg font-semibold text-slate-900 tabular-nums">
            {systemStatus ? formatBytes(systemStatus.storage.projectsBytes) : '0 B'}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {projects.length} project{projects.length === 1 ? '' : 's'} stored locally
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Asset Cache</span>
            <button
              type="button"
              onClick={onClearCache}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
            >
              Clear
            </button>
          </div>
          <p className="mt-2 text-lg font-semibold text-slate-900 tabular-nums">
            {systemStatus ? formatBytes(systemStatus.storage.cacheBytes) : '0 B'}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {systemStatus ? `${systemStatus.storage.cacheFiles} cached renders` : 'Hash-deduplicated'}
          </p>
        </div>
      </section>

      {/* Projects Table */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-base font-semibold text-slate-900">Recent Projects</h2>
          <span className="text-xs text-slate-500 tabular-nums">{projects.length} total</span>
        </div>

        {projects.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-900">No projects yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Create a project from a script, story idea, or ZIP package to begin video production.
            </p>
            <button
              type="button"
              onClick={onCreateNew}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Create First Project
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="px-5 py-3">Project Name</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3 text-right">Scenes / Shots</th>
                  <th className="px-4 py-3 text-right">Target Duration</th>
                  <th className="px-4 py-3">Output Format</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {projects.map((p) => {
                  const shotCount = p.scenes.reduce((acc, s) => acc + s.shots.length, 0);
                  const isActive = p.projectId === activeProjectId;
                  return (
                    <tr
                      key={p.projectId}
                      className={isActive ? 'bg-amber-50/40' : 'hover:bg-slate-50'}
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-900">{p.name}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {p.projectId} · Updated {new Date(p.updatedAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-medium text-slate-700 capitalize">
                        {p.stage.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-700 tabular-nums">
                        {p.scenes.length} / {shotCount}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-700 tabular-nums">
                        {p.targetDurationSeconds}s
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600 tabular-nums">
                        {p.outputSettings.resolution} · {p.outputSettings.aspectRatio} · {p.outputSettings.fps}fps
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectProject(p.projectId)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            {isActive ? 'Opened' : 'Open'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProject(p.projectId)}
                            title="Delete project"
                            className="inline-flex items-center rounded-md border border-slate-200 p-1.5 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Local Tooling & Model Availability Table */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Local Engine & AI Provider Availability</h2>
            <p className="text-xs text-slate-500">
              Deterministic FFmpeg animation always works offline at zero cost; local AI providers plug in automatically when running.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshStatus}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Re-scan
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="px-5 py-2.5">Component</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-5 py-2.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              <tr>
                <td className="px-5 py-3 font-medium text-slate-900">FFmpeg + FFprobe</td>
                <td className="px-4 py-3 text-slate-600">Deterministic animation, mixing, QC</td>
                <td className="px-4 py-3">
                  <StatusText ok={Boolean(systemStatus?.tools.ffmpegAvailable)} okLabel="Ready" failLabel="Missing" />
                </td>
                <td className="px-5 py-3 font-mono text-slate-500 truncate max-w-md">
                  {systemStatus?.tools.ffmpegVersion || 'Detecting...'}
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-medium text-slate-900">ImageMagick Compositor</td>
                <td className="px-4 py-3 text-slate-600">Procedural plates & reference compositing</td>
                <td className="px-4 py-3">
                  <StatusText ok={Boolean(systemStatus?.tools.imagemagickAvailable)} okLabel="Ready" failLabel="FFmpeg Fallback" />
                </td>
                <td className="px-5 py-3 text-slate-500">0 GB VRAM · Offline plate rendering</td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-medium text-slate-900">Local ComfyUI (SD 1.5 / AnimateDiff)</td>
                <td className="px-4 py-3 text-slate-600">Optional generative images & short I2V clips</td>
                <td className="px-4 py-3">
                  <StatusText ok={Boolean(systemStatus?.tools.comfyUiReachable)} okLabel="Connected" failLabel="Offline (Fallback Active)" />
                </td>
                <td className="px-5 py-3 text-slate-500">Port 8188 · Uses procedural/imported plates when offline</td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-medium text-slate-900">Local Ollama LLM</td>
                <td className="px-4 py-3 text-slate-600">Optional story-to-script drafting</td>
                <td className="px-4 py-3">
                  <StatusText ok={Boolean(systemStatus?.tools.ollamaReachable)} okLabel="Connected" failLabel="Offline (Outline Mode)" />
                </td>
                <td className="px-5 py-3 text-slate-500">Port 11434 · Deterministic outline generator active when offline</td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-medium text-slate-900">Piper / Kokoro TTS</td>
                <td className="px-4 py-3 text-slate-600">Offline narration synthesis</td>
                <td className="px-4 py-3">
                  <StatusText ok={Boolean(systemStatus?.tools.piperConfigured)} okLabel="Configured" failLabel="Cadence / User Audio" />
                </td>
                <td className="px-5 py-3 text-slate-500">Upload recorded voiceover or configure PIPER_BINARY_PATH</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const StatusText: React.FC<{ ok: boolean; okLabel: string; failLabel: string }> = ({
  ok,
  okLabel,
  failLabel,
}) => (
  <span className={`inline-flex items-center gap-1.5 font-medium ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>
    {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
    {ok ? okLabel : failLabel}
  </span>
);
