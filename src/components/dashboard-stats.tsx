'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { BadgeCheck, Clock, TrendingUp, Activity } from 'lucide-react';
import { getRelativeTime } from '@/lib/format-utils';

type DashboardStatsProps = {
  projects: number;
  activeTasks: number;
  successRate: number;
  lastPublish: string | null;
  recentJobs: { status: string; createdAt: string }[];
};

function getSuccessRateColor(rate: number): string {
  if (rate > 90) return 'text-emerald-600';
  if (rate > 70) return 'text-amber-600';
  return 'text-red-600';
}

function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  valueClass?: string;
}) {
  return (
    <div className="border-all-subtle bg-white p-4 shadow-sm flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500 uppercase">{label}</span>
        <div className="text-slate-400" aria-hidden="true">{Icon}</div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold font-mono ${valueClass || 'text-slate-800'}`}>{value}</span>
        {unit && <span className="text-xs text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}

export function DashboardStats({
  projects,
  activeTasks,
  successRate,
  lastPublish,
  recentJobs,
}: DashboardStatsProps) {
  const successCount = recentJobs.filter((j) => j.status === 'SUCCESS').length;
  const failedCount = recentJobs.filter((j) => j.status === 'FAILED').length;
  const total = recentJobs.length;

  const chartData = [
    { name: 'Success', value: successCount, fill: '#10b981' },
    { name: 'Failed', value: failedCount, fill: '#ef4444' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Activity className="w-4 h-4" />}
          label="Projects"
          value={projects}
        />
        <StatCard
          icon={<Clock className="w-4 h-4" />}
          label="Active Tasks"
          value={activeTasks}
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Success Rate"
          value={total > 0 ? `${Math.round(successRate)}%` : 'N/A'}
          valueClass={total > 0 ? getSuccessRateColor(successRate) : 'text-slate-400'}
        />
        <StatCard
          icon={<BadgeCheck className="w-4 h-4" />}
          label="Last Publish"
          value={lastPublish ? getRelativeTime(lastPublish) : 'Never'}
        />
      </div>

      {/* Recent Jobs Chart */}
      {total > 0 ? (
        <div className="border-all-subtle bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Recent Job Results</h3>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-full sm:w-40 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-sm text-slate-700">
                  <span className="font-mono font-semibold text-emerald-600">{successCount}</span>
                  {' '}Successful
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm text-slate-700">
                  <span className="font-mono font-semibold text-red-600">{failedCount}</span>
                  {' '}Failed
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Showing last {total} jobs
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-all-subtle border-dashed bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-500">No job history yet. Create a task and run a publish to see results here.</p>
        </div>
      )}
    </div>
  );
}
