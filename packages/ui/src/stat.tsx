import * as React from 'react';
import { cn } from './cn.js';

export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Short caption describing the value. */
  label: string;
  /** Primary value to display. */
  value: React.ReactNode;
  /** Optional supporting detail rendered below the value. */
  hint?: React.ReactNode;
}

export const Stat = React.forwardRef<HTMLDivElement, StatProps>(
  ({ className, label, value, hint, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-5',
        className,
      )}
      {...props}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  ),
);
Stat.displayName = 'Stat';
