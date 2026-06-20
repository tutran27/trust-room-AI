import * as React from 'react';
import { cn } from './cn.js';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Optional label rendered above the select. */
  label?: string;
  /** Optional error message rendered below the select (also sets error styling). */
  error?: string;
  /** Declarative options. When provided, rendered before any children. */
  options?: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, children, id, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;
    const errorId = error ? `${selectId}-error` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label htmlFor={selectId} className="text-sm font-medium text-slate-200">
            {label}
          </label>
        ) : null}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={cn(
            'flex h-10 w-full appearance-none rounded-xl border bg-slate-950 px-3 py-2 text-sm text-slate-100',
            'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error ? 'border-red-500 focus-visible:ring-red-400' : 'border-slate-800',
            className,
          )}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : null}
          {children}
        </select>
        {error ? (
          <p id={errorId} className="text-xs text-red-400">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
Select.displayName = 'Select';
