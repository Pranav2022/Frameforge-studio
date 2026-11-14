import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle,
  Clapperboard,
  Download,
  Film,
  FolderKanban,
  Play,
  PlusSquare,
  Users,
} from 'lucide-react';
import { api } from './api';
import { CharacterLibraryView } from './components/CharacterLibraryView';
import { DashboardView } from './components/DashboardView';
import { ExportView } from './components/ExportView';
import { JobsQueueView } from './components/JobsQueueView';
import { PreviewQCView } from './components/PreviewQCView';
import { ProjectWizardView } from './components/ProjectWizardView';
import { SceneEditorView } from './components/SceneEditorView';
import { JobRecord, ProjectManifest, QCReport, SystemStatusReport } from './types';

type TabKey = 'dashboard' | 'new' | 'characters' | 'scenes' | 'jobs' | 'preview' | 'export';

export function App() {
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [projects, setProjects] = useState<ProjectManifest[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectManifest | null>(null);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [qcReport, setQcReport] = useState<QCReport | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatusReport | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadWorkspace = useCallback(async (targetId?: string) => {
    const [sys, list] = await Promise.all([api.getSystemStatus(), api.listProjects()]);
    setSystemStatus(sys);
    setProjects(list.projects);

    const idToOpen = targetId || activeProject?.projectId || list.projects[0]?.projectId;
    if (idToOpen) {
      const detail = await api.getProject(idToOpen).catch(() => null);
      if (detail) {
        setActiveProject(detail.project);
        setJobs(detail.jobs);
        setQcReport(detail.qcReport);
      }
    }
  }, [activeProject?.projectId]);

  useEffect(() => {
    void loadWorkspace();
  }, []);

  // Poll jobs gently while any job is running or pending
  useEffect(() => {
    const hasActiveJob = jobs.some((j) => j.status === 'running' || j.status === 'pending');
    if (!hasActiveJob || !activeProject) return;
    const timer = setInterval(() => {
      void api.getProject(activeProject.projectId).then((detail) => {
        setActiveProject(detail.project);
        setJobs(detail.jobs);
        setQcReport(detail.qcReport);
      });
    }, 1800);
    return () => clearInterval(timer);
  }, [jobs, activeProject]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((curr) => (curr === msg ? null : curr)), 4000);
  }

  async function handleSelectProject(id: string) {
    const detail = await api.getProject(id);
    setActiveProject(detail.project);
    setJobs(detail.jobs);
    setQcReport(detail.qcReport);
    setTab('scenes');
  }

  async function handleDeleteProject(id: string) {
    await api.deleteProject(id);
    if (activeProject?.projectId === id) {
      setActiveProject(null);
      setJobs([]);
      setQcReport(null);
    }
    await loadWorkspace();
    showToast('Project deleted.');
  }

  async function handleValidateActive() {
    if (!activeProject) return;
    const res = await api.validateProject(activeProject.projectId);
    if (res.valid) {
      showToast(
        `Manifest valid: ${res.durationValidation.totalSceneDuration}s across ${activeProject.scenes.length} scenes.`
      );
    } else {
      showToast(`Validation issues: ${res.durationValidation.issues.join(' ')}`);
    }
  }

  async function handleTriggerStage(stage: 'assets' | 'narration' | 'subtitles' | 'video' | 'qc') {
    if (!activeProject) return;
    if (stage === 'assets') await api.generateAssets(activeProject.projectId);
    if (stage === 'narration') await api.generateNarration(activeProject.projectId);
    if (stage === 'subtitles') await api.generateSubtitles(activeProject.projectId);
    if (stage === 'video') await api.generateVideo(activeProject.projectId);
    if (stage === 'qc') await api.runQC(activeProject.projectId);

    const detail = await api.getProject(activeProject.projectId);
    setActiveProject(detail.project);
    setJobs(detail.jobs);
    setQcReport(detail.qcReport);
    setTab('jobs');
    showToast(`Queued ${stage} job.`);
  }

  const navItems: Array<{ key: TabKey; label: string; icon: React.ReactNode; needsProject?: boolean }> = [
    { key: 'dashboard', label: 'Dashboard', icon: <FolderKanban className="h-4 w-4" /> },
    { key: 'new', label: 'New Project', icon: <PlusSquare className="h-4 w-4" /> },
    { key: 'characters', label: 'Characters & Voice', icon: <Users className="h-4 w-4" />, needsProject: true },
    { key: 'scenes', label: 'Scenes & Motion', icon: <Clapperboard className="h-4 w-4" />, needsProject: true },
    { key: 'jobs', label: 'Jobs & Queue', icon: <Activity className="h-4 w-4" />, needsProject: true },
    { key: 'preview', label: 'Preview & QC', icon: <Film className="h-4 w-4" />, needsProject: true },
    { key: 'export', label: 'Export & Archive', icon: <Download className="h-4 w-4" />, needsProject: true },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Left Sidebar Navigation (260px) */}
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="border-b border-slate-200 px-5 py-4">
          <span className="text-base font-bold tracking-tight text-slate-900">
            FrameForge Studio
          </span>
        </div>

        {/* Active Project Selector */}
        <div className="border-b border-slate-200 p-4">
          <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
            Active Project
          </label>
          <select
            value={activeProject?.projectId || ''}
            onChange={(e) => {
              if (e.target.value) void handleSelectProject(e.target.value);
            }}
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
          >
            {projects.length === 0 && <option value="">No projects</option>}
            {projects.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const disabled = item.needsProject && !activeProject;
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                disabled={disabled}
                onClick={() => setTab(item.key)}
                className={`w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 text-white'
                    : disabled
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Honest Hardware Guardrail Note */}
        <div className="border-t border-slate-200 p-4 text-[11px] text-slate-500 space-y-1">
          <div className="font-medium text-slate-700">Zero-Cost Local Mode</div>
          <div>Deterministic FFmpeg engine active · 4 GB VRAM safe sequential queue</div>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on left + primary actions on right */}
        <header className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
            <span>Projects</span>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-slate-900 truncate max-w-xs">
              {activeProject ? activeProject.name : 'Workspace'}
            </span>
          </div>

          {activeProject && (
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => void handleValidateActive()}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Validate Manifest
              </button>
              <button
                type="button"
                onClick={() => void handleTriggerStage('video')}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <Play className="h-3.5 w-3.5" />
                Render Video
              </button>
            </div>
          )}
        </header>

        {toast && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs font-medium text-amber-900">
            {toast}
          </div>
        )}

        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {tab === 'dashboard' && (
            <DashboardView
              projects={projects}
              activeProjectId={activeProject?.projectId || null}
              systemStatus={systemStatus}
              onSelectProject={(id) => void handleSelectProject(id)}
              onDeleteProject={(id) => void handleDeleteProject(id)}
              onCreateNew={() => setTab('new')}
              onCreateShortsSample={() => {
                void api.createShortsSample().then((res) => {
                  setActiveProject(res.project);
                  void loadWorkspace(res.project.projectId);
                  setTab('scenes');
                  showToast('Loaded 9:16 Vertical Short sample project.');
                });
              }}
              onRefreshStatus={() => void loadWorkspace()}
              onClearCache={() => {
                void api.clearCache().then((res) => {
                  showToast(`Cleared ${res.removedFiles} cached render files.`);
                  void loadWorkspace();
                });
              }}
            />
          )}

          {tab === 'new' && (
            <ProjectWizardView
              onProjectCreated={(project) => {
                setActiveProject(project);
                void loadWorkspace(project.projectId);
                setTab('scenes');
                showToast(`Created project "${project.name}".`);
              }}
            />
          )}

          {tab === 'characters' && activeProject && (
            <CharacterLibraryView
              project={activeProject}
              onProjectUpdated={(p) => {
                setActiveProject(p);
                void loadWorkspace(p.projectId);
              }}
            />
          )}

          {tab === 'scenes' && activeProject && (
            <SceneEditorView
              project={activeProject}
              onProjectUpdated={(p) => {
                setActiveProject(p);
                void loadWorkspace(p.projectId);
              }}
            />
          )}

          {tab === 'jobs' && activeProject && (
            <JobsQueueView
              project={activeProject}
              jobs={jobs}
              onTriggerStage={(st) => void handleTriggerStage(st)}
              onRetryJob={(jid) => {
                void api.retryJob(jid).then(() => loadWorkspace(activeProject.projectId));
              }}
              onCancelJob={(jid) => {
                void api.cancelJob(jid).then(() => loadWorkspace(activeProject.projectId));
              }}
              onRefresh={() => void loadWorkspace(activeProject.projectId)}
            />
          )}

          {tab === 'preview' && activeProject && (
            <PreviewQCView
              project={activeProject}
              qcReport={qcReport}
              onApproveShot={(shotId, approved) => {
                void api.approveShot(activeProject.projectId, shotId, approved).then((res) => {
                  setActiveProject(res.project);
                });
              }}
              onRegenerateShot={(shotId) => {
                void api.regenerateShot(activeProject.projectId, shotId).then(() => {
                  void loadWorkspace(activeProject.projectId);
                  setTab('jobs');
                  showToast(`Queued shot regeneration for ${shotId}.`);
                });
              }}
              onRunQC={() => void handleTriggerStage('qc')}
            />
          )}

          {tab === 'export' && activeProject && (
            <ExportView
              project={activeProject}
              onProjectUpdated={(p) => setActiveProject(p)}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
