import * as React from 'react';
import { cn } from './cn.js';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Optional label rendered above the input. */
  label?: string;
  /** Optional error message rendered below the input (also sets error styling). */
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={cn(
            'flex h-10 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900',
            'placeholder:text-slate-400 transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus-visible:border-indigo-500/50',
            'disabled:cursor-not-allowed disabled:opacity-40',
            error ? 'border-red-500 focus-visible:ring-red-400' : 'border-slate-200 hover:border-slate-300',
            className,
          )}
          {...props}
        />
        {error ? (
          <p id={errorId} className="text-xs text-red-500">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = 'Input';
