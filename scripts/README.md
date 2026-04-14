# Forma Flow Scripts

## publish_task.js

Node.js script that publishes a Revit model via APS. Called by Windows Task Scheduler.

### Usage

```
node publish_task.js --task-id <uuid> [--config-path <path>] [--db-path <path>]
```

### Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| --task-id | Yes |, | UUID of the task to execute |
| --config-path | No | %LOCALAPPDATA%\FormaFlow\config.json | Path to config.json |
| --db-path | No | %LOCALAPPDATA%\FormaFlow\app.db | Path to SQLite database |

### What it does

1. Reads credentials and encrypted refresh token from config.json
2. Reads task and project details from SQLite
3. Decrypts refresh token (AES-256-GCM)
4. Refreshes OAuth access token via APS API
5. Calls C4RModelPublish to publish the Revit model
6. Writes job result (success/failure) to SQLite
7. If APS rotates the refresh token, saves the new one to config.json

No extra dependencies, uses Node.js built-ins + better-sqlite3 (already in node_modules).

## run_task.bat

Batch wrapper called by Windows Task Scheduler. Logs output to %LOCALAPPDATA%\FormaFlow\logs\scheduler.log.

Usage: `run_task.bat <task-id>`
