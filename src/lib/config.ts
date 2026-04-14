import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import logger from '@/lib/logger';

export interface AppConfig {
  encryption_key: string;
  aps_client_id: string;
  aps_client_secret: string;
  refresh_token_encrypted: string;
  refresh_token_iv: string;
  autodesk_user_email: string;
  autodesk_user_name: string;
  connected_at: string;
  app_dir: string;
  port: number;
}

const DEFAULT_CONFIG: AppConfig = {
  encryption_key: '', // auto-generated on first access
  aps_client_id: '',
  aps_client_secret: '',
  refresh_token_encrypted: '',
  refresh_token_iv: '',
  autodesk_user_email: '',
  autodesk_user_name: '',
  connected_at: '',
  app_dir: '', // set to process.cwd() on first creation
  port: 3000,
};

/**
 * Returns the data directory path.
 * Uses FORMA_FLOW_DATA_DIR env var if set, otherwise defaults to:
 * %LOCALAPPDATA%\FormaFlow (Windows) or ~/.formaflow/FormaFlow (other)
 */
export function getDataDir(): string {
  if (process.env['FORMA_FLOW_DATA_DIR']) {
    return process.env['FORMA_FLOW_DATA_DIR'];
  }

  const localAppData =
    process.env['LOCALAPPDATA'] ||
    path.join(os.homedir(), '.formaflow');
  return path.join(localAppData, 'FormaFlow');
}

/**
 * Returns the config file path
 */
export function getConfigPath(): string {
  return path.join(getDataDir(), 'config.json');
}

/**
 * Returns the database file path
 */
export function getDbPath(): string {
  return path.join(getDataDir(), 'app.db');
}

/**
 * Returns the logs directory path
 */
export function getLogsDir(): string {
  return path.join(getDataDir(), 'logs');
}

/**
 * Ensures data directory and logs subdirectory exist
 */
export function ensureDataDir(): void {
  const dataDir = getDataDir();
  const logsDir = getLogsDir();

  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(logsDir, { recursive: true });
  } catch (error) {
    logger.error(
      { error, dataDir, logsDir },
      'Failed to create data directory'
    );
    throw error;
  }
}

/**
 * Reads and returns the current configuration.
 * If config.json doesn't exist, creates it with defaults + auto-generated encryption_key.
 * Merges with DEFAULT_CONFIG to handle missing fields.
 */
export function getConfig(): AppConfig {
  ensureDataDir();

  const configPath = getConfigPath();

  try {
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, 'utf-8');
      const parsedConfig = JSON.parse(fileContent);
      // Merge with defaults to handle missing fields
      return { ...DEFAULT_CONFIG, ...parsedConfig };
    }
  } catch (error) {
    logger.warn(
      { error, configPath },
      'Failed to read config.json, creating new one'
    );
  }

  // Create new config with auto-generated encryption key and current app directory
  const newConfig: AppConfig = {
    ...DEFAULT_CONFIG,
    encryption_key: crypto.randomBytes(32).toString('hex'),
    app_dir: process.cwd(),
  };

  try {
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), { encoding: 'utf-8', mode: 0o600 });
    logger.info({ configPath }, 'Created new config file');
  } catch (error) {
    logger.error({ error, configPath }, 'Failed to write config file');
    throw error;
  }

  return newConfig;
}

/**
 * Saves configuration updates atomically.
 * Reads current config, merges with updates, writes back.
 * Logs the save operation (but not the values for security).
 */
export function saveConfig(updates: Partial<AppConfig>): void {
  ensureDataDir();

  const configPath = getConfigPath();

  try {
    let currentConfig: AppConfig;

    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, 'utf-8');
      const parsedConfig = JSON.parse(fileContent);
      currentConfig = { ...DEFAULT_CONFIG, ...parsedConfig };
    } else {
      currentConfig = { ...DEFAULT_CONFIG };
    }

    // Merge updates
    const updatedConfig = { ...currentConfig, ...updates };

    // Write atomically using a temp file
    const tempPath = `${configPath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(updatedConfig, null, 2), { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(tempPath, configPath);

    logger.info(
      { configPath, updatedFields: Object.keys(updates) },
      'Config saved'
    );
  } catch (error) {
    logger.error({ error, configPath }, 'Failed to save config');
    throw error;
  }
}
