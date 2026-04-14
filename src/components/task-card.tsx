'use client';

import { useState } from 'react';
import { Pencil, Play, Pause, RotateCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TASK_TYPE_SHORT } from '@/lib/constants';
import { formatCron } from '@/lib/format-cron';

type TaskCardProps = {
  id: string;
  name: string;
  taskType: string;
  scheduleCron: string | null;
  scheduleIsActive: boolean | null;
  targetModelName: string | null;
  schedulerMissing?: boolean;
  onRunNow: (taskId: string) => Promise<void>;
  onTogglePause: (taskId: string, active: boolean) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onEdit?: (taskId: string) => void;
};

export function TaskCard({
  id,
  name,
  taskType,
  scheduleCron,
  scheduleIsActive,
  targetModelName,
  schedulerMissing,
  onRunNow,
  onTogglePause,
  onDelete,
  onEdit,
}: TaskCardProps) {
  const [running, setRunning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleRunNow = async () => {
    setRunning(true);
    try {
      await onRunNow(id);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="border-all-subtle bg-white shadow-sm">
      <div className="p-4 bg-slate-50/30 border-b-subtle">
        <div className="flex justify-between items-start gap-2">
          <h4 className="text-base font-semibold text-slate-800">{name}</h4>
          <div className="flex flex-wrap items-center gap-2 justify-end shrink-0">
            <Badge variant="neutral">{TASK_TYPE_SHORT[taskType] ?? taskType}</Badge>
            <Badge variant={scheduleIsActive ? 'info' : 'neutral'}>
              {scheduleIsActive ? 'Active' : 'Paused'}
            </Badge>
            {schedulerMissing && (
              <Badge variant="warning" title="Scheduled task not found in Windows Task Scheduler. Edit and save to re-create it.">
                Scheduler Missing
              </Badge>
            )}
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          {targetModelName && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600 w-16">Model</span>
              <span className="text-sm text-slate-700">{targetModelName}</span>
            </div>
          )}
          {scheduleCron && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600 w-16">Schedule</span>
              <span className="text-sm text-slate-700">{formatCron(scheduleCron)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-slate-200 px-4 py-2.5">
        {onEdit && (
          <Button onClick={() => onEdit(id)} title="Edit">
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit</span>
          </Button>
        )}
        <Button onClick={handleRunNow} disabled={running} title="Run Now">
          {running ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          <span>{running ? 'Running...' : 'Run Now'}</span>
        </Button>
        <Button
          onClick={() => onTogglePause(id, !scheduleIsActive)}
          title={scheduleIsActive ? 'Pause' : 'Resume'}
        >
          {scheduleIsActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{scheduleIsActive ? 'Pause' : 'Resume'}</span>
        </Button>
        {confirmDelete ? (
          <>
            <span className="ml-auto text-xs text-red-600 font-mono">Delete?</span>
            <Button variant="danger-fill" onClick={() => { onDelete(id); setConfirmDelete(false); }}>
              Yes
            </Button>
            <Button onClick={() => setConfirmDelete(false)}>No</Button>
          </>
        ) : (
          <Button variant="danger" onClick={() => setConfirmDelete(true)} className="ml-auto text-red-500 border-red-200" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </Button>
        )}
      </div>
    </div>
  );
}
