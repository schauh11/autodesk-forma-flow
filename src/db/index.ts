import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';
import os from 'os';

function getDefaultDbPath(): string {
  const dataDir = process.env['FORMA_FLOW_DATA_DIR'] ||
    path.join(process.env['LOCALAPPDATA'] || path.join(os.homedir(), '.formaflow'), 'FormaFlow');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'app.db');
}

const dbPath = process.env['DATABASE_PATH'] || getDefaultDbPath();

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

// Schema initialization via raw SQL (mirrors schema.ts definitions).
// SQLite databases are ephemeral, they can be safely recreated from scratch.
const statements = [
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    hub_id TEXT,
    aps_project_id TEXT,
    project_name TEXT,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    task_type TEXT NOT NULL DEFAULT 'PUBLISH_MODEL',
    target_model_id TEXT,
    target_model_name TEXT,
    schedule_cron TEXT,
    schedule_is_active INTEGER DEFAULT 1,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS job_results (
    id TEXT PRIMARY KEY,
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    status TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    error_details TEXT,
    result_data TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS model_insights (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    version_number INTEGER,
    file_size INTEGER,
    view_count INTEGER,
    sheet_count INTEGER,
    schedule_count INTEGER,
    revit_link_count INTEGER,
    cad_link_count INTEGER,
    family_count INTEGER,
    in_place_count INTEGER,
    room_count INTEGER,
    level_count INTEGER,
    total_elements INTEGER,
    health_score INTEGER,
    details TEXT,
    fetched_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
];

const indexes = [
  `CREATE INDEX IF NOT EXISTS idx_job_results_task_id ON job_results(task_id)`,
  `CREATE INDEX IF NOT EXISTS idx_job_results_status ON job_results(status)`,
  `CREATE INDEX IF NOT EXISTS idx_job_results_created_at ON job_results(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_model_insights_project_id ON model_insights(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_model_insights_fetched_at ON model_insights(fetched_at)`,
  `CREATE INDEX IF NOT EXISTS idx_model_insights_project_fetched ON model_insights(project_id, fetched_at DESC)`,
];

// Migrations: add columns to existing tables
const migrations = [
  `ALTER TABLE model_insights ADD COLUMN total_elements INTEGER`,
];

for (const sql of [...statements, ...indexes]) {
  sqlite.prepare(sql).run();
}

// Run migrations (ignore errors if column already exists)
for (const sql of migrations) {
  try { sqlite.prepare(sql).run(); } catch { /* column already exists */ }
}
