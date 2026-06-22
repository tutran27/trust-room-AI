import * as React from 'react';
import { cn } from './cn.js';

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn('animate-pulse rounded-2xl bg-surface-200', className)}
      {...props}
    />
  ),
);
Skeleton.displayName = 'Skeleton';
