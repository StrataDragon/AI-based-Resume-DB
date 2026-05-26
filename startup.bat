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
    .venv\Scripts\python.exe -c "import langchain_community" >nul 2>&1 || set "NEED_SETUP=1"
)

if "%NEED_SETUP%"=="1" (
    echo [Setup] First-time setup detected...
    echo.

    if not exist ".venv" (
        echo   Creating Python venv...
        python -m venv .venv || (
            echo [ERROR] python -m venv failed. Trying 'py' command...
            py -m venv .venv || (
                echo [ERROR] Python not found. Please install Python 3.10+ and add it to PATH.
                pause & exit /b 1
            )
        )
    )

    echo   Upgrading pip...
    .venv\Scripts\python.exe -m pip install --upgrade pip -q || (
        echo [WARNING] Failed to upgrade pip. Continuing with install...
    )

    echo   Installing backend deps...
    .venv\Scripts\python.exe -m pip install -r backend\requirements.txt || (
        echo [ERROR] pip install failed. Please check your internet connection or Python version.
        pause & exit /b 1
    )

    echo   Installing frontend deps...
    call npm install --no-audit --no-fund || (
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
echo   Starting Backend server...
start "Backend Server" cmd /k ".venv\Scripts\python.exe -m backend.main"
timeout /t 2 /nobreak >nul

echo   Starting Frontend dev server...
start "Frontend Server" cmd /k "npm run dev"

echo.
echo ============================================
echo   SERVERS STARTED SUCCESSFULY
echo --------------------------------------------
echo   Backend  : http://localhost:8000
echo   Frontend : http://localhost:5173
echo.
echo   Press any key to close this launcher.
echo   (The servers will keep running in their own windows)
echo ============================================
pause >nul

endlocal
