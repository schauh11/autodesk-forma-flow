'use client';

import { useEffect, useState, useMemo } from 'react';
import { Building2, FolderKanban, AlertCircle, Search, ArrowUpAZ, ArrowDownAZ } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Hub = {
  id: string;
  attributes: {
    name: string;
  };
};

type Project = {
  id: string;
  attributes: {
    name: string;
  };
};

type HubProjectPickerProps = {
  onSelect: (hubId: string, projectId: string, projectName: string) => void;
  onCancel: () => void;
};

export function HubProjectPicker({ onSelect, onCancel }: HubProjectPickerProps) {
  const [step, setStep] = useState<'hubs' | 'projects'>('hubs');
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedHub, setSelectedHub] = useState<Hub | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

  const filteredProjects = useMemo(() => {
    let filtered = projects;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((p) => p.attributes.name.toLowerCase().includes(q));
    }
    return [...filtered].sort((a, b) => {
      const cmp = a.attributes.name.localeCompare(b.attributes.name);
      return sortAsc ? cmp : -cmp;
    });
  }, [projects, search, sortAsc]);

  useEffect(() => {
    fetchHubs();
  }, []);

  const fetchHubs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/hubs');
      if (!response.ok) {
        if (response.status === 400) {
          setError('Credentials not configured. Please set up your APS credentials in settings.');
        } else {
          let detail = '';
          try { const body = await response.json(); detail = body.error || ''; } catch { /* non-JSON */ }
          setError(detail || `Failed to fetch hubs: ${response.status}`);
        }
        return;
      }
      const data = await response.json();
      setHubs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch hubs');
    } finally {
      setLoading(false);
    }
  };

  const handleHubSelect = async (hub: Hub) => {
    setSelectedHub(hub);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/hubs/${hub.id}/projects`);
      if (!response.ok) {
        let detail = '';
        try { const body = await response.json(); detail = body.error || ''; } catch { /* non-JSON */ }
        setError(detail || `Failed to fetch projects: ${response.status}`);
        return;
      }
      const data = await response.json();
      setProjects(Array.isArray(data) ? data : []);
      setStep('projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = (project: Project) => {
    if (selectedHub) {
      onSelect(
        selectedHub.id,
        project.id,
        project.attributes.name
      );
    }
  };

  return (
    <div className="w-full max-w-md">
      {step === 'hubs' ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-light uppercase tracking-wider text-slate-800">Select a Hub</h2>
            <p className="mt-1 text-xs text-slate-600">
              Choose the Autodesk hub containing your project
            </p>
          </div>

          {error && (
            <div className="border border-red-200 bg-red-50 p-3 flex gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-600">{error}</p>
                {error.includes('Credentials') && (
                  <a
                    href="/settings"
                    className="mt-2 inline-block text-sm font-medium text-red-600 hover:text-red-800"
                  >
                    Go to settings →
                  </a>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-slate-200 animate-pulse" />
              ))}
            </div>
          ) : hubs.length === 0 ? (
            <div className="border-all-subtle p-4 text-center">
              <p className="text-sm text-slate-600">No hubs found</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {hubs.map((hub) => (
                <button
                  key={hub.id}
                  onClick={() => handleHubSelect(hub)}
                  className="w-full border-all-subtle border border-slate-200 bg-white p-3 text-left text-sm hover:bg-slate-50 hover:border-blue-300 transition-colors flex items-center gap-2"
                >
                  <Building2 className="h-4 w-4 text-slate-500 flex-shrink-0" />
                  <span className="font-medium text-slate-800 truncate">
                    {hub.attributes.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={onCancel}
              variant="ghost"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <button
              onClick={() => setStep('hubs')}
              className="text-xs font-mono text-blue-600 hover:text-blue-800 mb-2"
            >
              ← Back to hubs
            </button>
            <h2 className="text-lg font-light uppercase tracking-wider text-slate-800">
              Select a Project
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              {selectedHub && `From ${selectedHub.attributes.name}`}
            </p>
          </div>

          {error && (
            <div className="border border-red-200 bg-red-50 p-3 flex gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-slate-200 animate-pulse" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="border-all-subtle p-4 text-center">
              <p className="text-sm text-slate-600">No projects found</p>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search projects..."
                    className="w-full pl-9 pr-3"
                    autoFocus
                  />
                </div>
                <button
                  onClick={() => setSortAsc(!sortAsc)}
                  className="border-all-subtle border border-slate-200 p-2 text-slate-500 hover:text-blue-600 hover:border-blue-300"
                  aria-label={sortAsc ? 'Sort Z-A' : 'Sort A-Z'}
                  title={sortAsc ? 'Sort Z-A' : 'Sort A-Z'}
                >
                  {sortAsc ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
                </button>
              </div>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {filteredProjects.length === 0 ? (
                  <p className="py-3 text-center text-sm text-slate-600">No projects match "{search}"</p>
                ) : (
                  filteredProjects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleProjectSelect(project)}
                      className="w-full border-all-subtle border border-slate-200 bg-white p-3 text-left text-sm hover:bg-slate-50 hover:border-blue-300 transition-colors flex items-center gap-2"
                    >
                      <FolderKanban className="h-4 w-4 text-slate-500 flex-shrink-0" />
                      <span className="font-medium text-slate-800 truncate">
                        {project.attributes.name}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <p className="text-xs font-mono text-slate-600">{filteredProjects.length} of {projects.length} projects</p>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={onCancel}
              variant="ghost"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
