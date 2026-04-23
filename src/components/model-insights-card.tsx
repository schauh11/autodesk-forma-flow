'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatFileSize, getRelativeTime, getHealthLabel } from '@/lib/format-utils';
import { ChevronRight, RefreshCw, Circle } from 'lucide-react';
import { useState } from 'react';

type ModelInsight = {
  fileSize: number;
  totalElements?: number;
  familyCount: number;
  revitLinkCount: number;
  cadLinkCount: number;
  inPlaceCount: number;
  healthScore: number;
  fetchedAt: string;
  details?: Record<string, unknown>;
};

type ModelInsightsCardProps = {
  insights: ModelInsight | null;
  loading?: boolean;
  onViewDetails?: () => void;
  projectId?: string;
  onRefresh?: () => void;
  publishStats?: Record<string, unknown>;
};

function getAnomalies(data: ModelInsight): string[] {
  const anomalies: string[] = [];
  const sizeMB = data.fileSize / (1024 * 1024);

  if (sizeMB > 300) anomalies.push(`Large file (${sizeMB.toFixed(0)} MB)`);
  if (data.inPlaceCount > 0) anomalies.push(`${data.inPlaceCount} in-place components`);
  if (data.revitLinkCount > 0) anomalies.push(`${data.revitLinkCount} Revit links`);
  if (data.healthScore < 60) anomalies.push('Poor health score');

  return anomalies;
}

function getHealthColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-900';
  if (score >= 60) return 'bg-amber-100 text-amber-900';
  return 'bg-red-100 text-red-900';
}

export function ModelInsightsCard({
  insights,
  loading,
  onViewDetails,
  projectId,
  onRefresh,
  publishStats
}: ModelInsightsCardProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!projectId) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch(`/api/insights/${projectId}`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed to analyze model' }));
        setAnalyzeError(body.error || `Error: ${res.status}`);
        return;
      }
      onRefresh?.();
    } catch {
      setAnalyzeError('Failed to connect to server');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="border-all-subtle bg-white shadow-sm animate-pulse">
        <div className="p-4 space-y-3">
          <div className="h-6 w-40 bg-slate-200 rounded" />
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-16 bg-slate-200 rounded" />
                <div className="h-6 w-20 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
          <div className="h-4 w-32 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="border-all-subtle bg-white shadow-sm p-4 space-y-3">
        <p className="text-sm text-slate-500">No model insights yet.</p>
        {projectId && (
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={handleAnalyze} disabled={analyzing}>
              {analyzing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> Analyzing...
                </>
              ) : (
                'Analyze Published Model'
              )}
            </Button>
            {analyzeError && <span className="text-xs text-red-600">{analyzeError}</span>}
          </div>
        )}
      </div>
    );
  }

  const worksetCount = insights.details && insights.details['userWorksets']
    ? Object.keys((insights.details['userWorksets'] as Record<string, unknown>) || {}).length
    : 0;
  const linkCount = insights.revitLinkCount + insights.cadLinkCount;
  const anomalies = getAnomalies(insights);
  const healthColor = getHealthColor(insights.healthScore);

  // Indicator dots for unusual values
  const hasLargeFile = insights.fileSize > 300 * 1024 * 1024;
  const hasManyLinks = linkCount > 10;
  const hasInPlace = insights.inPlaceCount > 0;
  const hasPoorHealth = insights.healthScore < 60;

  return (
    <div className="border-all-subtle bg-white shadow-sm">
      {/* Data source notice */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
        <span className="text-[11px] text-slate-400">Insights based on the published model on Autodesk Construction Cloud</span>
      </div>

      {/* Layer 1: KPI Strip */}
      <div className="p-4 border-b-subtle">
        <h4 className="text-base font-semibold text-slate-800 mb-4">Model Insights</h4>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {/* File Size */}
          <div className="relative">
            {hasLargeFile && (
              <Circle className="absolute -top-1.5 -right-1.5 w-2 h-2 fill-amber-400 text-amber-400" />
            )}
            <span className="text-xs uppercase font-medium text-slate-500">File Size</span>
            <p className="text-lg font-mono font-bold text-slate-900 mt-1">
              {formatFileSize(insights.fileSize)}
            </p>
          </div>

          {/* Elements */}
          <div>
            <span className="text-xs uppercase font-medium text-slate-500">Elements</span>
            <p className="text-lg font-mono font-bold text-slate-900 mt-1">
              {insights.totalElements?.toLocaleString() || 'N/A'}
            </p>
          </div>

          {/* Families */}
          <div>
            <span className="text-xs uppercase font-medium text-slate-500">Families</span>
            <p className="text-lg font-mono font-bold text-slate-900 mt-1">
              {insights.familyCount.toLocaleString()}
            </p>
          </div>

          {/* Worksets */}
          <div>
            <span className="text-xs uppercase font-medium text-slate-500">Worksets</span>
            <p className="text-lg font-mono font-bold text-slate-900 mt-1">
              {worksetCount.toLocaleString()}
            </p>
          </div>

          {/* Links */}
          <div className="relative">
            {hasManyLinks && (
              <Circle className="absolute -top-1.5 -right-1.5 w-2 h-2 fill-amber-400 text-amber-400" />
            )}
            <span className="text-xs uppercase font-medium text-slate-500">Links</span>
            <p className="text-lg font-mono font-bold text-slate-900 mt-1">{linkCount}</p>
          </div>

          {/* Health */}
          <div className="relative">
            {hasPoorHealth && (
              <Circle className="absolute -top-1.5 -right-1.5 w-2 h-2 fill-red-500 text-red-500" />
            )}
            <span className="text-xs uppercase font-medium text-slate-500">Health</span>
            <div className={`${healthColor} px-2 py-1 rounded font-mono font-bold text-sm mt-1 text-center`}>
              {insights.healthScore}/100
            </div>
          </div>
        </div>
      </div>

      {/* Layer 2: Anomaly Bullets (only if issues exist) */}
      {anomalies.length > 0 && (
        <div className="px-4 py-3 bg-slate-50 border-b-subtle flex flex-wrap gap-2">
          {anomalies.map((anomaly, idx) => (
            <div
              key={idx}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                anomaly.includes('Poor health') || anomaly.includes('in-place')
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              <Circle className="w-1.5 h-1.5 fill-current" />
              {anomaly}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 border-t-subtle flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {projectId && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleAnalyze}
              disabled={analyzing}
              aria-label="Re-analyze model"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
              {analyzing ? 'Analyzing...' : 'Re-analyze'}
            </Button>
          )}
          <Button size="sm" onClick={onViewDetails} aria-label="View model insights details">
            View Details
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
        <span className="text-xs text-slate-500 font-mono">Analyzed {getRelativeTime(insights.fetchedAt)}</span>
        {analyzeError && <span className="text-xs text-red-600">{analyzeError}</span>}
      </div>
    </div>
  );
}
