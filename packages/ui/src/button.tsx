import * as React from 'react';
import { cn } from './cn.js';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-500 shadow-sm shadow-brand-500/20 active:bg-brand-700',
  secondary: 'bg-white text-surface-700 hover:bg-surface-50 border border-surface-300 shadow-sm',
  danger: 'bg-danger-600 text-white hover:bg-danger-500 shadow-sm shadow-danger-500/20 active:bg-danger-700',
  ghost: 'bg-transparent text-surface-600 hover:bg-surface-100 hover:text-surface-800',
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
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
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
