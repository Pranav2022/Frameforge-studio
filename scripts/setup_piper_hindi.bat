@echo off
echo ========================================================================
echo FrameForge Studio - Free Hindi & English Offline Voice Setup (Piper TTS)
echo ========================================================================
echo.
if not exist "models\speech" mkdir models\speech

echo Downloading free MIT-licensed Hindi (hi_IN-pratham-medium) voice model...
powershell -Command "Invoke-WebRequest -Uri 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx' -OutFile 'models\speech\hi_IN-pratham-medium.onnx'"
powershell -Command "Invoke-WebRequest -Uri 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx.json' -OutFile 'models\speech\hi_IN-pratham-medium.onnx.json'"

echo Downloading free MIT-licensed English (en_US-lessac-medium) voice model...
powershell -Command "Invoke-WebRequest -Uri 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx' -OutFile 'models\speech\en_US-lessac-medium.onnx'"
powershell -Command "Invoke-WebRequest -Uri 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json' -OutFile 'models\speech\en_US-lessac-medium.onnx.json'"

echo.
echo Voice models saved to models\speech\.
echo Make sure PIPER_BINARY_PATH in .env points to piper.exe!
pause
