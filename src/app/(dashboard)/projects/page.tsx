'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { ProjectCard } from '@/components/project-card';
import { CardSkeleton } from '@/components/skeleton';
import { HubProjectPicker } from '@/components/hub-project-picker';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

type Project = {
  id: string;
  projectName: string | null;
  hubId: string | null;
  createdAt: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingProject, setAddingProject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  const addProjectDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAddModal) return;
    const el = addProjectDialogRef.current;
    el?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAddModal(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showAddModal]);

  const fetchProjects = () => {
    setError(null);
    Promise.all([
      fetch('/api/projects').then((r) => { if (!r.ok) throw new Error(`Projects: ${r.status}`); return r.json(); }),
      fetch('/api/tasks').then((r) => { if (!r.ok) throw new Error(`Tasks: ${r.status}`); return r.json(); }),
    ])
      .then(([projectsData, tasksData]) => {
        setProjects(Array.isArray(projectsData) ? projectsData : []);
        const counts: Record<string, number> = {};
        const taskList = Array.isArray(tasksData) ? tasksData : [];
        for (const task of taskList) {
          counts[task.projectId] = (counts[task.projectId] || 0) + 1;
        }
        setTaskCounts(counts);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load projects');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleAddProject = async (hubId: string, projectId: string, projectName: string) => {
    setAddingProject(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hubId,
          apsProjectId: projectId,
          projectName,
        }),
      });
      if (res.ok) {
        showToast(`Added project: ${projectName}`, 'success');
        setShowAddModal(false);
        fetchProjects();
      } else {
        showToast('Failed to add project', 'error');
      }
    } catch (err) {
      showToast('Failed to add project', 'error');
    } finally {
      setAddingProject(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold text-slate-800">Projects</h1>
        <div className="mt-6 grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b-subtle p-6 bg-white">
        <h1 className="text-2xl font-semibold text-slate-800">Projects</h1>
      </div>

      <div className="p-8">
        {error && (
          <div className="mb-6 border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-600">{error}</p>
            <button onClick={fetchProjects} className="mt-2 text-sm text-red-700 underline">Retry</button>
          </div>
        )}
        <div className="flex items-center justify-between mb-8">
          <div></div>
          <Button
            onClick={() => setShowAddModal(true)}
            variant="default"
            disabled={addingProject}
          >
            <Plus size={16} />
            Add Project
          </Button>
        </div>

        {showAddModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
            role="presentation"
            aria-hidden
            onClick={() => setShowAddModal(false)}
          >
            <div
              ref={addProjectDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-project-dialog-title"
              tabIndex={-1}
              className="border-all-subtle bg-white p-6 max-w-md w-full mx-4 outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="add-project-dialog-title" className="sr-only">
                Add a project
              </h2>
              <HubProjectPicker
                onSelect={handleAddProject}
                onCancel={() => setShowAddModal(false)}
              />
            </div>
          </div>
        )}
        {projects.length === 0 ? (
          <div className="border-all-subtle border-dashed border-slate-300 rounded-xl p-12 text-center">
            <p className="text-lg font-medium text-slate-600">No projects yet</p>
            <p className="mt-2 text-sm text-slate-500">
              Connect your Autodesk account in{' '}
              <Link href="/settings" className="text-blue-600 hover:text-blue-700 underline underline-offset-2">
                Settings
              </Link>{' '}
              to start automating BIM workflows.
            </p>
            <Button onClick={() => setShowAddModal(true)} variant="primary" className="mt-4">
              <Plus size={16} />
              Add Your First Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                id={project.id}
                projectName={project.projectName}
                hubId={project.hubId}
                taskCount={taskCounts[project.id] || 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
