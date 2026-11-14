# FrameForge Studio — Universal AI Video Production Engine

A modular, zero-cost, hardware-aware video production system designed to run locally on **Windows (NVIDIA RTX 2050 4 GB VRAM, 16 GB RAM)** and Linux without requiring paid APIs, subscriptions, or cloud GPUs.

## Key Capabilities

- **Content-Agnostic Architecture:** No hardcoded story assumptions. Works for documentaries, explainers, mythology, Shorts/Reels, or fiction in English, Hindi, or any UTF-8 language.
- **Three Project Creation Methods + 9:16 Shorts Preset:** Guided form (including one-click **9:16 Vertical Short / Reel · 25 FPS · Rapid 3s Beats**), JSON/ZIP package import, and optional local Ollama story-to-script drafting.
- **Script Processing & Rapid Shorts Pacing:** Automatically extracts scenes, characters, dialogue, narration, and motion cues in `standard` (8–12s) or `shorts_rapid` (2.5–3.8s micro-beats) modes.
- **Character & Environment Consistency + AI Clip Import:** Stores visual identity, clothing, accessories, color palettes, negative prompts, fixed seeds, copy-ready ComfyUI prompts, and allows uploading external/AI-generated `.mp4` clips per shot.
- **Dual-Mode Animation & Layered VFX Engine:**
  - **Deterministic Motion & VFX Engine (Always Offline, 0 GB VRAM):** FFmpeg zoom/pan/tilt/parallax/shake, drifting `golden_embers`, diagonal `god_rays`, `violet_aura`, `ground_mist`, `fire`, `lightning`, rain/snow/fog, and FFmpeg `xfade` transitions (`flash_white`, `flash_violet`, `diagonal_slice`, `wipe_left`, `slide_up`, `circle_open`, `dissolve`, `fade`).
  - **Channel Watermark & Burned Shorts Captions:** Overlay corner text or PNG logos and burn bold vertical ASS captions directly into exports.
- **Voice, Audio Mixing & Subtitles:** Consent-checked voice sample validation, language-matched Piper TTS (Hindi/English via `scripts\setup_piper_hindi.bat`) or recorded narration support, FFmpeg sidechain music ducking, loudness normalization, and synchronized `.srt`, `.vtt`, `.ass` export.
- **Automated Quality Control:** Uses `ffprobe`, `blackdetect`, `volumedetect`, and subtitle overlap checks to validate every render.
- **Resumable Sequential Job Queue:** SQLite-backed queue runs heavy jobs one at a time, preserves completed shots, and caches renders by SHA-256 hash.

## Quick Start (Windows)

1. Double-click `scripts\install_windows.bat` (installs dependencies, verifies FFmpeg, creates storage folders).
2. *(Optional Hindi/English offline voices)* Run `scripts\setup_piper_hindi.bat` to download free MIT-licensed Piper `.onnx` models into `models\speech\`.
3. Double-click `start.bat` (opens `http://localhost:3000` in your browser).

## Running Tests & Demo Render

```bash
# Run unit tests
npx tsx tests/run_tests.ts

# Render the 120-second Mahishasura Episode 1 demonstration video & QC report
npx tsx scripts/render_demo_episode.ts
```

## Documentation

- [Phase 0 Model Research & Architecture Decisions](docs/PHASE0_MODEL_RESEARCH_AND_ARCHITECTURE.md)
- [Beginner Windows Installation Guide](docs/BEGINNER_INSTALLATION_GUIDE.md)
- [API Reference](docs/API_REFERENCE.md)
- [Project Manifest Schema](docs/MANIFEST_SCHEMA.md)
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
