# Phase 0: Model Feasibility Research & Architecture Decision Document

**Target Hardware Profile**
- **OS:** Windows 11 / 10 (64-bit) — also cross-compatible with Linux
- **GPU:** NVIDIA GeForce RTX 2050 (Laptop GPU, **4 GB GDDR6 VRAM**)
- **System RAM:** 16 GB DDR4/DDR5
- **Storage:** Local SSD
- **Budget:** ₹0 (Zero paid APIs, zero subscriptions, zero cloud GPU credits)

---

## 1. Free & Open-Source Model Evaluation Matrix

### A. Image Generation Models

| Model | Official Repository / Weights | Download Size | RAM / VRAM Needs | Local Offline | License & Commercial Terms | Verdict for 4 GB VRAM |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Stable Diffusion 1.5** | `runwayml/stable-diffusion-v1-5` (mirrors on HuggingFace) | ~2.0–4.2 GB (FP16 safetensors) | **3.5–4.0 GB VRAM** (FP16 + `--medvram` / xFormers), ~8 GB RAM | Yes | **CreativeML Open RAIL-M** — Commercial use permitted; restrictions only on harmful/illegal outputs | **1. Feasible on laptop** (512×512 native + tiled/ESRGAN upscale; supports IP-Adapter & ControlNet sequentially) |
| **SDXL 1.0 (Base)** | `stabilityai/stable-diffusion-xl-base-1.0` | ~6.9 GB | **6.5–8.0 GB VRAM** (FP16); ~4.5 GB with aggressive CPU offload / FP8 | Yes | **CreativeML Open RAIL++-M** — Commercial use allowed | **2. Feasible with severe compromises** (Heavy RAM swapping on 4 GB VRAM, very slow; use SD 1.5 as primary local image generator) |
| **FLUX.1 Schnell** | `black-forest-labs/FLUX.1-schnell` | ~12–23 GB | **8–12 GB VRAM** (Q4 GGUF/NF4); ~24 GB full BF16 | Yes | **Apache 2.0** — Fully permissive commercial use | **3. Requires 8–12+ GB VRAM or Cloud** (T5-XXL + 12B DiT exceeds 4 GB VRAM + 16 GB RAM budget) |
| **FLUX.1 Dev** | `black-forest-labs/FLUX.1-dev` | ~23 GB | **12–24 GB VRAM** | Yes | **Non-Commercial License** — Personal/research only | **4. Not suitable** (VRAM too high + non-commercial restriction) |

**Architecture Decision (Images):**
Use a **Provider Interface (`ImageProvider`)** supporting:
1. **Local ComfyUI / Diffusers (SD 1.5 + ControlNet / IP-Adapter)** in `--lowvram` sequential mode when installed locally.
2. **User-Imported / Pre-Rendered Reference & Storyboard Images** (always works with 0 VRAM).
3. **Deterministic Procedural Scene Compositor** (generates clean layered placeholder/reference plates when no diffusion checkpoint is installed so pipelines never stall).

---

### B. Image-to-Video & Text-to-Video Models

| Model | Official Repository | Capabilities | RAM / VRAM Needs | License & Commercial Terms | Verdict for 4 GB RTX 2050 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **AnimateDiff (SD 1.5)** | `guoyww/AnimateDiff` / `Kosinkadink/ComfyUI-AnimateDiff-Evolved` | Short 16–32 frame motion loops from SD 1.5 + ControlNet | **8–12 GB VRAM** practical (~6 GB bare minimum with heavy `--lowvram` + tiny 384×384 res) | **Apache 2.0** (code/motion modules) + SD 1.5 RAIL-M | **2. Feasible with severe compromises** (4 GB VRAM frequently hits OOM unless resolution <= 384px & 16 frames with CPU offload) |
| **Stable Video Diffusion (SVD-XT)** | `stabilityai/stable-video-diffusion-img2vid-xt` | 14–25 frames I2V at 576×1024 | **12–16 GB VRAM** (8–10 GB quantized) | **Stability AI Community License** (Free commercial if revenue < $1M/yr) | **3. Requires higher VRAM / Cloud** (Not reliable on 4 GB RTX 2050) |
| **Wan 2.1 (1.3B & 14B)** | `Wan-Video/Wan2.1` | T2V & I2V with strong motion & subject consistency | **8–12 GB VRAM** (1.3B 480p); **40–80 GB VRAM** (14B) | **Apache 2.0** (Fully open commercial) | **3. Requires 8–12+ GB VRAM** (Even 1.3B exceeds 4 GB VRAM) |
| **LTX-Video** | `Lightricks/LTX-Video` | Fast DiT I2V / T2V | **16–24 GB VRAM** (FP8 distilled); **32+ GB** full | **LTX Community License** (Revenue cap) | **3. Requires 16+ GB VRAM / Cloud** |

