# API Reference

All endpoints are served under `/api` on `http://localhost:3000`.

## System & Draft Assistance
- `GET /api/system/status` — Returns host CPU/RAM, VRAM budget, disk usage, and availability of FFmpeg, FFprobe, ImageMagick, ComfyUI, Ollama, and Piper.
- `POST /api/system/clear-cache` — Clears cached intermediate renders in `./cache`.
- `POST /api/ai-assist/draft` — Accepts `{ topic, targetDurationSeconds, language, visualStyle }` and returns an editable script draft via local Ollama or deterministic outline fallback.

## Projects
- `GET /api/projects` — Lists all project manifests ordered by `updatedAt`.
- `POST /api/projects` — Creates a new project (`pacingMode`: `standard` | `shorts_rapid`, `fps`: `24` | `25` | `30`, `burnSubtitles`, `watermarkText`), parses script into scenes/shots, and persists `manifest.json` + SQLite row.
- `POST /api/demo/create-shorts-sample` — Seeds or resets the 9:16 25fps Vertical Short demo project (`mahishasura-birth-short`).
- `POST /api/projects/import-package` — Multipart `.json` manifest or `.zip` project bundle import.
- `GET /api/projects/{projectId}` — Returns `{ project, assets, jobs, qcReport }`.
- `PUT /api/projects/{projectId}` — Updates and validates project manifest fields (including `brandingConfig`).
- `DELETE /api/projects/{projectId}` — Deletes project record and local folder.

## Script, Characters, Environments & Assets
- `POST /api/projects/{projectId}/process-script` — Re-parses script into scenes and shots matching `targetDurationSeconds` and `pacingMode`.
- `POST /api/projects/{projectId}/validate` — Validates Zod schema and scene/shot duration sums.
- `POST /api/projects/{projectId}/characters` — Creates or updates a character profile and reapplies consistency prompts.
- `POST /api/projects/{projectId}/environments` — Creates or updates an environment profile.
- `POST /api/projects/{projectId}/scenes` — Updates scenes/shots (`preserveMotionSpec` supported to keep dropdown transitions/VFX overrides).
- `POST /api/projects/{projectId}/assets` — Multipart file upload (`category`: `character` | `environment` | `voice_sample` | `music` | `narration` | `shot_image` | `shot_clip` | `watermark`).

## Production Pipeline & Jobs
- `POST /api/projects/{projectId}/generate-assets` — Queues storyboard plate generation (`202 Accepted` + `{ job }`).
- `POST /api/projects/{projectId}/approve-storyboard` — Marks storyboard approved.
- `POST /api/projects/{projectId}/generate-narration` — Queues narration synthesis + WAV/MP3 export.
- `POST /api/projects/{projectId}/generate-subtitles` — Queues SRT/VTT/ASS subtitle generation.
- `POST /api/projects/{projectId}/generate-video` — Queues full end-to-end shot animation, audio mixing, scene & episode rendering, QC, and ZIP packaging.
- `POST /api/projects/{projectId}/shots/{shotId}/regenerate` — Regenerates a single shot MP4 without re-rendering other shots.
- `POST /api/projects/{projectId}/shots/{shotId}/approve` — Toggles shot approval status.
- `POST /api/projects/{projectId}/qc` — Queues automated FFprobe/FFmpeg Quality Control inspection.

## Preview, Export & Job Queue
- `GET /api/projects/{projectId}/preview` — Returns scene/shot preview metadata and file paths.
- `GET /api/projects/{projectId}/export` — Returns export file paths (`landscapeMp4`, `verticalMp4`, `squareMp4`, subtitles, `sceneVideos`, `qcReport`).
- `POST /api/projects/{projectId}/archive` — Rebuilds downloadable `.zip` project archive.
- `GET /api/jobs?projectId=...` — Lists queued, running, completed, and failed jobs.
- `POST /api/jobs/{jobId}/retry` — Re-queues a failed or cancelled job.
- `POST /api/jobs/{jobId}/cancel` — Cancels a pending or running job.
- `GET /api/media?path=...` — Streams local generated PNG, WAV, MP3, MP4, SRT, or ZIP files safely within `projects/`.
