import { motion, AnimatePresence } from 'framer-motion';
import { forwardRef, useState, useId } from 'react';
import { cn } from '@/lib/cn';

// ─── TextInput ────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, iconRight, className, id: externalId, ...rest }, ref) => {
    const uid = useId();
    const id = externalId ?? uid;
    const [focused, setFocused] = useState(false);

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-slate-300">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
              {icon}
            </span>
          )}
          <motion.input
            ref={ref}
            id={id}
            animate={
              focused
                ? { boxShadow: '0 0 0 3px rgba(124,58,237,0.25), 0 0 0 1px rgba(124,58,237,0.6)' }
                : { boxShadow: '0 0 0 0px rgba(124,58,237,0)' }
            }
            transition={{ duration: 0.15 }}
            onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
            onBlur={(e)  => { setFocused(false); rest.onBlur?.(e); }}
            className={cn(
              'w-full bg-slate-800/80 border rounded-xl px-4 py-2.5 text-sm text-slate-200',
              'placeholder:text-slate-500 outline-none transition-colors duration-150',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error
                ? 'border-rose-500/60 focus:border-rose-400'
                : 'border-slate-700 focus:border-violet-500/60',
              icon      && 'pl-10',
              iconRight && 'pr-10',
              className,
            )}
            {...(rest as any)}
          />
          {iconRight && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
              {iconRight}
            </span>
          )}
        </div>
        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              key="error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-xs text-rose-400"
            >
              {error}
            </motion.p>
          )}
          {!error && hint && (
            <motion.p
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-slate-500"
            >
              {hint}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  },
);
Input.displayName = 'Input';

// ─── Textarea ─────────────────────────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id: externalId, ...rest }, ref) => {
    const uid = useId();
    const id = externalId ?? uid;
    const [focused, setFocused] = useState(false);

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-slate-300">
            {label}
          </label>
        )}
        <motion.textarea
          ref={ref}
          id={id}
          animate={
            focused
              ? { boxShadow: '0 0 0 3px rgba(124,58,237,0.25), 0 0 0 1px rgba(124,58,237,0.6)' }
              : { boxShadow: '0 0 0 0px rgba(124,58,237,0)' }
          }
          transition={{ duration: 0.15 }}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e as React.FocusEvent<HTMLTextAreaElement>); }}
          onBlur={(e)  => { setFocused(false); rest.onBlur?.(e as React.FocusEvent<HTMLTextAreaElement>); }}
          className={cn(
            'w-full bg-slate-800/80 border rounded-xl px-4 py-3 text-sm text-slate-200',
            'placeholder:text-slate-500 outline-none transition-colors duration-150 resize-none',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error
              ? 'border-rose-500/60'
              : 'border-slate-700 focus:border-violet-500/60',
            className,
          )}
          {...(rest as any)}
        />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        {!error && hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

// ─── Select ───────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  error?: string;
}

export function Select({ label, options, error, className, id: externalId, ...rest }: SelectProps) {
  const uid = useId();
  const id = externalId ?? uid;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-300">
          {label}
        </label>
      )}
      <select
        id={id}
        className={cn(
          'w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200',
          'outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20',
          'disabled:opacity-50 transition-colors',
          error && 'border-rose-500/60',
          className,
        )}
        {...rest}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
