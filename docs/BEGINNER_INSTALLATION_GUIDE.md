# Beginner Installation & User Guide (Windows 10 / 11)

This guide walks you through installing and running **FrameForge Studio** on a Windows laptop (such as an RTX 2050 4 GB VRAM, 16 GB RAM system) at **₹0 cost**.

---

## Step 1: Install Required Free Software

1. **Install Node.js (LTS v20 or v22)**
   - Go to [https://nodejs.org/](https://nodejs.org/)
   - Download the **LTS** Windows Installer (`.msi`) and run it with default options.
2. **Install FFmpeg (Free Video/Audio Engine)**
   - Open **Command Prompt** (press `Win + R`, type `cmd`, press Enter).
   - Run:
     ```bat
     winget install Gyan.FFmpeg
     ```
   - Close and reopen Command Prompt, then verify by typing:
     ```bat
     ffmpeg -version
     ```
3. *(Optional)* **Install ImageMagick** (enhances procedural plate rendering)
   - Run: `winget install ImageMagick.ImageMagick`
4. *(Optional)* **Install Python 3.10+** (only needed if you also want to run the standalone FastAPI reference server in `backend/`).

---

## Step 2: Run the One-Click Installer

1. Open the `ai-video-engine` folder in File Explorer.
2. Double-click **`scripts\install_windows.bat`**.
3. Wait for `npm install` and folder creation (`projects\`, `cache\`, `logs\`, `models\`) to complete.

---

## Step 3: Start the Application

1. Double-click **`start.bat`** in the root folder.
2. Your browser will automatically open **`http://localhost:3000`**.
3. Keep the black Command Prompt window open while working; press `Ctrl + C` when you want to shut it down.

---

## Step 4: Creating Your First Video (Step by Step)

1. **Open the Demo or Create a New Project:**
   - The **Mahishasura — Episode 1 (Demo)** project is pre-loaded so you can explore scenes, characters, and settings immediately.
   - Or click **New Video Project** to paste your own script, import a `.zip` package, or generate a draft from a short topic.
2. **Add Characters & Voice (Optional):**
   - Open **Characters & Voice** in the left sidebar.
   - Upload character reference images, environment backdrops, background music, or your own recorded narration.
   - *Important:* Only upload a voice sample for cloning if you own the voice or have explicit permission, and check the consent box.
3. **Review Scenes & Motion Instructions:**
   - Open **Scenes & Motion** to adjust shot durations, edit natural-language camera cues (e.g., `"Slow zoom-in with lightning flash"`), or override camera/weather dropdowns.
   - Click **Generate Storyboard Images** and inspect each plate before rendering.
4. **Render the Complete Video:**
   - Click **Render Video** in the top bar (or open **Jobs & Queue**).
   - Watch progress in **Jobs & Queue**. If interrupted, click **Retry**—already-finished shots are preserved automatically.
5. **Preview, Run QC & Export:**
   - Open **Preview & QC** to watch individual shots, scene videos, or the full episode and inspect the automated Quality Control report.
   - Open **Export & Archive** to download your horizontal MP4 (`16:9`), vertical MP4 (`9:16`), individual scene clips, `.srt`/`.vtt`/`.ass` subtitles, and full `.zip` project archive.

---

## Optional Local AI Add-Ons (4 GB VRAM Safe Tips)

- **ComfyUI (SD 1.5):** Run ComfyUI with `--lowvram` on `http://127.0.0.1:8188`. FrameForge detects it automatically on the Dashboard.
- **Ollama (Story Drafting):** Install Ollama (`https://ollama.com/`) and pull a small 3B model (`ollama pull qwen2.5:3b`). FrameForge detects it on port `11434`.
- **Piper TTS (Offline Voices):** Download Piper Windows binary + `.onnx` voice files (including Hindi `hi_IN`), and set `PIPER_BINARY_PATH` inside `.env`.
