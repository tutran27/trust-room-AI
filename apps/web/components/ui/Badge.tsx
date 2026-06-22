import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
  primary: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
  success: 'bg-success-500/10 text-success-500 border-success-500/20',
  warning: 'bg-warning-500/10 text-warning-500 border-warning-500/20',
  danger: 'bg-danger-500/10 text-danger-500 border-danger-500/20',
  info: 'bg-info-500/10 text-info-500 border-info-500/20',
  outline: 'bg-transparent text-surface-700 border-surface-400',
};

const dotStyles: Record<BadgeVariant, string> = {
  default: 'bg-brand-400',
  primary: 'bg-brand-400',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
  outline: 'bg-surface-400',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
};

export function Badge({ children, variant = 'default', size = 'md', dot = false, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', dotStyles[variant])} />
      )}
      {children}
    </span>
  );
}