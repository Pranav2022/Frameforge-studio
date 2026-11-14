# Troubleshooting Guide

## 1. "FFmpeg not found" on Dashboard
- **Cause:** FFmpeg is not installed or not in your system `PATH`.
- **Fix (Windows):** Open Command Prompt and run `winget install Gyan.FFmpeg`. Close and reopen `start.bat`.

## 2. Out-of-Memory (OOM) when using optional ComfyUI
- **Cause:** RTX 2050 has **4 GB VRAM**. Running SDXL, Wan 2.1, or multiple models simultaneously exceeds 4 GB.
- **Fix:**
  1. Launch ComfyUI with `--lowvram`.
  2. Use **Stable Diffusion 1.5** checkpoints at 512×512 or 768×512 rather than SDXL/FLUX.
  3. Keep `generationSettings.animationProvider` set to `deterministic` for shots longer than 4 seconds.

## 3. Video Render Interrupted Halfway
- **Fix:** Open **Jobs & Queue** and click **Retry** on the failed job, or click **Render Video** again. Shots whose `.mp4` files already completed are preserved on disk and skipped automatically.

## 4. Voice Sample Rejected or Short Warning
- **Cause:** Uploaded sample is under 3 seconds or corrupt.
- **Fix:** Record 10–25 seconds of clear speech in a quiet room as WAV or MP3, upload it under **Characters & Voice**, and ensure the consent checkbox is checked.

## 5. Subtitles Out of Sync or Too Long
- **Fix:** Adjust `maxCharsPerLine` (default `44`) or edit individual shot `subtitleSegment` text in **Scenes & Motion**, then click **Generate Subtitles (SRT/VTT/ASS)** in **Jobs & Queue**.
