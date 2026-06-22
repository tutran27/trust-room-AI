import * as React from 'react';
import { cn } from './cn.js';

type SpinnerSize = 'sm' | 'md' | 'lg';

const SIZES: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
};

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: SpinnerSize;
  /** Accessible label for screen readers. */
  label?: string;
}

export const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ className, size = 'md', label = 'Loading', ...props }, ref) => (
    <span
      ref={ref}
      role="status"
      aria-label={label}
      className={cn(
        'inline-block animate-spin rounded-full border-slate-300 border-t-indigo-500',
        SIZES[size],
        className,
      )}
      {...props}
    />
  ),
);
Spinner.displayName = 'Spinner';
