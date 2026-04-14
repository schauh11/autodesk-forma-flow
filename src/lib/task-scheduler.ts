import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import logger from '@/lib/logger';

const execFileAsync = promisify(execFile);

/**
 * Sanitize a string for use in file names, Task Scheduler names,
 * and .bat/.ps1 content. Only allows alphanumeric characters,
 * spaces, hyphens, and underscores.
 */
function sanitize(s: string): string {
  return s.replace(/[^A-Za-z0-9 _-]/g, '').trim().substring(0, 60);
}

/**
 * Get the Windows Task Scheduler task name
 */
export function getTaskName(projectName: string, taskName: string, taskId: string): string {
  const short = taskId.substring(0, 8);
  return `FormaFlow - ${sanitize(projectName)} - ${sanitize(taskName)} (${short})`;
}

/**
 * Check if a Windows Scheduled Task exists by name.
 * Used for 2-way sync: detect tasks deleted from Task Scheduler outside the app.
 */
export async function checkTaskExists(
  taskId: string,
  projectName: string,
  taskName: string
): Promise<boolean> {
  try {
    const schedulerName = projectName && taskName
      ? getTaskName(projectName, taskName, taskId)
      : `FormaFlow_${taskId}`;

    const psCommand = `$t = Get-ScheduledTask -TaskName '${schedulerName.replace(/'/g, "''")}' -ErrorAction SilentlyContinue; if ($null -eq $t) { Write-Host 'FALSE' } else { Write-Host 'TRUE' }`;
    const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', psCommand]);
    return stdout.trim() === 'TRUE';
  } catch {
    return false;
  }
}

/**
 * Get the tasks directory for per-task .bat files
 */
function getTasksDir(): string {
  const dataDir = process.env['FORMA_FLOW_DATA_DIR'] ||
    path.join(process.env['LOCALAPPDATA'] || path.join(require('os').homedir(), '.formaflow'), 'FormaFlow');
  const tasksDir = path.join(dataDir, 'tasks');
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true });
  }
  return tasksDir;
}

/**
 * Get the logs directory
 */
