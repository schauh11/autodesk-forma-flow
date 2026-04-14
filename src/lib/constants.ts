export const TASK_TYPES = {
  PUBLISH_MODEL: 'PUBLISH_MODEL',
} as const;

export type TaskType = (typeof TASK_TYPES)[keyof typeof TASK_TYPES];

export const TASK_TYPE_LABELS: Record<string, string> = {
  [TASK_TYPES.PUBLISH_MODEL]: 'Publish Model',
};

export const TASK_TYPE_SHORT: Record<string, string> = {
  [TASK_TYPES.PUBLISH_MODEL]: 'Publish',
};

export const JOB_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  SUCCESS: { label: 'Success', color: 'text-emerald-600' },
  FAILED: { label: 'Failed', color: 'text-red-500' },
  RUNNING: { label: 'Running', color: 'text-amber-600' },
  PENDING: { label: 'Pending', color: 'text-slate-500' },
};
