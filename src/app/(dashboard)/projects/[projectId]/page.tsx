'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { TaskCard } from '@/components/task-card';
import { TaskForm } from '@/components/task-form';
import { JobHistoryTable } from '@/components/job-history-table';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TaskCardSkeleton, CardSkeleton, Skeleton } from '@/components/skeleton';
import { useTaskActions } from '@/hooks/use-task-actions';
import { ModelInsightsCard } from '@/components/model-insights-card';
import { ModelInsightsDelta } from '@/components/model-insights-delta';
import { TopNCard } from '@/components/top-n-card';
import { HealthBreakdown as HealthBreakdownComponent } from '@/components/health-breakdown';
import { ModelNarrative } from '@/components/model-narrative';
import { computeHealthBreakdown } from '@/lib/health-score';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [insights, setInsights] = useState<any>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [showInsightsDetail, setShowInsightsDetail] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [insightsPrevious, setInsightsPrevious] = useState<any>(null);

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

          // Fetch model insights (non-blocking)
          fetch(`/api/insights/${projectId}`, { signal: abortController.signal })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (data && !data.error) {
                setInsights(data);
                setInsightsPrevious(data.previous || null);
              }
            })
            .catch(() => {})
            .finally(() => setInsightsLoading(false));

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

      {/* Model Insights */}
      <div className="p-6 border-b-subtle">
        <ModelInsightsCard
          insights={insights}
          loading={insightsLoading}
          projectId={projectId}
          onViewDetails={() => setShowInsightsDetail(!showInsightsDetail)}
          onRefresh={() => {
            setInsightsLoading(true);
            fetch(`/api/insights/${projectId}`)
              .then(r => r.ok ? r.json() : null)
              .then(data => { if (data && !data.error) setInsights(data); })
              .catch(() => {})
              .finally(() => setInsightsLoading(false));
          }}
        />

        {/* Narrative summary */}
        {insights && (
          <div className="mt-3">
            <ModelNarrative insights={insights} previous={insightsPrevious} />
          </div>
        )}

        {/* Delta card: what changed since last analysis */}
        {insights && insightsPrevious && (
          <div className="mt-2">
            <ModelInsightsDelta current={insights} previous={insightsPrevious} />
          </div>
        )}

        {/* Expanded detail panel */}
        {showInsightsDetail && insights?.details && (
          <div className="mt-4 border-all-subtle bg-slate-50/50 p-5 space-y-5">
            {/* Health Report Card */}
            <HealthBreakdownComponent breakdown={computeHealthBreakdown(insights)} />

            {/* Empty state: only show when ALL detail data is empty */}
            {(!insights.details.families || Object.keys(insights.details.families).length === 0) &&
             (!insights.details.userWorksets || Object.keys(insights.details.userWorksets as Record<string, unknown>).length === 0) &&
             (!insights.details.levels || (insights.details.levels as string[]).length === 0) &&
             (!insights.details.revitLinks || (insights.details.revitLinks as string[]).length === 0) && (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500">No detail data in this snapshot.</p>
                <p className="text-xs text-slate-400 mt-1">Click "Re-analyze" to pull fresh data.</p>
              </div>
            )}

            {/* Row 1: Top-N Grid (2x2) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Top 5 Categories */}
              {insights.details.families && Object.keys(insights.details.families).length > 0 && (
                <TopNCard
                  title="Top Categories"
                  data={Object.entries(insights.details.families as Record<string, Record<string, number>>)
                    .map(([cat, types]) => ({
                      name: cat,
                      value: Object.values(types).reduce((s, n) => s + (n as number), 0),
                    }))
                    .sort((a, b) => b.value - a.value)}
                  maxItems={5}
                />
              )}

              {/* Card 2: Top 10 Family Types (across ALL categories) */}
              {insights.details.families && Object.keys(insights.details.families).length > 0 && (
                <TopNCard
                  title="Top Family Types"
                  data={(() => {
                    const allFamilyTypes: Array<{ name: string; value: number }> = [];
                    for (const [cat, types] of Object.entries(insights.details.families as Record<string, Record<string, number>>)) {
                      for (const [name, count] of Object.entries(types)) {
                        allFamilyTypes.push({ name, value: count as number });
                      }
                    }
                    return allFamilyTypes.sort((a, b) => b.value - a.value);
                  })()}
                  maxItems={10}
                  barColor="#10b981"
                />
              )}

              {/* Card 3: Top 5 Worksets */}
              {insights.details.userWorksets && Object.keys(insights.details.userWorksets).length > 0 && (
                <TopNCard
                  title="Top Worksets"
                  data={Object.entries(insights.details.userWorksets as Record<string, number>)
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)}
                  maxItems={5}
                  barColor="#f59e0b"
                />
              )}

              {/* Card 4: Links (only if any links exist) */}
              {(() => {
                const linkData = [
                  ...(insights.details.revitLinks || []).map((l: string) => ({ name: l, type: 'RVT' as const })),
                  ...(insights.details.cadLinks || []).map((l: string) => ({ name: l, type: 'CAD' as const })),
                ];
                if (linkData.length > 0) {
                  return (
                    <div className="border-all-subtle bg-white p-4 shadow-sm">
                      <h5 className="text-sm font-semibold text-slate-700 mb-3">Linked Files ({linkData.length})</h5>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {(insights.details.revitLinks || []).map((l: string, i: number) => (
                          <div key={`rvt-${i}`} className="flex items-center gap-2 py-1">
                            <Badge variant="info">RVT</Badge>
                            <span className="text-xs font-mono text-slate-700 truncate">{l}</span>
                          </div>
                        ))}
                        {(insights.details.cadLinks || []).map((l: string, i: number) => (
                          <div key={`cad-${i}`} className="flex items-center gap-2 py-1">
                            <Badge variant="neutral">CAD</Badge>
                            <span className="text-xs font-mono text-slate-700 truncate">{l}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Row 2: Levels + In-Place warnings */}
            {insights.details.levels?.length > 0 && (
              <div>
                <h5 className="text-sm font-semibold text-slate-700 mb-2">Levels ({[...new Set(insights.details.levels as string[])].length})</h5>
                <div className="flex flex-wrap gap-1.5">
                  {[...new Set(insights.details.levels as string[])].map((l: string, i: number) => (
                    <span key={i} className="text-xs font-mono bg-white border border-slate-200 px-2 py-1">{l}</span>
                  ))}
                </div>
              </div>
            )}

            {/* In-place components warning */}
            {insights.details.inPlaceComponents?.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200">
                <h5 className="text-sm font-semibold text-amber-900 mb-1">In-Place Components ({insights.inPlaceCount})</h5>
                <p className="text-xs text-amber-800 mb-2">In-place components reduce model performance. Consider converting to loadable families.</p>
                {(insights.details.inPlaceComponents as string[]).map((c: string, i: number) => (
                  <p key={i} className="text-xs font-mono text-amber-700">{c}</p>
                ))}
              </div>
            )}

            {/* Row 3: Drill-down families accordion */}
            {insights.details.families && Object.keys(insights.details.families).length > 0 && (
              <div>
                <h5 className="text-sm font-semibold text-slate-700 mb-3">Families by Category ({insights.familyCount})</h5>
                <div className="space-y-2">
                  {Object.entries(insights.details.families as Record<string, Record<string, number>>)
                    .sort(([, a], [, b]) => {
                      const totalA = Object.values(a).reduce((s, n) => s + (n as number), 0);
                      const totalB = Object.values(b).reduce((s, n) => s + (n as number), 0);
                      return totalB - totalA;
                    })
                    .map(([category, familyCounts]) => {
                      const totalInCategory = Object.values(familyCounts).reduce((s, n) => s + (n as number), 0);
                      const sorted = Object.entries(familyCounts).sort(([, a], [, b]) => (b as number) - (a as number));
                      const typeCount = sorted.length;
                      return (
                        <details key={category} className="bg-white border border-slate-200">
                          <summary className="px-3 py-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50">
                            <span className="font-medium">{category}</span>
                            <span className="text-slate-500 ml-2">({typeCount} types, {totalInCategory.toLocaleString()} elements)</span>
                          </summary>
                          <div className="border-t border-slate-100">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/50">
                                  <th className="text-left px-3 py-1.5 text-slate-500 font-medium">Family / Type</th>
                                  <th className="text-right px-3 py-1.5 text-slate-500 font-medium">Count</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sorted.slice(0, 10).map(([famName, count]) => (
                                  <tr key={famName} className="border-b border-slate-50">
                                    <td className="px-3 py-1 font-mono text-slate-700">{famName}</td>
                                    <td className="px-3 py-1 font-mono text-slate-600 text-right">
                                      {(count as number).toLocaleString()}
                                      {(count as number) === 1 && <span className="text-amber-500 ml-1.5 text-[10px] font-sans">single</span>}
                                    </td>
                                  </tr>
                                ))}
                                {typeCount > 10 && (
                                  <tr>
                                    <td colSpan={2} className="px-3 py-1.5 text-xs text-slate-500 italic">
                                      + {typeCount - 10} more types (open in Revit for full list)
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
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
