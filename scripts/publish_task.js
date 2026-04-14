#!/usr/bin/env node
'use strict';

/**
 * Forma Flow Task Worker
 * Publishes Revit models via APS. Called by Windows Task Scheduler.
 * Usage: node publish_task.js --task-id <uuid>
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');

const APS_BASE_URL = 'https://developer.api.autodesk.com';

// ============================================================================
// Redaction (strips tokens from strings before they reach console or disk logs)
// ============================================================================

function redact(input) {
  if (input == null) return input;
  let s = typeof input === 'string' ? input : String(input);
  // JWT-shaped tokens: header.payload.signature, all base64url
  s = s.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]');
  // Long base64 or hex blobs that look like tokens (>= 40 chars)
  s = s.replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[REDACTED_TOKEN]');
  // Explicit key-value shapes from JSON error bodies
  s = s.replace(/"(access_token|refresh_token|client_secret|id_token|authorization)"\s*:\s*"[^"]*"/gi, '"$1":"[REDACTED]"');
  return s;
}

// ============================================================================
// Config
// ============================================================================

function getDataDir() {
  return process.env.FORMA_FLOW_DATA_DIR ||
    path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.formaflow'), 'FormaFlow');
}

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    console.error(`ERROR: Config not found: ${configPath}`);
    console.error('Run the Forma Flow web UI first to set up credentials.');
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  for (const key of ['encryption_key', 'aps_client_id', 'aps_client_secret']) {
    if (!config[key]) {
      console.error(`ERROR: ${key} not set. Open Settings in the web UI.`);
      process.exit(1);
    }
  }
  if (!config.refresh_token_encrypted) {
    console.error('ERROR: Not connected to Autodesk. Open Settings and click Connect.');
    process.exit(1);
  }
  if (!/^[0-9a-f]{64}$/i.test(config.encryption_key)) {
    console.error('ERROR: encryption_key is invalid (expected 64 hex characters). Re-run the web UI to regenerate.');
    process.exit(1);
  }
  return config;
}

// ============================================================================
// Crypto (matches src/lib/crypto.ts format exactly)
// ============================================================================

function decryptToken(encryptedHex, ivHex, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const combined = Buffer.from(encryptedHex, 'hex');
  const authTag = combined.slice(-16);
  const ciphertext = combined.slice(0, -16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function encryptToken(plaintext, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return { ciphertext: encrypted.toString('hex'), iv: iv.toString('hex') };
}

// ============================================================================
// APS API
// ============================================================================

async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  const res = await fetch(`${APS_BASE_URL}/authentication/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'data:read data:write data:create',
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${redact(await res.text())}`);
  return res.json();
}

async function publishModel(accessToken, projectId, itemId) {
  const normalizedId = projectId.startsWith('b.') ? projectId : `b.${projectId}`;
  const res = await fetch(`${APS_BASE_URL}/data/v1/projects/${normalizedId}/commands`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      jsonapi: { version: '1.0' },
      data: {
        type: 'commands',
        attributes: {
          extension: {
            type: 'commands:autodesk.bim360:C4RModelPublish',
            version: '1.0.0',
          },
        },
        relationships: {
          resources: {
            data: [{ type: 'items', id: itemId }],
          },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Publish failed: ${res.status} ${redact(await res.text())}`);
  const result = await res.json();
  return result.data.id;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  // Parse args
  const args = process.argv.slice(2);
  let taskId, configPath, dbPath;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--task-id') taskId = args[++i];
    else if (args[i] === '--config-path') configPath = args[++i];
    else if (args[i] === '--db-path') dbPath = args[++i];
  }
  if (!taskId) {
    console.error('Usage: node publish_task.js --task-id <uuid>');
    process.exit(1);
  }

  const dataDir = getDataDir();
  configPath = configPath || path.join(dataDir, 'config.json');
  dbPath = dbPath || path.join(dataDir, 'app.db');

  // Load config
  const config = loadConfig(configPath);
  const now = new Date().toISOString();
  const jobResultId = crypto.randomUUID();

  // Open database
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  try {
    // Query task
    const task = db.prepare('SELECT id, project_id, target_model_id FROM tasks WHERE id = ? AND is_deleted = 0').get(taskId);
    if (!task) {
      console.error(`ERROR: Task ${taskId} not found or deleted`);
      process.exit(1);
    }
    console.log(`[${now}] Task: ${task.id}`);

    // Query project
    const project = db.prepare('SELECT id, aps_project_id FROM projects WHERE id = ?').get(task.project_id);
    if (!project) {
      console.error(`ERROR: Project ${task.project_id} not found`);
      process.exit(1);
    }
    console.log(`[${now}] Project: ${project.id}`);

    // Create job result
    db.prepare('INSERT INTO job_results (id, task_id, status, started_at, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(jobResultId, taskId, 'RUNNING', now, now);
    console.log(`[${now}] Job: ${jobResultId}`);

    // Decrypt refresh token
    const refreshToken = decryptToken(config.refresh_token_encrypted, config.refresh_token_iv, config.encryption_key);
    console.log(`[${now}] Token decrypted`);

    // Refresh access token
    const tokenResponse = await refreshAccessToken(refreshToken, config.aps_client_id, config.aps_client_secret);
    console.log(`[${now}] Access token refreshed`);

    // Save rotated token if needed
    if (tokenResponse.refresh_token && tokenResponse.refresh_token !== refreshToken) {
      const { ciphertext, iv } = encryptToken(tokenResponse.refresh_token, config.encryption_key);
      config.refresh_token_encrypted = ciphertext;
      config.refresh_token_iv = iv;
      // Atomic write: temp file + rename to prevent corruption on crash
      const tempPath = configPath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(config, null, 2));
      fs.renameSync(tempPath, configPath);
      console.log(`[${now}] Refresh token rotated and saved`);
    }

    // Publish model
    const commandId = await publishModel(tokenResponse.access_token, project.aps_project_id, task.target_model_id);
    console.log(`[${now}] Published! Command: ${commandId}`);

    // Update job result - SUCCESS
    db.prepare('UPDATE job_results SET status = ?, completed_at = ?, result_data = ? WHERE id = ?')
      .run('SUCCESS', new Date().toISOString(), JSON.stringify({ commandId }), jobResultId);

    console.log(`[${now}] Done - SUCCESS`);
  } catch (err) {
    const msg = redact(err.message || String(err));
    console.error(`[${new Date().toISOString()}] FAILED: ${msg}`);
    try {
      db.prepare('UPDATE job_results SET status = ?, completed_at = ?, error_details = ? WHERE id = ?')
        .run('FAILED', new Date().toISOString(), JSON.stringify({ message: msg }), jobResultId);
    } catch { /* ignore write failure */ }
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
