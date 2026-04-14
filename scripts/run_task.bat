@echo off
:: Forma Flow Task Runner - called by Windows Task Scheduler
:: Usage: run_task.bat <task-id>

:: Set up logging
set "LOGDIR=%LOCALAPPDATA%\FormaFlow\logs"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
set "LOGFILE=%LOGDIR%\scheduler.log"

echo ============================================ >> "%LOGFILE%"
echo [%DATE% %TIME%] Task %1 starting >> "%LOGFILE%"

:: Navigate to project directory
cd /d "%~dp0.."
echo [%DATE% %TIME%] Working directory: %CD% >> "%LOGFILE%"

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [%DATE% %TIME%] ERROR: Node.js not found. Install from https://nodejs.org >> "%LOGFILE%"
    exit /b 1
)

:: Run the publish task
echo [%DATE% %TIME%] Running: node scripts/publish_task.js --task-id %1 >> "%LOGFILE%"
node scripts\publish_task.js --task-id %1 >> "%LOGFILE%" 2>&1
set "EXIT_CODE=%ERRORLEVEL%"

echo [%DATE% %TIME%] Task %1 finished (exit code %EXIT_CODE%) >> "%LOGFILE%"
echo ============================================ >> "%LOGFILE%"
exit /b %EXIT_CODE%
