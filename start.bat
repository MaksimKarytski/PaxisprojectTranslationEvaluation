@echo off
title Translation Testing Suite
echo ========================================
echo   Translation Testing Suite Server
echo ========================================
echo.

REM Активация conda окружения и запуск сервера
call conda activate translate
if errorlevel 1 (
    echo [ERROR] Failed to activate conda environment 'translate'
    echo Make sure you have created it: conda create -n translate python=3.10
    pause
    exit /b 1
)

echo [OK] Conda environment 'translate' activated
echo [INFO] Starting server...
echo.
echo Open in browser: http://localhost:5000
echo.

python server.py

pause
