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
        'rounded-xl border border-slate-800 bg-slate-900/60 p-4',
        className,
      )}
      {...props}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-50">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  ),
);
Stat.displayName = 'Stat';
