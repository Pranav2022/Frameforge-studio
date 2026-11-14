@echo off
setlocal
echo ============================================================
echo   Starting FrameForge Studio on http://localhost:3000
echo   Press Ctrl+C to stop the server.
echo ============================================================
if not exist .env copy .env.example .env >nul
start "" http://localhost:3000
call npm run dev
pause
