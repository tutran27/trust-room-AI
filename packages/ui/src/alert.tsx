import * as React from 'react';
import { cn } from './cn.js';

type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

const VARIANTS: Record<AlertVariant, string> = {
  info: 'border-sky-500/20 bg-sky-500/[0.06]',
  success: 'border-emerald-500/20 bg-emerald-500/[0.06]',
  warning: 'border-amber-500/20 bg-amber-500/[0.06]',
  danger: 'border-red-500/20 bg-red-500/[0.06]',
};

const TITLE_COLORS: Record<AlertVariant, string> = {
  info: 'text-sky-400',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  danger: 'text-red-400',
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  /** Optional bold title rendered above the body. */
  title?: string;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'info', title, children, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(
        'rounded-xl border px-4 py-3 text-sm',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {title ? (
        <p className={cn('mb-1 font-semibold', TITLE_COLORS[variant])}>{title}</p>
      ) : null}
      {children ? <div className="text-zinc-300">{children}</div> : null}
    </div>
  ),
);
Alert.displayName = 'Alert';
