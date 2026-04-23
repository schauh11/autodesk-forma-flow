'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export interface TopNCardProps {
  title: string;
  data: Array<{ name: string; value: number }>;
  maxItems?: number;
  barColor?: string;
}

export function TopNCard({ title, data, maxItems = 10, barColor = '#3b82f6' }: TopNCardProps) {
  const displayData = data.slice(0, maxItems);

  return (
    <div className="border border-slate-200 bg-white p-4 rounded-sm shadow-sm">
      <h5 className="text-sm font-semibold text-slate-700 mb-3">{title}</h5>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={displayData}
            margin={{ left: 120, right: 10, top: 5, bottom: 5 }}
          >
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={115} />
            <Tooltip />
            <Bar dataKey="value" fill={barColor} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {data.length > maxItems && (
        <p className="text-xs text-slate-400 mt-2">Showing top {maxItems} of {data.length} total</p>
      )}
    </div>
  );
}
