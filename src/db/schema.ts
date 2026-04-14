import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

const now = () => new Date().toISOString();

// Projects, one per workspace
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  hubId: text('hub_id'),
  apsProjectId: text('aps_project_id'),
  projectName: text('project_name'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().$defaultFn(now),
  updatedAt: text('updated_at').notNull().$defaultFn(now),
});

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  taskType: text('task_type').notNull().default('PUBLISH_MODEL'),
  targetModelId: text('target_model_id'),
  targetModelName: text('target_model_name'),
  scheduleCron: text('schedule_cron'),
  scheduleIsActive: integer('schedule_is_active', { mode: 'boolean' }).default(true),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().$defaultFn(now),
  updatedAt: text('updated_at').notNull().$defaultFn(now),
});

export const jobResults = sqliteTable('job_results', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  status: text('status').notNull(),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  errorDetails: text('error_details', { mode: 'json' }),
  resultData: text('result_data', { mode: 'json' }),
  createdAt: text('created_at').notNull().$defaultFn(now),
});

// Relations
export const projectsRelations = relations(projects, ({ many }) => ({
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  jobResults: many(jobResults),
}));

export const jobResultsRelations = relations(jobResults, ({ one }) => ({
  task: one(tasks, { fields: [jobResults.taskId], references: [tasks.id] }),
}));
