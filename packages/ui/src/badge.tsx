import * as React from 'react';
import { cn } from './cn.js';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

const VARIANTS: Record<BadgeVariant, string> = {
  default: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  warning: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  danger: 'border-red-500/20 bg-red-500/10 text-red-400',
  info: 'border-sky-500/20 bg-sky-500/10 text-sky-400',
  muted: 'border-white/[0.06] bg-white/[0.04] text-zinc-400',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  ),
);
Badge.displayName = 'Badge';
