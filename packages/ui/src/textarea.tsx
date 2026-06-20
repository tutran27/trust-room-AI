import * as React from 'react';
import { cn } from './cn.js';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Optional label rendered above the textarea. */
  label?: string;
  /** Optional error message rendered below the textarea (also sets error styling). */
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id ?? generatedId;
    const errorId = error ? `${textareaId}-error` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label htmlFor={textareaId} className="text-sm font-medium text-slate-200">
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={cn(
            'flex min-h-[80px] w-full rounded-xl border bg-slate-950 px-3 py-2 text-sm text-slate-100',
            'placeholder:text-slate-500 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error ? 'border-red-500 focus-visible:ring-red-400' : 'border-slate-800',
            className,
          )}
          {...props}
        />
        {error ? (
          <p id={errorId} className="text-xs text-red-400">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';
