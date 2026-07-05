import { cn } from '@/lib/cn';

// ─── Base shimmer skeleton ────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-lg bg-slate-800 overflow-hidden relative',
        'before:absolute before:inset-0',
        'before:bg-gradient-to-r before:from-transparent before:via-white/[0.04] before:to-transparent',
        'before:-translate-x-full before:animate-[shimmer_1.6s_infinite]',
        className,
      )}
      aria-hidden="true"
    />
  );
}

// ─── KPI card skeleton ────────────────────────────────────────────────────────

export function KpiSkeleton() {
  return (
    <div className="bg-slate-900 border border-white/[0.06] rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-11 h-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      </div>
    </div>
  );
}

// ─── Candidate card skeleton ──────────────────────────────────────────────────

export function CandidateCardSkeleton() {
  return (
    <div className="bg-slate-900 border border-white/[0.06] rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-12 rounded-full" />
      </div>
      <div className="flex justify-between pt-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

// ─── Table row skeleton ───────────────────────────────────────────────────────

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className={`h-4 ${i === 0 ? 'w-8' : i === 1 ? 'w-32' : 'w-20'}`} />
        </td>
      ))}
    </tr>
  );
}

// ─── Text block skeleton ──────────────────────────────────────────────────────

export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-4', i === lines - 1 ? 'w-3/5' : 'w-full')}
        />
      ))}
    </div>
  );
}
