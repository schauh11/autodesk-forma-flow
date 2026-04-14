'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { JobHistoryTable } from '@/components/job-history-table';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCron } from '@/lib/format-cron';
import { TASK_TYPE_SHORT } from '@/lib/constants';
import { useTaskActions } from '@/hooks/use-task-actions';

type Project = { id: string; projectName: string | null };

type Task = {
  id: string;
  name: string;
  taskType: string;
  scheduleCron: string | null;
  scheduleIsActive: boolean | null;
  targetModelName: string | null;
  projectId: string;
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

const PAGE_SIZE = 20;

export default function ActivityPage() {
  const { showToast } = useToast();

  // Projects (for name lookup)
  const [projects, setProjects] = useState<Project[]>([]);

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  // Jobs state
  const [jobs, setJobs] = useState<JobResult[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [jobStatusFilter, setJobStatusFilter] = useState('');
  const [jobProjectFilter, setJobProjectFilter] = useState('');
  const [hasMore, setHasMore] = useState(false);

  const fetchTasks = useCallback(() => {
    setTasksLoading(true);
    fetch('/api/tasks')
      .then((res) => res.json())
      .then((data) => setTasks(Array.isArray(data) ? data : []))
      .finally(() => setTasksLoading(false));
  }, []);

  const { runNow, togglePause, deleteTask } = useTaskActions({
    showToast,
    onSuccess: fetchTasks,
  });

  // Project name lookup map
  const projectNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of projects) {
      if (p.projectName) map[p.id] = p.projectName;
    }
    return map;
  }, [projects]);

  // Fetch projects + tasks on mount
  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => setProjects(Array.isArray(data) ? data : []));
    fetchTasks();
  }, [fetchTasks]);

  // Fetch jobs on filter/page change
  useEffect(() => {
    setJobsLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (jobStatusFilter) params.set('status', jobStatusFilter);
    if (jobProjectFilter) params.set('projectId', jobProjectFilter);

    fetch(`/api/jobs?${params}`)
      .then((res) => res.json())
      .then((data: { data?: JobResult[]; hasMore?: boolean }) => {
        const jobList = data.data || [];
        setJobs(jobList);
        setHasMore(Boolean(data.hasMore));
      })
      .finally(() => setJobsLoading(false));
  }, [page, jobStatusFilter, jobProjectFilter]);

  const filteredTasks = tasks.filter((task) => {
    if (statusFilter === 'active' && !task.scheduleIsActive) return false;
    if (statusFilter === 'paused' && task.scheduleIsActive) return false;
    return true;
  });

  const resetJobFilters = () => {
    setJobStatusFilter('');
    setJobProjectFilter('');
    setPage(1);
  };

  return (
    <div>
      {/* Header */}
      <div className="border-b-subtle p-6">
        <h1 className="text-2xl font-semibold text-slate-800">Activity</h1>
      </div>

      <div className="p-6 space-y-10">
        {/* ── Tasks Section ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-700">
              Tasks
              {!tasksLoading && (
                <span className="ml-2 font-normal text-slate-600">
                  {filteredTasks.length}{statusFilter ? ` of ${tasks.length}` : ''}
                </span>
              )}
            </h2>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="min-h-9 text-sm px-3 py-2"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>

          {tasksLoading ? (
            <p className="text-sm text-slate-500">Loading tasks...</p>
          ) : filteredTasks.length === 0 ? (
            <div className="border border-dashed border-slate-200 p-8 text-center">
              <p className="text-sm text-slate-500">
                {tasks.length === 0
                  ? 'No tasks yet. Create one from a project page.'
                  : 'No tasks match the current filters.'}
              </p>
            </div>
          ) : (
            <div className="border-all-subtle bg-white overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs text-slate-600 uppercase">Task</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-600 uppercase">Project</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-600 uppercase hidden md:table-cell">Type</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-600 uppercase hidden lg:table-cell">Schedule</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs text-slate-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => (
                    <tr key={task.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-800">{task.name}</div>
                        {task.targetModelName && (
                          <div className="text-xs text-slate-500 mt-0.5">{task.targetModelName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {projectNameMap[task.projectId] || 'Unknown project'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge variant="neutral">
                          {TASK_TYPE_SHORT[task.taskType] ?? task.taskType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 hidden lg:table-cell">
                        {task.scheduleCron ? formatCron(task.scheduleCron) : 'Manual'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={task.scheduleIsActive ? 'info' : 'neutral'}>
                          {task.scheduleIsActive ? 'Active' : 'Paused'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            onClick={() => runNow(task.id)}
                            variant="default"
                            size="sm"
                            title="Run Now"
                          >
                            Run
                          </Button>
                          <Button
                            onClick={() => togglePause(task.id, !task.scheduleIsActive)}
                            variant="default"
                            size="sm"
                            title={task.scheduleIsActive ? 'Pause' : 'Resume'}
                          >
                            {task.scheduleIsActive ? 'Pause' : 'Resume'}
                          </Button>
                          <Button
                            onClick={() => deleteTask(task.id)}
                            variant="danger"
                            size="sm"
                            title="Delete"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Job History Section ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-700">Job History</h2>
            <div className="flex gap-2">
              <select
                value={jobProjectFilter}
                onChange={(e) => { setJobProjectFilter(e.target.value); setPage(1); }}
                className="min-h-9 text-sm px-3 py-2"
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectName || 'Unnamed'}
                  </option>
                ))}
              </select>
              <select
                value={jobStatusFilter}
                onChange={(e) => { setJobStatusFilter(e.target.value); setPage(1); }}
                className="min-h-9 text-sm px-3 py-2"
              >
                <option value="">All Statuses</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
                <option value="RUNNING">Running</option>
                <option value="PENDING">Pending</option>
              </select>
              {(jobStatusFilter || jobProjectFilter) && (
                <Button onClick={resetJobFilters} variant="ghost" size="sm">
                  Clear
                </Button>
              )}
            </div>
          </div>

          {jobsLoading ? (
            <p className="text-sm text-slate-500">Loading jobs...</p>
          ) : (
            <JobHistoryTable jobs={jobs} />
          )}

          {jobs.length > 0 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                variant="ghost"
                size="sm"
              >
                Previous
              </Button>
              <span className="px-3 py-1.5 text-xs text-slate-600">Page {page}</span>
              <Button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore}
                variant="ghost"
                size="sm"
              >
                Next
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
