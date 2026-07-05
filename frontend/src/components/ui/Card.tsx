import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

type CardVariant = 'default' | 'glass' | 'glow' | 'flat';

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  variant?: CardVariant;
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const variantStyles: Record<CardVariant, string> = {
  default:
    'bg-slate-900 border border-white/[0.06] shadow-[0_4px_24px_rgba(0,0,0,0.4)]',
  glass:
    'bg-slate-900/60 backdrop-blur-xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.5)]',
  glow:
    'bg-slate-900 border border-violet-500/20 shadow-[0_4px_24px_rgba(0,0,0,0.4),0_0_0_1px_rgba(124,58,237,0.1)] ' +
    'hover:border-violet-500/40 hover:shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_40px_rgba(124,58,237,0.15)]',
  flat:
    'bg-slate-800/50 border border-white/[0.04]',
};

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

// ─── Component ────────────────────────────────────────────────────────────────

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', hoverable = false, padding = 'md', className, children, ...rest }, ref) => {
    return (
      <motion.div
        ref={ref}
        whileHover={
          hoverable
            ? {
                y: -3,
                transition: { type: 'spring', stiffness: 400, damping: 25 },
              }
            : undefined
        }
        className={cn(
          'rounded-2xl transition-colors duration-200',
          variantStyles[variant],
          paddingStyles[padding],
          hoverable && 'cursor-pointer',
          className,
        )}
        {...rest}
      >
        {children}
      </motion.div>
    );
  },
);
Card.displayName = 'Card';

// ─── Card sub-parts ───────────────────────────────────────────────────────────

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <h3 className={cn('text-base font-semibold text-white leading-tight', className)}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <p className={cn('text-sm text-slate-400 mt-0.5', className)}>
      {children}
    </p>
  );
}
