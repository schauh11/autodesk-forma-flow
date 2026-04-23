'use client';

import { formatFileSize } from '@/lib/format-utils';

type ModelNarrativeProps = {
  insights: {
    fileSize: number;
    totalElements?: number;
    familyCount: number;
    inPlaceCount: number;
    revitLinkCount: number;
    cadLinkCount: number;
    healthScore: number;
    details?: Record<string, unknown>;
  };
  previous?: {
    fileSize: number;
    totalElements?: number;
    familyCount: number;
  } | null;
};

function guessDiscipline(families: Record<string, Record<string, number>> | undefined): string {
  if (!families) return 'Model';
  const cats = Object.keys(families).map(c => c.toLowerCase());
  if (cats.some(c => c.includes('conduit') || c.includes('lighting') || c.includes('electrical'))) return 'Electrical model';
  if (cats.some(c => c.includes('wall') || c.includes('door') || c.includes('window') || c.includes('floor'))) return 'Architectural model';
  if (cats.some(c => c.includes('structural') || c.includes('framing') || c.includes('foundation'))) return 'Structural model';
  if (cats.some(c => c.includes('duct') || c.includes('pipe') || c.includes('mechanical'))) return 'Mechanical model';
  return 'Model';
}

export function ModelNarrative({ insights, previous }: ModelNarrativeProps) {
  const families = insights.details?.['families'] as Record<string, Record<string, number>> | undefined;
  const discipline = guessDiscipline(families);
  const sizeMB = insights.fileSize / (1024 * 1024);
  const linkCount = insights.revitLinkCount + insights.cadLinkCount;
  const worksets = insights.details?.['userWorksets'] as Record<string, number> | undefined;
  const worksetCount = worksets ? Object.keys(worksets).length : 0;
  const healthLabel = insights.healthScore >= 80 ? 'good' : insights.healthScore >= 60 ? 'fair' : 'poor';

  const parts: string[] = [];

  // Discipline + element count
  if (insights.totalElements && insights.totalElements > 0) {
    parts.push(`${discipline} with ${insights.totalElements.toLocaleString()} elements across ${insights.familyCount} family types`);
  } else {
    parts.push(`${discipline} with ${insights.familyCount} family types`);
  }

  // File size
  if (sizeMB > 300) {
    parts.push(`File size is ${formatFileSize(insights.fileSize)} (large)`);
  } else if (sizeMB > 100) {
    parts.push(`File size is ${formatFileSize(insights.fileSize)}`);
  }

  // Worksets + links
  const context: string[] = [];
  if (worksetCount > 0) context.push(`${worksetCount} worksets`);
  if (linkCount > 0) context.push(`${linkCount} linked file${linkCount > 1 ? 's' : ''}`);
  else context.push('no external links');
  if (context.length > 0) parts.push(context.join(', '));

  // Flags
  if (insights.inPlaceCount > 0) parts.push(`${insights.inPlaceCount} in-place components need attention`);

  // Delta
  if (previous) {
    const sizeDelta = insights.fileSize - previous.fileSize;
    if (Math.abs(sizeDelta) > 1024 * 1024) {
      const direction = sizeDelta > 0 ? 'grew' : 'shrank';
      parts.push(`Model ${direction} ${formatFileSize(Math.abs(sizeDelta))} since last analysis`);
    }
  }

  // Health
  parts.push(`Health is ${healthLabel}`);

  return (
    <div className="bg-blue-50 border border-blue-100 px-4 py-3">
      <p className="text-sm text-slate-700">
        {parts.join('. ')}.
      </p>
    </div>
  );
}
