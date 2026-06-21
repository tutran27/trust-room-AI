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
        'rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5',
        className,
      )}
      {...props}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  ),
);
Stat.displayName = 'Stat';
