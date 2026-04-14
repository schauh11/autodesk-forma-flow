export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-slate-200 ${className}`}
      aria-hidden="true"
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="border border-slate-200 bg-white p-6 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-4 pt-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-9 w-28 mt-2" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="p-6 border border-slate-200 bg-slate-50">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-12 mt-2" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 7 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function TaskCardSkeleton() {
  return (
    <div className="border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-48" />
          <div className="flex gap-3">
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
    </div>
  );
}
