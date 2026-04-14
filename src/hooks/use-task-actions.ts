'use client';

import { useCallback } from 'react';

type ToastFn = (message: string, type?: 'success' | 'error') => void;

type UseTaskActionsOptions = {
  showToast: ToastFn;
  onSuccess?: () => void | Promise<void>;
};

export function useTaskActions({ showToast, onSuccess }: UseTaskActionsOptions) {
  const runNow = useCallback(
    async (taskId: string) => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/run-now`, { method: 'POST' });
        if (!res.ok) {
          let msg = 'Failed to trigger job';
          try { const body = await res.json(); msg = body.error || msg; } catch { /* non-JSON */ }
          showToast(msg, 'error');
          return;
        }
        showToast('Job triggered');
        await onSuccess?.();
      } catch {
        showToast('Failed to trigger job', 'error');
      }
    },
    [showToast, onSuccess]
  );

  const togglePause = useCallback(
    async (taskId: string, active: boolean) => {
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduleIsActive: active }),
        });
        if (!res.ok) {
          let msg = 'Failed to update task';
          try { const body = await res.json(); msg = body.error || msg; } catch { /* non-JSON */ }
          showToast(msg, 'error');
          return;
        }
        showToast(active ? 'Task resumed' : 'Task paused');
        await onSuccess?.();
      } catch {
        showToast('Failed to update task', 'error');
      }
    },
    [showToast, onSuccess]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!window.confirm('Are you sure you want to delete this task? This will also remove its scheduled job.')) return;
      try {
        const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
        if (!res.ok) {
          let msg = 'Failed to delete task';
          try { const body = await res.json(); msg = body.error || msg; } catch { /* non-JSON */ }
          showToast(msg, 'error');
          return;
        }
        showToast('Task deleted');
        await onSuccess?.();
      } catch {
        showToast('Failed to delete task', 'error');
      }
    },
    [showToast, onSuccess]
  );

  return { runNow, togglePause, deleteTask };
}
