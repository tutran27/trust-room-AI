import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface RiskIndicatorProps {
  level: 'low' | 'medium' | 'high' | 'critical';
  label?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const config = {
  low: {
    label: 'Low Risk',
    bg: 'bg-success-50',
    border: 'border-success-200',
    text: 'text-success-700',
    dot: 'bg-success-500',
  },
  medium: {
    label: 'Medium Risk',
    bg: 'bg-warning-50',
    border: 'border-warning-200',
    text: 'text-warning-700',
    dot: 'bg-warning-500',
  },
  high: {
    label: 'High Risk',
    bg: 'bg-danger-50',
    border: 'border-danger-200',
    text: 'text-danger-700',
    dot: 'bg-danger-500',
  },
  critical: {
    label: 'Critical',
    bg: 'bg-danger-100',
    border: 'border-danger-300',
    text: 'text-danger-800',
    dot: 'bg-danger-600',
  },
};

const sizeClasses = {
  sm: 'px-2 py-1 text-xs gap-1.5',
  md: 'px-3 py-1.5 text-sm gap-2',
  lg: 'px-4 py-2.5 text-base gap-2.5',
};

const dotSizes = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
};

export function RiskIndicator({
  level,
  label,
  size = 'md',
  className = '',
}: RiskIndicatorProps) {
  const c = config[level];
  const displayLabel = label || c.label;

  return (
    <div
      className={`inline-flex items-center font-medium rounded-full border ${c.bg} ${c.border} ${c.text} ${sizeClasses[size]} ${className}`}
    >
      <span className={`${dotSizes[size]} rounded-full ${c.dot}`} />
      <span>{displayLabel}</span>
    </div>
  );
}
