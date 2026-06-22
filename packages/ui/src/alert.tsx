import * as React from 'react';
import { cn } from './cn.js';

type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

const VARIANTS: Record<AlertVariant, string> = {
  info: 'border-sky-200 bg-sky-50',
  success: 'border-emerald-200 bg-emerald-50',
  warning: 'border-amber-200 bg-amber-50',
  danger: 'border-red-200 bg-red-50',
};

const TITLE_COLORS: Record<AlertVariant, string> = {
  info: 'text-sky-800',
  success: 'text-emerald-800',
  warning: 'text-amber-800',
  danger: 'text-red-800',
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
      {children ? <div className="text-surface-700">{children}</div> : null}
    </div>
  ),
);
Alert.displayName = 'Alert';
