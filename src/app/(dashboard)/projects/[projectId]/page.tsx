'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { TaskCard } from '@/components/task-card';
import { TaskForm } from '@/components/task-form';
import { JobHistoryTable } from '@/components/job-history-table';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { TaskCardSkeleton, CardSkeleton, Skeleton } from '@/components/skeleton';
import { useTaskActions } from '@/hooks/use-task-actions';

type Project = {
  id: string;
  projectName: string | null;
  hubId: string | null;
  apsProjectId: string | null;
};

type Task = {
  id: string;
  name: string;
  taskType: string;
  scheduleCron: string | null;
  scheduleIsActive: boolean | null;
  targetModelId: string | null;
  targetModelName: string | null;
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

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { showToast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [jobs, setJobs] = useState<JobResult[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingSchedulers, setMissingSchedulers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const abortController = new AbortController();

    const fetchData = async () => {
      try {
        const [projectRes, tasksRes, jobsRes] = await Promise.all([
          fetch(`/api/projects/${projectId}`, { signal: abortController.signal }),
          fetch(`/api/tasks?projectId=${projectId}`, { signal: abortController.signal }),
          fetch(`/api/jobs?projectId=${projectId}`, { signal: abortController.signal }),
        ]);

        if (!abortController.signal.aborted) {
          if (projectRes.ok) setProject(await projectRes.json());
          else console.error('Failed to fetch project:', projectRes.statusText);

          if (tasksRes.ok) setTasks(await tasksRes.json());
          else console.error('Failed to fetch tasks:', tasksRes.statusText);

          if (jobsRes.ok) {
            const data = await jobsRes.json();
            setJobs(data.data || []);
          } else console.error('Failed to fetch jobs:', jobsRes.statusText);

          setLoading(false);

          // 2-way sync: check which scheduled tasks exist in Windows Task Scheduler
          fetch(`/api/tasks/sync?projectId=${projectId}`, { signal: abortController.signal })
            .then((r) => r.ok ? r.json() : [])
            .then((syncData: { taskId: string; schedulerExists: boolean }[]) => {
              const missing = new Set<string>();
              for (const item of syncData) {
                if (!item.schedulerExists) missing.add(item.taskId);
              }
              setMissingSchedulers(missing);
            })
            .catch(() => {}); // Non-critical, don't block UI
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Error fetching data:', error);
          setError(error.message || 'Failed to load project data');
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => abortController.abort();
  }, [projectId]);

  const refreshData = async () => {
    setLoading(true);
    setError(null);
    const abortController = new AbortController();

    try {
      const [projectRes, tasksRes, jobsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`, { signal: abortController.signal }),
        fetch(`/api/tasks?projectId=${projectId}`, { signal: abortController.signal }),
        fetch(`/api/jobs?projectId=${projectId}`, { signal: abortController.signal }),
      ]);

      if (!abortController.signal.aborted) {
        if (projectRes.ok) setProject(await projectRes.json());
        if (tasksRes.ok) setTasks(await tasksRes.json());
        if (jobsRes.ok) {
          const data = await jobsRes.json();
          setJobs(data.data || []);
        }
        setLoading(false);
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        console.error('Error refreshing data:', err);
        setError(err instanceof Error ? err.message : 'Failed to refresh');
        setLoading(false);
      }
    }
  };

  const { runNow, togglePause, deleteTask } = useTaskActions({
    showToast,
    onSuccess: refreshData,
  });

  const handleCreateTask = async (data: {
    projectId: string;
    name: string;
    taskType: 'PUBLISH_MODEL';
    targetModelId?: string;
    targetModelName?: string;
    scheduleCron?: string;
  }) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        showToast('Task created');
        setShowForm(false);
        await refreshData();
      } else {
        let msg = 'Failed to create task';
        try { const body = await res.json(); msg = body.error || msg; } catch { /* non-JSON */ }
        showToast(msg, 'error');
      }
    } catch (err) {
      console.error('Error creating task:', err);
      showToast('Failed to create task', 'error');
    }
  };

  const handleEditTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setEditingTask(task);
      setShowForm(false); // close create form if open
    }
  };

  const handleUpdateTask = async (data: {
    projectId: string;
    name: string;
    taskType: 'PUBLISH_MODEL';
    targetModelId?: string;
    targetModelName?: string;
    scheduleCron?: string;
  }) => {
    if (!editingTask) return;
    try {
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          targetModelId: data.targetModelId,
          targetModelName: data.targetModelName,
          scheduleCron: data.scheduleCron,
        }),
      });
      if (res.ok) {
        showToast('Task updated');
        setEditingTask(null);
        await refreshData();
      } else {
        let msg = 'Failed to update task';
        try { const body = await res.json(); msg = body.error || msg; } catch { /* non-JSON */ }
        showToast(msg, 'error');
      }
    } catch (err) {
      console.error('Error updating task:', err);
      showToast('Failed to update task', 'error');
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-8">
        <CardSkeleton />
        <div>
          <div className="mb-4"><Skeleton className="h-7 w-20" /></div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <TaskCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-600 font-semibold">Error loading project</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!project) {
    return <div className="p-8"><p className="text-red-600">Project not found</p></div>;
  }

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="border-b-subtle p-6 bg-white">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 mb-4 text-xs font-mono text-slate-500 hover:text-blue-600 hover:bg-slate-50 px-3 h-9 rounded-md transition-colors"
        >
          ← Back to Projects
        </Link>

        {/* Title */}
        <h1 className="text-2xl font-semibold text-slate-800">
          {project.projectName}
        </h1>

      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row">
        {/* Left column: Tasks */}
        <div className="w-full lg:w-1/2 lg:border-r-subtle p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-slate-700">Tasks</h2>
            <Button
              onClick={() => setShowForm(!showForm)}
              variant={showForm ? 'ghost' : 'default'}
            >
              {showForm ? 'Cancel' : '+ New Task'}
            </Button>
          </div>

          {showForm && (
            <div className="border-all-subtle bg-slate-50 p-6 relative overflow-hidden mb-6">
              <TaskForm
                projectId={projectId}
                onSubmit={handleCreateTask}
                onCancel={() => setShowForm(false)}
              />
            </div>
          )}

          {editingTask && (
            <div className="border border-blue-200 bg-blue-50/30 p-6 relative overflow-hidden mb-6 rounded-sm">
              <h3 className="text-xs font-mono text-blue-700 mb-4">Editing: {editingTask.name}</h3>
              <TaskForm
                projectId={projectId}
                onSubmit={handleUpdateTask}
                onCancel={() => setEditingTask(null)}
                isEditing
                initialValues={{
                  name: editingTask.name,
                  targetModelId: editingTask.targetModelId,
                  targetModelName: editingTask.targetModelName,
                  scheduleCron: editingTask.scheduleCron,
                }}
              />
            </div>
          )}

          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                id={task.id}
                name={task.name}
                taskType={task.taskType}
                scheduleCron={task.scheduleCron}
                scheduleIsActive={task.scheduleIsActive}
                targetModelName={task.targetModelName}
                schedulerMissing={missingSchedulers.has(task.id)}
                onRunNow={runNow}
                onTogglePause={togglePause}
                onDelete={deleteTask}
                onEdit={handleEditTask}
              />
            ))}
            {tasks.length === 0 && !showForm && (
              <p className="text-xs text-slate-500">No tasks yet. Create one to get started.</p>
            )}
          </div>
        </div>

        {/* Right column: Job History */}
        <div className="w-full lg:w-1/2 bg-slate-50/50 p-8">
          <h2 className="text-base font-semibold text-slate-700 mb-6">Job History</h2>
          <JobHistoryTable jobs={jobs} showProjectColumn={false} />
        </div>
      </div>
    </div>
  );
}