function getLogsDir(): string {
  const dataDir = process.env['FORMA_FLOW_DATA_DIR'] ||
    path.join(process.env['LOCALAPPDATA'] || path.join(require('os').homedir(), '.formaflow'), 'FormaFlow');
  const logsDir = path.join(dataDir, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  return logsDir;
}

/**
 * Generate a per-task .bat file that logs everything
 */
function generateTaskBat(
  taskId: string,
  projectName: string,
  taskName: string
): string {
  const batName = `${sanitize(projectName)} - ${sanitize(taskName)}.bat`;
  const batPath = path.join(getTasksDir(), batName);
  const logsDir = getLogsDir();
  const logFile = path.join(logsDir, `${sanitize(projectName)} - ${sanitize(taskName)}.log`);

  // Use app_dir from config if available, otherwise fall back to cwd
  let appDir = process.cwd();
  try {
    const { getConfig } = require('./config');
    const config = getConfig();
    if (config.app_dir) appDir = config.app_dir;
  } catch {
    // Config not available (e.g. during tests), use cwd
  }

  const content = `@echo off
:: Forma Flow Scheduled Task
:: Project: ${projectName}
:: Task: ${taskName}
:: Task ID: ${taskId}
:: Auto-generated, do not edit manually

set "LOGFILE=${logFile}"

echo ============================================ >> "%LOGFILE%"
echo [%DATE% %TIME%] Starting: ${projectName} - ${taskName} >> "%LOGFILE%"
echo [%DATE% %TIME%] Task ID: ${taskId} >> "%LOGFILE%"

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [%DATE% %TIME%] ERROR: Node.js not found >> "%LOGFILE%"
    exit /b 1
)

:: Run the publish script
cd /d "${appDir}"
echo [%DATE% %TIME%] Running publish from: %CD% >> "%LOGFILE%"
node scripts\\publish_task.js --task-id ${taskId} >> "%LOGFILE%" 2>&1
set "EXIT_CODE=%ERRORLEVEL%"

if %EXIT_CODE% equ 0 (
    echo [%DATE% %TIME%] SUCCESS >> "%LOGFILE%"
) else (
    echo [%DATE% %TIME%] FAILED (exit code %EXIT_CODE%) >> "%LOGFILE%"
)
echo ============================================ >> "%LOGFILE%"
exit /b %EXIT_CODE%
`;

  fs.writeFileSync(batPath, content, 'utf8');
  logger.info({ batPath, taskId }, 'Generated task .bat file');
  return batPath;
}

/**
 * Remove a per-task .bat file
 */
function removeTaskBat(projectName: string, taskName: string): void {
  const batName = `${sanitize(projectName)} - ${sanitize(taskName)}.bat`;
  const batPath = path.join(getTasksDir(), batName);
  if (fs.existsSync(batPath)) {
    // Move to archive instead of deleting
    const archiveDir = path.join(getTasksDir(), 'archived');
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
    fs.renameSync(batPath, path.join(archiveDir, batName));
    logger.info({ batPath }, 'Archived task .bat file');
  }
}

/**
 * Parse custom cron format: "minute hour dayOfWeek"
 */
export function cronToSchtasks(cron: string): {
  schedule: 'daily' | 'weekly';
  days?: string;
  startTime: string;
} {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 3) {
    throw new Error(`Invalid cron format: expected "minute hour dayOfWeek", got "${cron}"`);
  }

  const [minuteStr, hourStr, dayOfWeekStr] = parts;
  if (!minuteStr || !hourStr || !dayOfWeekStr) {
    throw new Error(`Invalid cron format: missing components in "${cron}"`);
  }

  const minute = parseInt(minuteStr, 10);
  const hour = parseInt(hourStr, 10);

  if (isNaN(minute) || minute < 0 || minute > 59) throw new Error(`Invalid minute: ${minuteStr}`);
  if (isNaN(hour) || hour < 0 || hour > 23) throw new Error(`Invalid hour: ${hourStr}`);

  const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  const dayMap: Record<number, string> = { 0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT' };

  if (dayOfWeekStr === '*') return { schedule: 'daily', startTime };

  const dayNumbers = dayOfWeekStr.split(',').map((d) => parseInt(d.trim(), 10));
  if ([0, 1, 2, 3, 4, 5, 6].every((d) => dayNumbers.includes(d))) return { schedule: 'daily', startTime };

  const dayNames = dayNumbers
    .sort((a, b) => a - b)
    .map((d) => {
      if (isNaN(d) || d < 0 || d > 6) throw new Error(`Invalid day of week: ${d}`);
      return dayMap[d];
    })
    .join(',');

  return { schedule: 'weekly', days: dayNames, startTime };
}

/**
 * Configure task settings via PowerShell (4h limit, wake, start-when-available)
 */
async function configureTaskSettings(schedulerName: string, description: string): Promise<void> {
  try {
    const psCommand = [
      `$task = Get-ScheduledTask -TaskName '${schedulerName.replace(/'/g, "''")}'`,
      `$task.Settings.ExecutionTimeLimit = 'PT4H'`,
      `$task.Settings.WakeToRun = $true`,
      `$task.Settings.StartWhenAvailable = $true`,
      `$task.Principal.RunLevel = 'Highest'`,
      `$task.Description = '${description.replace(/'/g, "''")}'`,
      `Set-ScheduledTask -InputObject $task`,
    ].join('; ');

    await execFileAsync('powershell', ['-NoProfile', '-Command', psCommand]);
    logger.info({ schedulerName }, 'Configured task settings (4h limit, wake, start-when-available)');
  } catch (err) {
    logger.warn({ schedulerName, err }, 'Failed to configure task settings via PowerShell');
  }
}

/**
 * Create a Windows Scheduled Task with its own .bat file
 */
export async function createScheduledTask(
  taskId: string,
  taskName: string,
  scheduleCron: string,
  projectName: string = 'FormaFlow'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate per-task .bat file
    const batPath = generateTaskBat(taskId, projectName, taskName);

    // Parse cron
    const schtasksConfig = cronToSchtasks(scheduleCron);
    const schedulerName = getTaskName(projectName, taskName, taskId);

    // Create scheduled task pointing to the per-task .bat
    const args = ['/create', '/tn', schedulerName, '/tr', `"${batPath}"`, '/sc', schtasksConfig.schedule];

    if (schtasksConfig.schedule === 'weekly' && schtasksConfig.days) {
      args.push('/d', schtasksConfig.days);
    }

    args.push('/st', schtasksConfig.startTime, '/f');

    await execFileAsync('schtasks', args);
    logger.info({ taskId, schedulerName, batPath }, 'Created Windows Scheduled Task');

    // Configure: 4h limit, wake to run, description
    await configureTaskSettings(schedulerName, `${projectName} - ${taskName}`);

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ taskId, error: errorMessage }, 'Failed to create scheduled task');
    return { success: false, error: errorMessage };
  }
}

