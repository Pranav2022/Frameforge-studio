import React, { useState } from 'react';
import { Archive, Download, FileAudio, FileText, Film } from 'lucide-react';
import { api, mediaUrl } from '../api';
import { ProjectManifest } from '../types';

interface Props {
  project: ProjectManifest;
  onProjectUpdated: (p: ProjectManifest) => void;
}

export const ExportView: React.FC<Props> = ({ project, onProjectUpdated }) => {
  const [buildingZip, setBuildingZip] = useState(false);

  async function handleBuildZip() {
    setBuildingZip(true);
    try {
      const res = await api.buildArchive(project.projectId);
      onProjectUpdated({
        ...project,
        exports: { ...project.exports, archiveZip: res.archiveZip },
      });
    } finally {
      setBuildingZip(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Export & Project Archive</h1>
          <p className="mt-1 text-sm text-slate-600">
            Download horizontal and vertical videos, individual scene clips, subtitle tracks, audio stems, and the full ZIP archive.
          </p>
        </div>
        <button
          type="button"
          disabled={buildingZip}
          onClick={handleBuildZip}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <Archive className="h-3.5 w-3.5" />
          {buildingZip ? 'Packaging ZIP...' : 'Rebuild Project ZIP Archive'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Video Exports */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-slate-700" />
            <h2 className="text-sm font-semibold text-slate-900">Final Video Deliverables</h2>
          </div>
          <ExportRow
            label={`Primary Master MP4 (${project.outputSettings.aspectRatio})`}
            filePath={project.exports.landscapeMp4}
          />
          <ExportRow label="Vertical Format (9:16 MP4)" filePath={project.exports.verticalMp4} />
          <ExportRow label="Square Reframe (1:1 MP4)" filePath={project.exports.squareMp4} />
          <ExportRow label="Complete Project ZIP Archive" filePath={project.exports.archiveZip} />
        </div>

        {/* Subtitles & Audio */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-700" />
            <h2 className="text-sm font-semibold text-slate-900">Subtitles & Audio Stems</h2>
          </div>
          <ExportRow label="SubRip Subtitles (.srt)" filePath={project.exports.srtPath} />
          <ExportRow label="WebVTT Subtitles (.vtt)" filePath={project.exports.vttPath} />
          <ExportRow label="Styled ASS Subtitles (.ass)" filePath={project.exports.assPath} />
          <ExportRow
            label="Master Narration WAV"
            filePath={project.voiceConfig.generatedNarrationPath}
            icon={<FileAudio className="h-3.5 w-3.5 text-slate-400" />}
          />
          <ExportRow
            label="Final Mixed Audio WAV"
            filePath={project.audioConfig.mixedAudioPath}
            icon={<FileAudio className="h-3.5 w-3.5 text-slate-400" />}
          />
        </div>
      </div>

      {/* Individual Scene Videos */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900">
          Individual Scene Video Files ({project.scenes.length})
        </div>
        <div className="divide-y divide-slate-200">
          {project.scenes.map((sc) => (
            <div key={sc.id} className="flex items-center justify-between px-5 py-3 text-xs">
              <div>
                <span className="font-medium text-slate-900">
                  Scene {sc.sceneNumber}: {sc.title}
                </span>
                <span className="ml-2 font-mono text-slate-500 tabular-nums">{sc.duration}s</span>
              </div>
              {sc.outputFile ? (
                <a
                  href={mediaUrl(sc.outputFile)}
                  download
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1 font-medium text-slate-800 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download MP4
                </a>
              ) : (
                <span className="text-slate-400">Not rendered yet</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const ExportRow: React.FC<{
  label: string;
  filePath?: string;
  icon?: React.ReactNode;
}> = ({ label, filePath, icon }) => (
  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 text-xs last:border-0 last:pb-0">
    <div className="flex items-center gap-2 text-slate-700">
      {icon}
      <span>{label}</span>
    </div>
    {filePath ? (
      <a
        href={mediaUrl(filePath)}
        download
        className="inline-flex items-center gap-1 font-medium text-slate-900 underline hover:text-amber-700"
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </a>
    ) : (
      <span className="text-slate-400">Pending</span>
    )}
  </div>
);
