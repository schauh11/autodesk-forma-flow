'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

type AccItem = {
  id: string;
  type: 'folders' | 'items';
  attributes: {
    name?: string;
    displayName?: string;
    extension?: { type: string };
  };
};

type AccFolderBrowserProps = {
  projectId: string;
  onSelect: (itemId: string, itemName: string) => void;
  onCancel: () => void;
};

export function AccFolderBrowser({ projectId, onSelect, onCancel }: AccFolderBrowserProps) {
  const [items, setItems] = useState<AccItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'Root' },
  ]);

  const fetchTopFolders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/acc/${projectId}/folders`);
      if (!res.ok) throw new Error('Failed to load folders');
      const data = await res.json();
      setItems(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const fetchFolderContents = async (folderId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/acc/${projectId}/folders/${folderId}/contents`);
      if (!res.ok) throw new Error('Failed to load folder contents');
      const data = await res.json();
      setItems(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  // Load top folders on first render
  useEffect(() => {
    fetchTopFolders();
  }, []);

  const handleItemClick = (item: AccItem) => {
    if (loading) return; // Prevent navigation while loading
    if (item.type === 'folders') {
      const name = item.attributes.displayName || item.attributes.name || 'Folder';
      setBreadcrumbs((prev) => [...prev, { id: item.id, name }]);
      fetchFolderContents(item.id);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    const crumb = breadcrumbs[index];
    if (!crumb) return;
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    if (crumb.id === null) {
      fetchTopFolders();
    } else {
      fetchFolderContents(crumb.id);
    }
  };

  const getItemName = (item: AccItem) =>
    item.attributes.displayName || item.attributes.name || item.id;

  const isRevitModel = (item: AccItem) =>
    item.type === 'items' && (
      getItemName(item).endsWith('.rvt') ||
      item.attributes.extension?.type === 'items:autodesk.bim360:File'
    );

  return (
    <div className="border-all-subtle border border-slate-200 bg-white">
      {/* Breadcrumbs */}
      <div className="border-b-subtle px-4 py-3 text-sm flex items-center gap-1">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-400">/</span>}
            <button
              onClick={() => handleBreadcrumbClick(i)}
              className="text-blue-600 hover:text-blue-800 font-mono text-xs"
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </div>

      {/* Content */}
      <div className="max-h-64 overflow-y-auto">
        {loading && (
          <div className="p-6 text-center text-xs font-mono text-slate-600">Loading...</div>
        )}
        {error && (
          <div className="p-6 text-center text-xs font-mono text-red-600">{error}</div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="p-6 text-center text-xs font-mono text-slate-600">No items found</div>
        )}
        {!loading && !error && items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between border-b-subtle px-4 py-3 last:border-b-0 hover:bg-slate-50"
          >
            <button
              onClick={() => handleItemClick(item)}
              className="flex items-center gap-3 text-left text-sm"
              disabled={item.type === 'items'}
            >
              {/* Icon */}
              <span className="text-lg">
                {item.type === 'folders' ? '📁' : '📄'}
              </span>
              <span className={item.type === 'folders' ? 'text-slate-800 hover:text-blue-600' : 'text-slate-600'}>
                {getItemName(item)}
              </span>
            </button>
            {isRevitModel(item) && (
              <Button
                onClick={() => onSelect(item.id, getItemName(item))}
                variant="primary"
                size="sm"
              >
                Select
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t-subtle px-4 py-3 flex justify-end">
        <Button onClick={onCancel} variant="ghost">
          Cancel
        </Button>
      </div>
    </div>
  );
}
