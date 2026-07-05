import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef, useRef } from 'react';
import { cn } from '@/lib/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
type Size    = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  children?: React.ReactNode;
  fullWidth?: boolean;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-900/30 ' +
    'hover:shadow-violet-900/50 hover:from-violet-500 hover:to-indigo-500 ' +
    'border border-violet-500/40 focus-visible:ring-violet-500/50',
  secondary:
    'bg-slate-800 text-slate-200 border border-slate-700 ' +
    'hover:bg-slate-700 hover:border-slate-600 hover:text-white ' +
    'focus-visible:ring-slate-500/50',
  ghost:
    'bg-transparent text-slate-400 border border-transparent ' +
    'hover:bg-slate-800 hover:text-slate-200 hover:border-slate-700 ' +
    'focus-visible:ring-slate-500/50',
  outline:
    'bg-transparent text-violet-300 border border-violet-500/40 ' +
    'hover:bg-violet-500/10 hover:border-violet-400/60 hover:text-violet-200 ' +
    'focus-visible:ring-violet-500/50',
  danger:
    'bg-gradient-to-r from-rose-600 to-pink-600 text-white border border-rose-500/40 ' +
    'shadow-lg shadow-rose-900/20 hover:from-rose-500 hover:to-pink-500 ' +
    'focus-visible:ring-rose-500/50',
  success:
    'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border border-emerald-500/40 ' +
    'shadow-lg shadow-emerald-900/20 hover:from-emerald-500 hover:to-teal-500 ' +
    'focus-visible:ring-emerald-500/50',
};

const sizeStyles: Record<Size, string> = {
  xs: 'h-7  px-2.5 text-xs   gap-1.5 rounded-lg',
  sm: 'h-8  px-3   text-sm   gap-2   rounded-xl',
  md: 'h-10 px-4   text-sm   gap-2   rounded-xl',
  lg: 'h-11 px-5   text-base gap-2.5 rounded-2xl',
};

// ─── Component ────────────────────────────────────────────────────────────────

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconRight,
      children,
      fullWidth,
      className,
      disabled,
      onClick,
      ...rest
    },
    ref,
  ) => {
    const rippleRef = useRef<HTMLSpanElement>(null);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Ripple effect
      const btn = e.currentTarget;
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      const ripple = document.createElement('span');
      ripple.style.cssText = `
        position:absolute;
        border-radius:50%;
        width:${size}px;
        height:${size}px;
        left:${x}px;
        top:${y}px;
        background:rgba(255,255,255,0.15);
        transform:scale(0);
        animation:ripple 0.5s linear;
        pointer-events:none;
      `;
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);
      onClick?.(e);
    };

    return (
      <motion.button
        ref={ref}
        whileHover={disabled || loading ? {} : { scale: 1.02 }}
        whileTap={disabled || loading ? {} : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        disabled={disabled || loading}
        onClick={handleClick}
        aria-busy={loading}
        className={cn(
          'relative inline-flex items-center justify-center overflow-hidden font-medium',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className,
        )}
        {...rest}
      >
        {loading ? (
          <>
            <Spinner className="w-4 h-4" />
            {children && <span className="opacity-70">{children}</span>}
          </>
        ) : (
          <>
            {icon && <span className="flex-shrink-0">{icon}</span>}
            {children}
            {iconRight && <span className="flex-shrink-0">{iconRight}</span>}
          </>
        )}
      </motion.button>
    );
  },
);
Button.displayName = 'Button';

// ─── Spinner ─────────────────────────────────────────────────────────────────

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
