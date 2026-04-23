'use client';

import { formatFileSize } from '@/lib/format-utils';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

type DeltaProps = {
  current: { fileSize: number; familyCount: number; healthScore: number; levelCount: number; revitLinkCount: number; cadLinkCount: number };
  previous: { fileSize: number; familyCount: number; healthScore: number; levelCount: number; revitLinkCount: number; cadLinkCount: number } | null;
};

function DeltaItem({ label, current, prev, unit, invertColor }: {
  label: string;
  current: number;
  prev: number;
  unit?: string;
  invertColor?: boolean; // true = increase is bad (file size)
}) {
  const diff = current - prev;
  if (diff === 0) return null;

  const isUp = diff > 0;
  const isBad = invertColor ? isUp : !isUp;
  const color = isBad ? 'text-red-600' : 'text-emerald-600';
  const Icon = isUp ? ArrowUp : ArrowDown;
  const formatted = unit === 'bytes' ? formatFileSize(Math.abs(diff)) : Math.abs(diff).toLocaleString();

  return (
    <span className={`inline-flex items-center gap-0.5 ${color} text-xs font-mono`}>
      <Icon className="w-3 h-3" />
      {isUp ? '+' : '-'}{formatted}{unit && unit !== 'bytes' ? ` ${unit}` : ''}
      <span className="text-slate-500 font-sans ml-1">{label}</span>
    </span>
  );
}

export function ModelInsightsDelta({ current, previous }: DeltaProps) {
  if (!previous) {
    return (
      <div className="bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs text-slate-500">
        First analysis. Publish and re-analyze to see changes over time.
      </div>
    );
  }

  const deltas = [
    { label: 'file size', current: current.fileSize, prev: previous.fileSize, unit: 'bytes' as const, invertColor: true },
    { label: 'families', current: current.familyCount, prev: previous.familyCount },
    { label: 'health', current: current.healthScore, prev: previous.healthScore },
    { label: 'revit links', current: current.revitLinkCount, prev: previous.revitLinkCount },
    { label: 'CAD links', current: current.cadLinkCount, prev: previous.cadLinkCount },
  ];

  const hasChanges = deltas.some(d => d.current !== d.prev);

  if (!hasChanges) {
    return (
      <div className="bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs text-slate-500">
        No changes since last analysis.
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 px-4 py-2.5 flex flex-wrap gap-3">
      <span className="text-xs font-medium text-blue-700">Changed:</span>
      {deltas.map((d) => (
        <DeltaItem key={d.label} label={d.label} current={d.current} prev={d.prev} unit={d.unit} invertColor={d.invertColor} />
      ))}
    </div>
  );
}
