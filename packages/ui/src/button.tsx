import * as React from 'react';
import { cn } from './cn.js';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm shadow-emerald-500/20',
  secondary: 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.1] border border-white/[0.06]',
  danger: 'bg-red-600 text-white hover:bg-red-500 shadow-sm shadow-red-500/20',
  ghost: 'bg-transparent text-slate-300 hover:bg-white/[0.06] hover:text-slate-100',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
        'disabled:opacity-40 disabled:pointer-events-none',
        'active:scale-[0.98]',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
