'use client';

import { useState } from 'react';
import { JOB_STATUS_CONFIG, TASK_TYPE_SHORT } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const STATUS_BADGE_VARIANT: Record<string, 'success' | 'error' | 'warning' | 'neutral'> = {
  SUCCESS: 'success',
  FAILED: 'error',
  RUNNING: 'warning',
  PENDING: 'neutral',
};

type JobResult = {
  job: {
    id: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    errorDetails: { message?: string } | null;
    resultData: { signedUrl?: string; commandId?: string } | null;
    createdAt: string;
  };
  taskName: string | null;
  taskType: string | null;
  projectName: string | null;
};

function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '-';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m`;
}

export function JobHistoryTable({
  jobs,
  showProjectColumn = true,
}: {
  jobs: JobResult[];
  showProjectColumn?: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (jobs.length === 0) {
    return (
      <div className="border-all-subtle border-dashed border-slate-200 p-8 text-center">
        <p className="text-sm text-slate-500">No job history yet</p>
      </div>
    );
  }

  return (
    <div className="border-all-subtle bg-white shadow-sm">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-3 text-left text-xs text-slate-600 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs text-slate-600 uppercase">Task</th>
            <th className="px-4 py-3 text-left text-xs text-slate-600 uppercase hidden md:table-cell">Type</th>
            {showProjectColumn && (
              <th className="px-4 py-3 text-left text-xs text-slate-600 uppercase hidden lg:table-cell">Project</th>
            )}
            <th className="px-4 py-3 text-left text-xs text-slate-600 uppercase">Duration</th>
            <th className="px-4 py-3 text-left text-xs text-slate-600 uppercase hidden sm:table-cell">Created</th>
            <th className="px-4 py-3 text-left text-xs text-slate-600 uppercase w-20"></th>
          </tr>
        </thead>
        <tbody>
          {jobs.flatMap(({ job, taskName, taskType, projectName }) => {
            const cfg = JOB_STATUS_CONFIG[job.status] ?? { label: job.status, color: 'text-slate-500' };
            const rows = [
              <tr key={job.id} className="hover:bg-slate-50 transition-colors border-b-subtle">
                <td className="px-4 py-4">
                  <Badge variant={STATUS_BADGE_VARIANT[job.status] || 'neutral'}>
                    {cfg.label}
                  </Badge>
                </td>
                <td className="px-4 py-4">
                  <span className="font-mono text-slate-700 text-sm">{taskName || '-'}</span>
                </td>
                <td className="px-4 py-4 hidden md:table-cell">
                  <Badge variant="neutral">
                    {TASK_TYPE_SHORT[taskType ?? ''] ?? taskType ?? '-'}
                  </Badge>
                </td>
                {showProjectColumn && (
                  <td className="px-4 py-4 text-sm text-slate-600 hidden lg:table-cell">{projectName || '-'}</td>
                )}
                <td className="px-4 py-4 font-mono text-sm text-slate-600 tabular-nums">
                  {formatDuration(job.startedAt, job.completedAt)}
                </td>
                <td className="px-4 py-4 font-mono text-sm text-slate-600 hidden sm:table-cell">
                  {new Date(job.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-4">
                  <div className="flex gap-2 justify-end">
                    {job.status === 'FAILED' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        {expandedId === job.id ? 'Hide' : 'Details'}
                      </Button>
                    )}
                    {job.resultData?.signedUrl && (
                      <a
                        href={job.resultData.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Download
                      </a>
                    )}
                  </div>
                </td>
              </tr>,
            ];
            if (expandedId === job.id && job.errorDetails) {
              rows.push(
                <tr key={`${job.id}-error`}>
                  <td colSpan={showProjectColumn ? 7 : 6} className="bg-red-50 px-4 py-4">
                    <p className="text-sm text-red-600">{job.errorDetails.message || 'Unknown error'}</p>
                  </td>
                </tr>
              );
            }
            return rows;
          })}
        </tbody>
      </table>
    </div>
  );
}
