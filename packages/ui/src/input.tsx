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
          <label htmlFor={inputId} className="text-sm font-medium text-surface-700">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={cn(
            'flex h-10 w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900',
            'placeholder:text-surface-400 transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:border-brand-400',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error ? 'border-red-400 focus-visible:ring-red-400' : 'hover:border-surface-400',
            className,
          )}
          {...props}
        />
        {error ? (
          <p id={errorId} className="text-xs text-danger-600">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = 'Input';