/**
 * Update a Windows Scheduled Task (delete + recreate)
 */
export async function updateScheduledTask(
  taskId: string,
  scheduleCron: string,
  taskName: string = '',
  projectName: string = 'FormaFlow'
): Promise<{ success: boolean; error?: string }> {
  await deleteScheduledTask(taskId, projectName, taskName);
  return createScheduledTask(taskId, taskName, scheduleCron, projectName);
}

/**
 * Delete a Windows Scheduled Task and its .bat file
 */
export async function deleteScheduledTask(
  taskId: string,
  projectName: string = '',
  taskName: string = ''
): Promise<{ success: boolean; error?: string }> {
  try {
    // Try to delete by constructed name
    const schedulerName = projectName && taskName
      ? getTaskName(projectName, taskName, taskId)
      : `FormaFlow_${taskId}`;

    try {
      await execFileAsync('schtasks', ['/delete', '/tn', schedulerName, '/f']);
    } catch {
      // Try legacy name format as fallback
      try {
        await execFileAsync('schtasks', ['/delete', '/tn', `FormaFlow_${taskId}`, '/f']);
      } catch {
        // Task might not exist, that's fine
      }
    }

    // Archive the .bat file if it exists
    if (projectName && taskName) {
      removeTaskBat(projectName, taskName);
    }

    logger.info({ taskId }, 'Deleted Windows Scheduled Task');
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ taskId, error: errorMessage }, 'Failed to delete scheduled task');
    return { success: false, error: errorMessage };
  }
}

/**
 * Disable a Windows Scheduled Task
 */
export async function disableScheduledTask(
  taskId: string,
  projectName: string = '',
  taskName: string = ''
): Promise<{ success: boolean; error?: string }> {
  try {
    const schedulerName = projectName && taskName
      ? getTaskName(projectName, taskName, taskId)
      : `FormaFlow_${taskId}`;

    await execFileAsync('schtasks', ['/change', '/tn', schedulerName, '/disable']);
    logger.info({ taskId }, 'Disabled Windows Scheduled Task');
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ taskId, error: errorMessage }, 'Failed to disable scheduled task');
    return { success: false, error: errorMessage };
  }
}

/**
 * Enable a Windows Scheduled Task
 */
export async function enableScheduledTask(
  taskId: string,
  projectName: string = '',
  taskName: string = ''
): Promise<{ success: boolean; error?: string }> {
  try {
    const schedulerName = projectName && taskName
      ? getTaskName(projectName, taskName, taskId)
      : `FormaFlow_${taskId}`;

    await execFileAsync('schtasks', ['/change', '/tn', schedulerName, '/enable']);
    logger.info({ taskId }, 'Enabled Windows Scheduled Task');
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ taskId, error: errorMessage }, 'Failed to enable scheduled task');
    return { success: false, error: errorMessage };
  }
}
