/** Format a number as a compact string: 1200 → "1.2k" */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Format a Date or ISO string to a readable relative or absolute label. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '—';
  const now = Date.now();
  const diff = now - d.getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Format a file size in bytes to a human-readable string. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Get score semantic color class. */
export function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 60) return 'text-sky-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-rose-400';
}

/** Get score background/border class for badges. */
export function scoreBadge(score: number): string {
  if (score >= 75) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (score >= 60) return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
  if (score >= 40) return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
}

/** Get match-level badge class. */
export function matchLevelBadge(level: string): string {
  if (level === 'Strong Match') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (level === 'Good Match')   return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
  if (level === 'Moderate Match') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
}

/** Get hex fill color for a score (used in SVG / recharts). */
export function scoreHex(score: number): string {
  if (score >= 75) return '#34d399';
  if (score >= 60) return '#38bdf8';
  if (score >= 40) return '#fbbf24';
  return '#f43f5e';
}
