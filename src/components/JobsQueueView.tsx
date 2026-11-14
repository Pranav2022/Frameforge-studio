import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
  RefreshCw,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { JobRecord, ProjectManifest } from '../types';

interface Props {
  project: ProjectManifest;
  jobs: JobRecord[];
  onTriggerStage: (stage: 'assets' | 'narration' | 'subtitles' | 'video' | 'qc') => void;
  onRetryJob: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
  onRefresh: () => void;
}

export const JobsQueueView: React.FC<Props> = ({
  project,
  jobs,
  onTriggerStage,
  onRetryJob,
  onCancelJob,
  onRefresh,
}) => {
  const pendingCount = jobs.filter((j) => j.status === 'pending').length;
  const runningCount = jobs.filter((j) => j.status === 'running').length;
  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const failedCount = jobs.filter((j) => j.status === 'failed').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Generation Queue & Pipeline</h1>
          <p className="mt-1 text-sm text-slate-600">
            Sequential job runner prevents GPU out-of-memory crashes on 4 GB VRAM laptops and resumes interrupted stages.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh Queue
        </button>
      </div>

      {/* Pipeline Stage Launchers */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Run Individual Stages or Full Pipeline</h2>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => onTriggerStage('assets')}
            className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            1. Generate Storyboard Images
          </button>
          <button
            type="button"
            onClick={() => onTriggerStage('narration')}
            className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            2. Generate Narration Audio
          </button>
          <button
            type="button"
            onClick={() => onTriggerStage('subtitles')}
            className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            3. Generate Subtitles (SRT/VTT/ASS)
          </button>
          <button
            type="button"
            onClick={() => onTriggerStage('qc')}
            className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            4. Run Quality Control
          </button>
          <button
            type="button"
            onClick={() => onTriggerStage('video')}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Play className="h-3.5 w-3.5" />
            Assemble Complete Video ({project.targetDurationSeconds}s)
          </button>
        </div>
      </div>

      {/* Queue Counters */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Pending" value={pendingCount} />
        <StatTile label="Running" value={runningCount} />
        <StatTile label="Completed" value={completedCount} />
        <StatTile label="Failed" value={failedCount} />
      </div>

      {/* Jobs Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900">
          Job History ({jobs.length})
        </div>
        {jobs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No jobs have been queued for this project yet. Use the pipeline buttons above to begin rendering.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-medium">
                  <th className="px-4 py-2.5">Job</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Progress</th>
                  <th className="px-4 py-2.5">Log Message</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{job.jobType.replace(/_/g, ' ')}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {job.id}
                        {job.shotId ? ` · ${job.shotId}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <JobStatusLabel status={job.status} />
                    </td>
                    <td className="px-4 py-3 w-40">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full transition-all ${
                              job.status === 'failed'
                                ? 'bg-red-600'
                                : job.status === 'completed'
                                ? 'bg-emerald-600'
                                : 'bg-slate-900'
                            }`}
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] tabular-nums text-slate-600">
                          {job.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-md text-slate-600">
                      <p className="truncate">{job.errorMessage || job.message}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1.5">
                        {(job.status === 'failed' || job.status === 'cancelled') && (
                          <button
                            type="button"
                            onClick={() => onRetryJob(job.id)}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Retry
                          </button>
                        )}
                        {(job.status === 'pending' || job.status === 'running') && (
                          <button
                            type="button"
                            onClick={() => onCancelJob(job.id)}
                            className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const StatTile: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4">
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">{value}</p>
  </div>
);

const JobStatusLabel: React.FC<{ status: JobRecord['status'] }> = ({ status }) => {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Completed
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-red-700">
        <AlertCircle className="h-3.5 w-3.5" />
        Failed
      </span>
    );
  }
  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-slate-500">
        <XCircle className="h-3.5 w-3.5" />
        Cancelled
      </span>
    );
  }
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-amber-700">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        Running
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-medium text-slate-600">
      <Clock className="h-3.5 w-3.5" />
      {status}
    </span>
  );
};
