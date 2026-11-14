import { JobRecord, ProjectManifest, QCReport, SystemStatusReport } from './types';

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function mediaUrl(filePath?: string): string {
  if (!filePath) return '';
  return `/api/media?path=${encodeURIComponent(filePath)}`;
}

export const api = {
  getSystemStatus: () => apiFetch<SystemStatusReport>('/api/system/status'),
  clearCache: () => apiFetch<{ removedFiles: number }>('/api/system/clear-cache', { method: 'POST' }),

  listProjects: () => apiFetch<{ projects: ProjectManifest[] }>('/api/projects'),
  getProject: (id: string) =>
    apiFetch<{
      project: ProjectManifest;
      assets: Array<Record<string, unknown>>;
      jobs: JobRecord[];
      qcReport: QCReport | null;
    }>(`/api/projects/${id}`),

  createProject: (payload: Record<string, unknown>) =>
    apiFetch<{ project: ProjectManifest; analysisWarnings: string[] }>('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  updateProject: (id: string, patch: Partial<ProjectManifest>) =>
    apiFetch<{ project: ProjectManifest }>(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),

  deleteProject: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),

  importPackage: (file: File) => {
    const form = new FormData();
    form.append('packageFile', file);
    return apiFetch<{ project: ProjectManifest }>('/api/projects/import-package', {
      method: 'POST',
      body: form,
    });
  },

  aiDraftFromTopic: (payload: {
    topic: string;
    targetDurationSeconds: number;
    language: string;
    visualStyle: string;
  }) =>
    apiFetch<{
      source: 'ollama-local' | 'structured-outline';
      script: string;
      suggestedCharacters: Array<{ name: string; appearance: string; clothing: string }>;
      suggestedEnvironments: Array<{ name: string; description: string; lighting: string }>;
    }>('/api/ai-assist/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  createShortsSample: () =>
    apiFetch<{ project: ProjectManifest }>('/api/demo/create-shorts-sample', { method: 'POST' }),

  processScript: (
    id: string,
    script: string,
    targetDurationSeconds: number,
    pacingMode?: 'standard' | 'shorts_rapid'
  ) =>
    apiFetch<{
      project: ProjectManifest;
      analysis: { warnings: string[]; estimatedSpeakingSeconds: number; detectedCharacters: string[] };
    }>(`/api/projects/${id}/process-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script, targetDurationSeconds, pacingMode }),
    }),

  validateProject: (id: string) =>
    apiFetch<{
      valid: boolean;
      schemaErrors: Array<{ message: string }>;
      durationValidation: { valid: boolean; totalSceneDuration: number; issues: string[] };
    }>(`/api/projects/${id}/validate`, { method: 'POST' }),

  saveCharacter: (id: string, char: Record<string, unknown>) =>
    apiFetch<{ project: ProjectManifest }>(`/api/projects/${id}/characters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(char),
    }),

  saveEnvironment: (id: string, env: Record<string, unknown>) =>
    apiFetch<{ project: ProjectManifest }>(`/api/projects/${id}/environments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(env),
    }),

  saveScenes: (id: string, scenes: unknown[], preserveMotionSpec = true) =>
    apiFetch<{ project: ProjectManifest }>(`/api/projects/${id}/scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenes, preserveMotionSpec }),
    }),

  uploadAsset: (id: string, category: string, file: File, targetId?: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('category', category);
    if (targetId) form.append('targetId', targetId);
    return apiFetch<{ project: ProjectManifest; filePath: string; voiceValidation?: Record<string, unknown> }>(
      `/api/projects/${id}/assets`,
      { method: 'POST', body: form }
    );
  },

  generateAssets: (id: string) =>
    apiFetch<{ job: JobRecord }>(`/api/projects/${id}/generate-assets`, { method: 'POST' }),
  approveStoryboard: (id: string) =>
    apiFetch<{ project: ProjectManifest }>(`/api/projects/${id}/approve-storyboard`, { method: 'POST' }),
  generateNarration: (id: string) =>
    apiFetch<{ job: JobRecord }>(`/api/projects/${id}/generate-narration`, { method: 'POST' }),
  generateSubtitles: (id: string) =>
    apiFetch<{ job: JobRecord }>(`/api/projects/${id}/generate-subtitles`, { method: 'POST' }),
  generateVideo: (id: string) =>
    apiFetch<{ job: JobRecord }>(`/api/projects/${id}/generate-video`, { method: 'POST' }),
  runQC: (id: string) =>
    apiFetch<{ job: JobRecord }>(`/api/projects/${id}/qc`, { method: 'POST' }),

  regenerateShot: (id: string, shotId: string) =>
    apiFetch<{ job: JobRecord }>(`/api/projects/${id}/shots/${shotId}/regenerate`, { method: 'POST' }),
  approveShot: (id: string, shotId: string, approved: boolean) =>
    apiFetch<{ project: ProjectManifest }>(`/api/projects/${id}/shots/${shotId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved }),
    }),

  buildArchive: (id: string) =>
    apiFetch<{ archiveZip: string }>(`/api/projects/${id}/archive`, { method: 'POST' }),

  listJobs: (projectId?: string) =>
    apiFetch<{ jobs: JobRecord[] }>(projectId ? `/api/jobs?projectId=${projectId}` : '/api/jobs'),
  retryJob: (jobId: string) =>
    apiFetch<{ job: JobRecord }>(`/api/jobs/${jobId}/retry`, { method: 'POST' }),
  cancelJob: (jobId: string) =>
    apiFetch<{ job: JobRecord }>(`/api/jobs/${jobId}/cancel`, { method: 'POST' }),
};
