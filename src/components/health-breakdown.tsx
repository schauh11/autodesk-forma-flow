'use client';

import { Badge } from '@/components/ui/badge';
import { type HealthBreakdown } from '@/lib/health-score';


type HealthBreakdownProps = {
  breakdown: HealthBreakdown;
};

function getRatingBadgeVariant(rating: 'good' | 'fair' | 'poor'): 'success' | 'warning' | 'error' {
  switch (rating) {
    case 'good':
      return 'success';
    case 'fair':
      return 'warning';
    case 'poor':
      return 'error';
  }
}

function getRatingColor(rating: 'good' | 'fair' | 'poor'): string {
  switch (rating) {
    case 'good':
      return 'bg-emerald-500';
    case 'fair':
      return 'bg-amber-500';
    case 'poor':
      return 'bg-red-500';
  }
}

function getRecommendationColor(rating: 'good' | 'fair' | 'poor'): string {
  switch (rating) {
    case 'good':
      return 'text-emerald-700';
    case 'fair':
      return 'text-amber-700';
    case 'poor':
      return 'text-red-700';
  }
}

export function HealthBreakdown({ breakdown }: HealthBreakdownProps) {
  return (
    <div className="space-y-6 p-6 bg-white rounded border border-slate-200">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-slate-800">Health Report Card</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-bold text-slate-900">
            {breakdown.totalScore}/100
          </span>
          <Badge variant={getRatingBadgeVariant(breakdown.rating)}>
            {breakdown.rating.charAt(0).toUpperCase() + breakdown.rating.slice(1)}
          </Badge>
        </div>
      </div>

      {/* Section Rows */}
      <div className="space-y-5">
        {breakdown.sections.map((section) => {
          const percentage = (section.score / section.maxScore) * 100;
          const barColor = getRatingColor(section.rating);
          const recommendationColor = getRecommendationColor(section.rating);

          return (
            <div key={section.label} className="space-y-2">
              {/* Label, Progress Bar, Score Row */}
              <div className="flex items-center gap-3">
                {/* Label */}
                <div className="w-32">
                  <span className="text-sm font-medium text-slate-700">{section.label}</span>
                </div>

                {/* Progress Bar */}
                <div className="flex-1">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barColor} transition-all duration-300`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                {/* Score */}
                <div className="text-right min-w-fit">
                  <span className="text-sm font-mono font-semibold text-slate-900">
                    {section.score}/{section.maxScore}
                  </span>
                </div>
              </div>

              {/* Detail and Recommendation Row */}
              <div className="pl-35 space-y-1">
                <p className="text-xs text-slate-500">{section.detail}</p>
                <p className={`text-xs font-medium ${recommendationColor}`}>
                  {section.recommendation}
                </p>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
