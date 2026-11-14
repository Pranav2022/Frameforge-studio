@echo off
setlocal enabledelayedexpansion
echo ============================================================
echo   FrameForge Studio - Windows Beginner Installer (Zero Cost)
echo ============================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Node.js v20+ is not installed.
  echo Please install Node.js LTS from https://nodejs.org/ and re-run this script.
  pause
  exit /b 1
)

where ffmpeg >nul 2>nul
if %errorlevel% neq 0 (
  echo [WARN] FFmpeg not found in PATH. Installing via winget if available...
  where winget >nul 2>nul
  if %errorlevel% equ 0 (
    winget install Gyan.FFmpeg
  ) else (
    echo Please download FFmpeg from https://www.gyan.dev/ffmpeg/builds/ and add its bin folder to PATH.
  )
)

echo [1/4] Creating storage folders...
if not exist projects mkdir projects
if not exist cache mkdir cache
if not exist logs mkdir logs
if not exist models\image mkdir models\image
if not exist models\video mkdir models\video
if not exist models\speech mkdir models\speech
if not exist models\audio mkdir models\audio

if not exist .env (
  copy .env.example .env >nul
  echo [2/4] Created .env from .env.example
) else (
  echo [2/4] .env already exists, keeping existing settings
)

echo [3/4] Installing Node.js dependencies...
call npm install
if %errorlevel% neq 0 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)

where python >nul 2>nul
if %errorlevel% equ 0 (
  echo [4/4] Setting up optional Python FastAPI environment...
  if not exist backend\.venv python -m venv backend\.venv
  call backend\.venv\Scripts\pip install -r backend\requirements.txt
) else (
  echo [4/4] Python not detected; primary Node+FFmpeg engine will run without Python.
)

echo.
echo Installation complete! Double-click start.bat to launch FrameForge Studio.
pause
