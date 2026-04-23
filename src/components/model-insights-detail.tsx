'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

type ModelInsight = {
  fileSize: number;
  viewCount: number;
  sheetCount: number;
  scheduleCount: number;
  revitLinkCount: number;
  cadLinkCount: number;
  familyCount: number;
  inPlaceCount: number;
  roomCount: number;
  levelCount: number;
  healthScore: 'Good' | 'Fair' | 'Poor';
  fetchedAt: string;
  details: {
    views?: string[];
    sheets?: string[];
    schedules?: string[];
    revitLinks?: string[];
    cadLinks?: string[];
    families?: Record<string, string[]>;
    inPlaceComponents?: string[];
    rooms?: string[];
    levels?: string[];
  };
};

type ModelInsightHistory = {
  fileSize: number;
  viewCount: number;
  sheetCount: number;
  healthScore: string;
  fetchedAt: string;
  versionNumber: number;
};

type ModelInsightsDetailProps = {
  insights: ModelInsight;
  history: ModelInsightHistory[];
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function ExpandableList({
  title,
  items,
  maxItems = 10,
}: {
  title: string;
  items: string[] | undefined;
  maxItems?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayItems = expanded ? items : items?.slice(0, maxItems);
  const hasMore = items && items.length > maxItems;

  return (
    <div className="space-y-2">
      <h5 className="text-sm font-medium text-slate-700">{title}</h5>
      <ul className="space-y-1 max-h-48 overflow-y-auto">
        {displayItems?.map((item, i) => (
          <li key={i} className="text-sm text-slate-600 font-mono break-words">
            {item}
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          {expanded ? (
            <>
              <ChevronDown className="w-3 h-3" /> Show Less
            </>
          ) : (
            <>
              <ChevronRight className="w-3 h-3" /> Show {items!.length - maxItems} More
            </>
          )}
        </button>
      )}
    </div>
  );
}

function ExpandableCategory({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-slate-200 rounded bg-slate-50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-100 transition-colors"
      >
        <span className="font-medium text-sm text-slate-700">
          {title} ({count})
        </span>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-600" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-600" />
        )}
      </button>
      {expanded && <div className="px-3 py-2 border-t border-slate-200">{children}</div>}
    </div>
  );
}

export function ModelInsightsDetail({
  insights,
  history,
}: ModelInsightsDetailProps) {
  const historyData = history.map((h) => ({
    version: `v${h.versionNumber}`,
    fileSize: h.fileSize / (1024 * 1024),
    healthScore: h.healthScore === 'Good' ? 90 : h.healthScore === 'Fair' ? 60 : 30,
  }));

  const familyCategories = insights.details.families || {};
  const totalFamilies = Object.values(familyCategories).reduce(
    (sum, families) => sum + families.length,
    0
  );

  return (
    <div className="space-y-6 p-6 bg-white rounded border border-slate-200">
      {/* File Size Trend */}
      <div>
        <h3 className="text-base font-semibold text-slate-800 mb-4">File Size Trend</h3>
        {historyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={historyData}>
              <XAxis dataKey="version" />
              <YAxis label={{ value: 'Size (MB)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="fileSize"
                stroke="#2563eb"
                fill="#bfdbfe"
                name="File Size (MB)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-500">No historical data available</p>
        )}
      </div>

      {/* Health Score Trend */}
      {historyData.length > 1 && (
        <div>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Health Score Trend</h3>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={historyData}>
              <XAxis dataKey="version" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="healthScore"
                stroke="#10b981"
                name="Health Score"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Views and Sheets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {insights.details.views && insights.details.views.length > 0 && (
          <ExpandableList title="Views" items={insights.details.views} />
        )}
        {insights.details.sheets && insights.details.sheets.length > 0 && (
          <ExpandableList title="Sheets" items={insights.details.sheets} />
        )}
      </div>

      {/* Schedules */}
      {insights.details.schedules && insights.details.schedules.length > 0 && (
        <div>
          <ExpandableList title="Schedules" items={insights.details.schedules} />
        </div>
      )}

      {/* Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {insights.details.revitLinks && insights.details.revitLinks.length > 0 && (
          <ExpandableList
            title={`Revit Links (${insights.details.revitLinks.length})`}
            items={insights.details.revitLinks}
          />
        )}
        {insights.details.cadLinks && insights.details.cadLinks.length > 0 && (
          <ExpandableList
            title={`CAD Links (${insights.details.cadLinks.length})`}
            items={insights.details.cadLinks}
          />
        )}
      </div>

      {/* Families */}
      {Object.keys(familyCategories).length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-slate-800 mb-3">
            Families ({totalFamilies})
          </h3>
          <div className="space-y-2">
            {Object.entries(familyCategories).map(([category, families]) => (
              <ExpandableCategory key={category} title={category} count={families.length}>
                <ul className="space-y-1">
                  {families.map((family, i) => (
                    <li key={i} className="text-sm text-slate-600 font-mono">
                      {family}
                    </li>
                  ))}
                </ul>
              </ExpandableCategory>
            ))}
          </div>
        </div>
      )}

      {/* In-Place Components */}
      {insights.details.inPlaceComponents &&
        insights.details.inPlaceComponents.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded">
            <p className="text-sm font-medium text-amber-900 mb-2">
              In-place components ({insights.details.inPlaceComponents.length})
            </p>
            <p className="text-xs text-amber-800 mb-3">
              In-place components reduce model performance. Consider converting to loadable
              families.
            </p>
            <ul className="space-y-1">
              {insights.details.inPlaceComponents.map((component, i) => (
                <li key={i} className="text-xs text-amber-700 font-mono">
                  {component}
                </li>
              ))}
            </ul>
          </div>
        )}

      {/* Rooms and Levels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {insights.details.rooms && insights.details.rooms.length > 0 && (
          <ExpandableList title="Rooms" items={insights.details.rooms} />
        )}
        {insights.details.levels && insights.details.levels.length > 0 && (
          <ExpandableList title="Levels" items={insights.details.levels} />
        )}
      </div>
    </div>
  );
}
