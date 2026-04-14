@echo off
setlocal EnableDelayedExpansion

:: ============================================================
::  Forma Flow launcher
::  Log file:   start.log (next to this batch file)
::  Window:     stays open on every exit path so errors are visible
:: ============================================================

cd /d "%~dp0"
set "LOG=%~dp0start.log"

:: Fresh log per run
echo [%date% %time%] start.bat begin > "%LOG%" 2>&1

title Forma Flow
echo.
echo   ============================
echo   Forma Flow, Model Publisher
echo   ============================
echo.

:: -------------------------------------------------
:: Step 1: Node.js check
:: -------------------------------------------------
echo [1/5] Checking Node.js...
>> "%LOG%" echo [1/5] Checking Node.js...
where node >> "%LOG%" 2>&1
if errorlevel 1 (
    echo.
    echo   [ERROR] Node.js is not installed or not on PATH.
    echo.
    echo   Download the LTS version from https://nodejs.org
    echo   then run this file again.
    >> "%LOG%" echo [ERROR] Node.js not found on PATH.
    goto :error
)
for /f "tokens=*" %%i in ('node -v 2^>^&1') do (
    echo   Node.js %%i detected
    >> "%LOG%" echo Node.js %%i detected
)

:: -------------------------------------------------
:: Step 2: Working directory
:: -------------------------------------------------
echo [2/5] Working directory: %CD%
>> "%LOG%" echo [2/5] Working directory: %CD%

:: -------------------------------------------------
:: Step 3: Dependencies
:: -------------------------------------------------
echo [3/5] Checking dependencies...
>> "%LOG%" echo [3/5] Checking dependencies...
if not exist node_modules (
    echo   node_modules not found. Running npm install, first run only...
    echo   This may take a few minutes.
    >> "%LOG%" echo Running npm install...
    call npm install --loglevel=error >> "%LOG%" 2>&1
    if errorlevel 1 (
        echo.
        echo   [ERROR] npm install failed. See log:
        echo     %LOG%
        >> "%LOG%" echo [ERROR] npm install failed with errorlevel !errorlevel!
        goto :error
    )
    echo   Dependencies installed.
    >> "%LOG%" echo Dependencies installed.
) else (
    echo   node_modules present, skipping install.
    >> "%LOG%" echo node_modules present, skipping install.
)

:: -------------------------------------------------
:: Step 4: Schedule browser open in 3s
:: -------------------------------------------------
echo [4/5] Browser will open in ~3 seconds.
>> "%LOG%" echo [4/5] Browser will open in ~3 seconds.
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000/settings"

:: -------------------------------------------------
:: Step 5: Next.js dev server (blocking)
:: -------------------------------------------------
echo [5/5] Starting Next.js dev server...
echo.
echo   Keep this window open while using Forma Flow.
echo   Press Ctrl+C to stop.
echo.
>> "%LOG%" echo [5/5] Starting: npm run dev
call npm run dev
set "EXITCODE=%ERRORLEVEL%"
>> "%LOG%" echo npm run dev exited with %EXITCODE%

if not "%EXITCODE%"=="0" (
    echo.
    echo   [ERROR] npm run dev exited with code %EXITCODE%.
    echo   See log: %LOG%
    goto :error
)

:: -------------------------------------------------
:: Normal end: server stopped cleanly
:: -------------------------------------------------
echo.
echo   Server stopped.
>> "%LOG%" echo [%date% %time%] start.bat end (success)
pause
exit /b 0

:: -------------------------------------------------
:: Error path: always pause so user can read messages
:: -------------------------------------------------
:error
>> "%LOG%" echo [%date% %time%] start.bat end (error)
echo.
echo   Press any key to close this window.
pause >nul
exit /b 1
\r