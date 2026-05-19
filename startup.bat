@echo off
setlocal
title Resume Insight Engine
cd /d "%~dp0"

echo ============================================
echo   Resume Insight Engine - Startup
echo ============================================
echo.

REM ── Quick check: skip installs if already set up ──
set "NEED_SETUP=0"
if not exist ".venv\Scripts\python.exe" set "NEED_SETUP=1"
if not exist "node_modules" set "NEED_SETUP=1"
if "%NEED_SETUP%"=="0" (
    .venv\Scripts\python.exe -c "import langchain_community" >nul 2>&1
    if errorlevel 1 set "NEED_SETUP=1"
)

if "%NEED_SETUP%"=="1" (
    echo [Setup] First-time setup detected...
    echo.

    if not exist ".venv" (
        echo   Creating Python venv...
        python -m venv .venv
        if errorlevel 1 (
            echo [ERROR] Python not found. Install Python 3.10+
            pause & exit /b 1
        )
    )

    echo   Installing backend deps...
    .venv\Scripts\python.exe -m pip install -r backend\requirements.txt -q
    if errorlevel 1 (
        echo [ERROR] pip install failed.
        pause & exit /b 1
    )

    echo   Installing frontend deps...
    call npm install --silent
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause & exit /b 1
    )

    echo   Setup complete!
    echo.
) else (
    echo [Ready] Dependencies found, skipping install.
    echo.
)

REM ── Launch both servers ──
start "Backend"  cmd /k ".venv\Scripts\python.exe -m backend.main"
timeout /t 2 /nobreak >nul
start "Frontend" cmd /k "npm run dev"

echo   Backend  : http://localhost:8000
echo   Frontend : http://localhost:5173
echo.
echo   Close each window to stop its service.
echo ============================================

endlocal
