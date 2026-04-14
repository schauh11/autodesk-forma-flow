import { z } from 'zod';

/** Safe name pattern: Unicode letters/numbers, spaces, hyphens, underscores, periods, parentheses.
 *  Uses \p{L} and \p{N} to support international project names (e.g. "Bürogebäude", "プロジェクト").
 *  Windows Task Scheduler sanitization happens separately in task-scheduler.ts. */
const safeName = z.string().min(1).max(200).regex(/^[\p{L}\p{N} _\-().]+$/u, 'Contains invalid characters');

/** Cron format: "minute hour dayOfWeek" with range validation */
const cronExpression = z.string()
  .regex(
    /^\d{1,2}\s+\d{1,2}\s+(\*|\d{1,2}(,\d{1,2})*)$/,
    'Must be "minute hour dayOfWeek" (e.g. "30 14 *" or "0 8 1,3,5")'
  )
  .refine((val) => {
    const parts = val.split(/\s+/);
    const min = Number(parts[0]);
    const hour = Number(parts[1]);
    if (min < 0 || min > 59 || hour < 0 || hour > 23) return false;
    const dayPart = parts[2];
    if (dayPart !== '*') {
      const days = dayPart!.split(',').map(Number);
      if (days.some((d) => isNaN(d) || d < 0 || d > 6)) return false;
    }
    return true;
  }, 'Minute must be 0-59, hour must be 0-23, day must be 0-6 or *');

// ── Task Schemas ──

export const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  name: safeName,
  taskType: z.literal('PUBLISH_MODEL').optional(),
  targetModelId: z.string().max(500).optional(),
  targetModelName: z.string().max(500).optional(),
  scheduleCron: cronExpression.optional(),
});

export const updateTaskSchema = z.object({
  name: safeName.optional(),
  scheduleCron: cronExpression.nullable().optional(),
  scheduleIsActive: z.boolean().optional(),
  targetModelId: z.string().max(500).optional(),
  targetModelName: z.string().max(500).optional(),
});

// ── Project Schemas ──

export const createProjectSchema = z.object({
  hubId: z.string().min(1).max(500),
  apsProjectId: z.string().min(1).max(500),
  projectName: safeName,
});

export const updateProjectSchema = z.object({
  projectName: safeName.optional(),
  hubId: z.string().min(1).max(500).optional(),
  apsProjectId: z.string().min(1).max(500).optional(),
});

// ── Settings Schema ──

export const updateSettingsSchema = z.object({
  clientId: z.string().min(1).max(500).optional(),
  clientSecret: z.string().min(1).max(500).optional(),
});

// ── Jobs Query Params ──

export const jobsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  status: z.enum(['RUNNING', 'SUCCESS', 'FAILED']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
