import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, ThumbsUp } from 'lucide-react';
import { mediaUrl } from '../api';
import { ProjectManifest, QCReport } from '../types';

interface Props {
  project: ProjectManifest;
  qcReport: QCReport | null;
  onApproveShot: (shotId: string, approved: boolean) => void;
  onRegenerateShot: (shotId: string) => void;
  onRunQC: () => void;
}

export const PreviewQCView: React.FC<Props> = ({
  project,
  qcReport,
  onApproveShot,
  onRegenerateShot,
  onRunQC,
}) => {
  const [selectedVideo, setSelectedVideo] = useState<string>(project.exports.landscapeMp4 || '');
  const [selectedTitle, setSelectedTitle] = useState<string>('Full Episode Master');

  useEffect(() => {
    setSelectedVideo(project.exports.landscapeMp4 || '');
    setSelectedTitle(`Primary Master (${project.outputSettings.aspectRatio})`);
  }, [project.projectId, project.exports.landscapeMp4, project.outputSettings.aspectRatio]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Video Preview & Quality Control</h1>
          <p className="mt-1 text-sm text-slate-600">
            Inspect rendered shots, scene assemblies, final episode output, and automated FFprobe QC checks.
          </p>
        </div>
        <button
          type="button"
          onClick={onRunQC}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Run Automated QC
        </button>
      </div>

      {/* Main Video Player */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 rounded-lg border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">{selectedTitle}</h2>
            <span className="font-mono text-xs text-slate-500">
              {project.outputSettings.resolution} · {project.outputSettings.aspectRatio} · {project.outputSettings.fps}fps
            </span>
          </div>
          {selectedVideo ? (
            <video
              key={selectedVideo}
              controls
              className={
                project.outputSettings.aspectRatio === '9:16' || selectedTitle.includes('9:16')
                  ? 'mx-auto aspect-[9/16] max-h-[540px] rounded-md bg-slate-950'
                  : 'aspect-video w-full rounded-md bg-slate-950'
              }
              src={mediaUrl(selectedVideo)}
            />
          ) : (
            <div className="aspect-video w-full rounded-md border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
              <p className="text-sm font-medium text-slate-800">No rendered video selected yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Click "Assemble Complete Video" in Jobs & Queue (or pick a rendered shot/scene clip on the right).
              </p>
            </div>
          )}
        </div>

        {/* Clip Selector */}
        <div className="lg:col-span-4 rounded-lg border border-slate-200 bg-white p-4 space-y-3 max-h-[460px] overflow-y-auto">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Available Video Streams
          </h3>
          {project.exports.landscapeMp4 && (
            <button
              type="button"
              onClick={() => {
                setSelectedVideo(project.exports.landscapeMp4!);
                setSelectedTitle(`Primary Master (${project.outputSettings.aspectRatio})`);
              }}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-900 hover:bg-slate-50"
            >
              Primary Master ({project.outputSettings.aspectRatio} · {project.targetDurationSeconds}s)
            </button>
          )}
          {project.exports.verticalMp4 && (
            <button
              type="button"
              onClick={() => {
                setSelectedVideo(project.exports.verticalMp4!);
                setSelectedTitle('Vertical Reframe (9:16)');
              }}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-900 hover:bg-slate-50"
            >
              Vertical Reframe 9:16
            </button>
          )}
          {project.scenes.map((sc) => (
            <div key={sc.id} className="space-y-1 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={!sc.outputFile}
                onClick={() => {
                  if (sc.outputFile) {
                    setSelectedVideo(sc.outputFile);
                    setSelectedTitle(`Scene ${sc.sceneNumber}: ${sc.title}`);
                  }
                }}
                className="w-full text-left text-xs font-semibold text-slate-800 hover:underline disabled:text-slate-400"
              >
                Scene {sc.sceneNumber}: {sc.title} {sc.outputFile ? '' : '(not assembled)'}
              </button>
              <div className="space-y-1 pl-2">
                {sc.shots.map((sh) => (
                  <div key={sh.id} className="flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      disabled={!sh.outputFile}
                      onClick={() => {
                        if (sh.outputFile) {
                          setSelectedVideo(sh.outputFile);
                          setSelectedTitle(`${sc.title} — Shot ${sh.shotNumber}`);
                        }
                      }}
                      className="truncate text-left text-slate-600 hover:text-slate-900 disabled:text-slate-400"
                    >
                      Shot {sh.shotNumber} ({sh.duration}s)
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onApproveShot(sh.id, !sh.approved)}
                        title={sh.approved ? 'Approved' : 'Approve shot'}
                        className={`rounded px-1.5 py-0.5 text-[11px] ${
                          sh.approved
                            ? 'bg-emerald-50 text-emerald-700 font-medium'
                            : 'text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        <ThumbsUp className="inline h-3 w-3 mr-0.5" />
                        {sh.approved ? 'OK' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRegenerateShot(sh.id)}
                        className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
                      >
                        Regen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Automated Quality Control Report */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Automated Quality Control Report</h2>
            <p className="text-xs text-slate-500">
              Validates video streams, dimensions, black frames, audio clipping, and subtitle timing.
            </p>
          </div>
          {qcReport && (
            <div className="text-xs font-medium tabular-nums text-slate-700">
              {qcReport.summary.passed} passed · {qcReport.summary.warnings} warnings · {qcReport.summary.failed} failed
            </div>
          )}
        </div>

        {!qcReport ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No QC report generated yet. Click "Run Automated QC" or render the full video.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {qcReport.mediaProbe && (
              <div className="grid grid-cols-2 gap-4 bg-slate-50 px-5 py-3 text-xs sm:grid-cols-4">
                <div>
                  <span className="text-slate-500">Measured Duration:</span>{' '}
                  <span className="font-mono font-medium tabular-nums">
                    {qcReport.mediaProbe.durationSeconds}s
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Resolution:</span>{' '}
                  <span className="font-mono font-medium tabular-nums">
                    {qcReport.mediaProbe.width}x{qcReport.mediaProbe.height}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Frame Rate:</span>{' '}
                  <span className="font-mono font-medium tabular-nums">{qcReport.mediaProbe.fps} fps</span>
                </div>
                <div>
                  <span className="text-slate-500">Streams:</span>{' '}
                  <span className="font-medium">
                    {qcReport.mediaProbe.hasVideo ? 'Video' : 'No Video'} +{' '}
                    {qcReport.mediaProbe.hasAudio ? 'Audio' : 'No Audio'}
                  </span>
                </div>
              </div>
            )}
            {qcReport.checks.map((chk, idx) => (
              <div key={idx} className="flex items-center justify-between gap-4 px-5 py-3 text-xs">
                <div className="space-y-0.5">
                  <div className="font-medium text-slate-900">
                    {chk.name} <span className="text-slate-400">· {chk.category}</span>
                  </div>
                  <div className="text-slate-600">{chk.details}</div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 font-medium shrink-0 ${
                    chk.status === 'pass'
                      ? 'text-emerald-700'
                      : chk.status === 'warn'
                      ? 'text-amber-700'
                      : 'text-red-700'
                  }`}
                >
                  {chk.status === 'pass' && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {chk.status === 'warn' && <AlertTriangle className="h-3.5 w-3.5" />}
                  {chk.status === 'fail' && <ShieldAlert className="h-3.5 w-3.5" />}
                  {chk.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