**Honest Quality & Feasibility Statement:**
On a 4 GB RTX 2050, modern DiT video models (Wan 2.1, LTX-Video, SVD) **cannot run locally** without OOM crashes, and even SD 1.5 AnimateDiff suffers severe resolution/length compromises. Therefore:
- **Primary Production Engine:** **Deterministic Motion Graphics & Layered 2.5D Animation Engine (FFmpeg + OpenCV)** — runs reliably on CPU/4 GB GPU at full 1080p/720p for 30s, 120s, 5m, or 15m+ videos with zero OOM risk.
- **Optional Hybrid Generative Slots:** When a user connects a local ComfyUI/AnimateDiff endpoint (or imports externally generated clips), the `AnimationEngine` seamlessly routes tagged shots to the generative provider and falls back gracefully to deterministic animation on failure or VRAM pressure.
- **Transparency Rule:** Deterministic animation (camera pan/zoom, parallax layer separation, rain/snow/fire/fog/lightning particles, glow, dissolves) is **not** full character skeletal/lip-sync animation, and the UI and documentation explicitly distinguish the two modes.

---

### C. Text-to-Speech (TTS) & Voice Cloning

| Model / Engine | Repository | Hindi Support | Size & RAM/VRAM | License | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Piper TTS** | `rhasspy/piper` | Community Hindi ONNX voices (`hi_IN`) + English | ~60–100 MB per voice; **0 GB VRAM** (CPU ONNX, ~300 MB RAM) | **MIT** (Commercial OK) | **1. Feasible — Primary Local Fallback TTS** |
| **Kokoro-82M** | `hexgrad/kokoro` | Supported (`lang_code='h'` Hindi + English) | ~350 MB weights; **1–2 GB VRAM** or CPU | **Apache 2.0** (Commercial OK) | **1. Feasible — High-Quality Preset Narration** |
| **Coqui XTTS-v2** | `coqui-ai/TTS` (archived; maintained forks e.g. `idiap/coqui-ai-TTS`) | Native multilingual including Hindi | ~1.8 GB; **4.0–4.5 GB VRAM** (tight on 4 GB) or slow CPU | **CPML** (Non-commercial unless licensed) | **2. Feasible with compromises** (Must unload all other GPU models first; strict consent verification required) |
| **User Recorded / Imported Audio** | Local WAV/MP3 | Any language | 0 GB VRAM | User-owned | **1. Always Feasible** |

---

### D. Speech Recognition & Subtitles

| Tool | Repository | Hindi & Multilingual | Size & RAM/VRAM | License | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Faster-Whisper** | `SYSTRAN/faster-whisper` | Excellent Hindi, English, 99 languages | `small` (~500 MB): **<1.5 GB VRAM** (`int8`) or CPU; `medium` (~1.5 GB): **~2.5 GB VRAM** | **MIT** (Commercial OK) | **1. Feasible on laptop** |
| **Script-Aligned Timing Engine** | Built-in | Any UTF-8 script (Devanagari, Latin, etc.) | **0 GB VRAM** | MIT (Project code) | **1. Always Feasible** (Default when audio is script-driven) |

---

### E. Music, SFX & Video Rendering

- **Audio Mixing & SFX:** FFmpeg (`amix`, `sidechaincompress` audio ducking, `loudnorm`, `afade`) + user-supplied or CC0 / royalty-free local stems. No copyrighted downloads.
- **Video Rendering:** **FFmpeg 4.4+ / 6.x** (MIT/LGPL/GPL depending on build; standard local CLI tool) + **OpenCV** (`MIT` / `Apache 2.0`). Zero VRAM required; processes shot-by-shot in short segments to avoid RAM spikes.

---

## 2. Core Architectural Decisions

1. **Sequential Single-Model Residency:** Never load two heavy AI models simultaneously. SQLite-backed job queue executes heavy generation jobs sequentially (`MAX_CONCURRENT_HEAVY_JOBS=1`).
2. **Deterministic-First Guarantee:** Every project can complete end-to-end—creating valid 720p/1080p MP4s, individual scene clips, mixed audio, SRT/VTT/ASS subtitles, and QC reports—using only FFmpeg and zero external APIs.
3. **Provider Abstraction:** `ImageProvider`, `AnimationProvider`, `VoiceProvider`, and `SubtitleProvider` are swappable interfaces. Local ComfyUI, Piper, Kokoro, XTTS, Ollama, and Faster-Whisper plug in cleanly when detected on the host machine.
4. **Content-Agnostic Manifest:** Versioned `v1.0` JSON manifest validated via Zod (TypeScript) and Pydantic (Python) stores characters, environments, scenes, shots, motion specs, narration, subtitles, and job state without any hardcoded story assumptions.
5. **Hash-Based Caching & Resumability:** Every generated asset hashes its prompt, reference files, seed, width, height, and motion parameters. Interrupted renders resume from the last completed shot without regenerating valid assets.
