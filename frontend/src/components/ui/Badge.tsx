import { cn } from '@/lib/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

type BadgeVariant =
  | 'violet' | 'indigo' | 'emerald' | 'sky' | 'amber' | 'rose'
  | 'slate' | 'cyan' | 'pink' | 'default';

type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  glow?: boolean;
  className?: string;
  children: React.ReactNode;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const variantMap: Record<BadgeVariant, string> = {
  default:  'bg-slate-700/60 text-slate-300 border-slate-600/50',
  slate:    'bg-slate-700/60 text-slate-300 border-slate-600/50',
  violet:   'bg-violet-500/15 text-violet-300 border-violet-500/30',
  indigo:   'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  emerald:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  sky:      'bg-sky-500/15 text-sky-300 border-sky-500/30',
  cyan:     'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  amber:    'bg-amber-500/15 text-amber-300 border-amber-500/30',
  rose:     'bg-rose-500/15 text-rose-300 border-rose-500/30',
  pink:     'bg-pink-500/15 text-pink-300 border-pink-500/30',
};

const dotColorMap: Record<BadgeVariant, string> = {
  default:  'bg-slate-400',
  slate:    'bg-slate-400',
  violet:   'bg-violet-400',
  indigo:   'bg-indigo-400',
  emerald:  'bg-emerald-400',
  sky:      'bg-sky-400',
  cyan:     'bg-cyan-400',
  amber:    'bg-amber-400',
  rose:     'bg-rose-400',
  pink:     'bg-pink-400',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function Badge({
  variant = 'default',
  size = 'sm',
  dot = false,
  glow = false,
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border rounded-full font-medium leading-none',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        variantMap[variant],
        glow && 'shadow-[0_0_10px_rgba(124,58,237,0.3)]',
        className,
      )}
    >
      {dot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse', dotColorMap[variant])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

// ─── Score badge helper ───────────────────────────────────────────────────────

export function ScoreBadge({ score }: { score: number }) {
  const variant: BadgeVariant =
    score >= 75 ? 'emerald' : score >= 60 ? 'sky' : score >= 40 ? 'amber' : 'rose';
  return (
    <Badge variant={variant} size="sm">
      {Math.round(score)}%
    </Badge>
  );
}

// ─── Status badge helper ──────────────────────────────────────────────────────

const statusVariantMap: Record<string, BadgeVariant> = {
  Applied:              'slate',
  Screening:            'sky',
  'Interview Scheduled':'indigo',
  Interviewed:          'violet',
  Shortlisted:          'emerald',
  'Offer Sent':         'cyan',
  Hired:                'emerald',
  Rejected:             'rose',
};

export function StatusBadge({ status }: { status: string }) {
  const variant = statusVariantMap[status] ?? 'default';
  return (
    <Badge variant={variant} size="sm" dot>
      {status || 'Applied'}
    </Badge>
  );
}

// ─── Match-level badge helper ─────────────────────────────────────────────────

export function MatchBadge({ level }: { level: string }) {
  const variant: BadgeVariant =
    level === 'Strong Match' ? 'emerald'
    : level === 'Good Match' ? 'sky'
    : level === 'Moderate Match' ? 'amber'
    : 'rose';
  return <Badge variant={variant} size="sm">{level}</Badge>;
}
