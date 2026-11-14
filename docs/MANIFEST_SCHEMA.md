# Versioned Project Manifest Schema (`v1.0.0`)

Every project stores a validated `projects/<projectId>/manifest.json` file mirrored in SQLite. Both the TypeScript Zod validator (`server/types/manifest.ts`) and Python Pydantic model (`backend/app/schemas/manifest.py`) enforce this schema.

## Top-Level Fields

| Field | Type | Description |
| :--- | :--- | :--- |
| `manifestVersion` | `string` | Schema version (`"1.0.0"`). |
| `projectId` | `string` | Unique URL-safe identifier. |
| `name` | `string` | Human-readable project title. |
| `script` | `string` | Raw script text (supports `SCENE`, `[MOTION:]`, `CHARACTER:`). |
| `targetDurationSeconds` | `number` | Target episode length in seconds (`5` to `7200`). |
| `stage` | `enum` | Pipeline progress (`created`, `script_processed`, `storyboard_ready`, `storyboard_approved`, `assets_generated`, `animation_generated`, `audio_generated`, `assembled`, `qc_passed`, `exported`). |
| `characters` | `Character[]` | Character visual identity, clothing, accessories, fixed seeds, reference images. |
| `environments` | `Environment[]` | Reusable world locations, lighting, weather defaults, backdrop images. |
| `scenes` | `Scene[]` | Ordered scenes with nested `shots[]`. |
| `subtitles` | `SubtitleEntry[]` | Timed subtitle cues. |
| `voiceConfig` | `object` | Language, sample path, consent flag, pronunciation dictionary. |
| `audioConfig` | `object` | Music path, volumes, ducking toggle, fade durations, mixed WAV path. |
| `brandingConfig` | `object` | Persistent corner watermark (`watermarkText`, `watermarkImagePath`, `position`, `opacity`, `color`). |
| `generationSettings` | `object` | Provider selection, `lowVramMode`, `maxVramMb`, visual style. |
| `outputSettings` | `object` | `resolution` (`720p`/`1080p`), `aspectRatio` (`16:9`/`9:16`/`1:1`), `fps` (`24`/`25`/`30`), `pacingMode` (`standard`/`shorts_rapid`), `burnSubtitles`, vertical/square toggles, subtitle styling. |
| `exports` | `object` | Paths to rendered `landscapeMp4`, `verticalMp4`, `squareMp4`, `srtPath`, `vttPath`, `assPath`, `archiveZip`. |

## Shot Object Fields

Each shot inside `scene.shots[]` includes:
- `id`, `sceneId`, `shotNumber`, `startTime`, `endTime`, `duration`
- `charactersPresent[]`, `environmentId`, `referenceImages[]`, `imageAssetPath`, `importedClipPath`
- `positivePrompt`, `negativePrompt`, `motionPrompt`, `motionSpec` (including `golden_embers`, `god_rays`, `violet_aura`, `ground_mist`, and `xfade` transition types)
- `animationModel`, `generationMethod` (`deterministic` | `generative_i2v` | `generative_t2v` | `hybrid`)
- `narrationSegment`, `narrationAudioPath`, `soundEffects[]`, `subtitleSegment`
- `outputFile`, `status`, `approved`, `seed`, `error`
