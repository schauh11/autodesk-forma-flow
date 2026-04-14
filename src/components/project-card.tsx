'use client';

import Link from 'next/link';
import { FolderOpen } from 'lucide-react';

type ProjectCardProps = {
  id: string;
  projectName: string | null;
  hubId: string | null;
  taskCount?: number;
  lastRunAt?: string | null;
};


export function ProjectCard({
  id,
  projectName,
  hubId,
  taskCount = 0,
  lastRunAt,
}: ProjectCardProps) {

  return (
    <Link href={`/projects/${id}`} className="border-all-subtle bg-white hover:shadow-md transition-all cursor-pointer group flex flex-col h-64 relative overflow-hidden rounded-lg">
      <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl opacity-10 transition-opacity group-hover:opacity-30 bg-blue-500"></div>

      <div className="p-6 flex-1 flex flex-col border-b-subtle relative z-10">
        <div className="flex justify-between items-start mb-6">
          <FolderOpen size={18} className="text-blue-600" />
        </div>
        <h3 className="text-xl tracking-wider uppercase mb-1 text-slate-800 truncate">
          {projectName || 'Unnamed Project'}
        </h3>
      </div>

      <div className="p-4 bg-slate-50 flex justify-between items-center font-mono text-xs relative z-10 border-t-subtle">
        <div className="text-slate-600">
          <span>{taskCount} task{taskCount !== 1 ? 's' : ''}</span>
          {lastRunAt && <span className="ml-3">Run: {new Date(lastRunAt).toLocaleDateString()}</span>}
        </div>
        <span className="text-blue-600 group-hover:text-blue-700 transition-colors">
          View details →
        </span>
      </div>
    </Link>
  );
}
