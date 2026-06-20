import * as React from 'react';
import { cn } from './cn.js';

type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

const VARIANTS: Record<AlertVariant, string> = {
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  danger: 'border-red-500/30 bg-red-500/10 text-red-100',
};

const TITLE_COLORS: Record<AlertVariant, string> = {
  info: 'text-sky-300',
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  danger: 'text-red-300',
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
      {children ? <div className="text-slate-200/90">{children}</div> : null}
    </div>
  ),
);
Alert.displayName = 'Alert';
