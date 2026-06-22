import { ReactNode, ElementType } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title?: string;
  label?: string;
  value: string | number;
  icon?: ElementType;
  iconBg?: string;
  iconColor?: string;
  trend?: {
    value: string | number;
    positive?: boolean;
    isPositive?: boolean;
  };
  className?: string;
}

export function StatCard({ title, label, value, icon: Icon, iconBg, iconColor, trend, className }: StatCardProps) {
  const displayTitle = title || label;
  const isPositive = trend?.positive ?? trend?.isPositive ?? true;

  return (
    <div className={cn('rounded-xl border border-surface-200 bg-white p-6 shadow-sm', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-surface-500">{displayTitle}</p>
        {Icon && (
          <div className={cn('rounded-lg p-2', iconBg || 'bg-brand-50')}>
            <Icon className={cn('h-5 w-5', iconColor || 'text-brand-600')} />
          </div>
        )}
      </div>
      <div className="mt-2">
        <p className="text-2xl font-bold text-surface-900">{value}</p>
        {trend && (
          <p className={cn(
            'mt-1 text-xs font-medium',
            isPositive ? 'text-success-600' : 'text-danger-600'
          )}>
            {typeof trend.value === 'string' ? trend.value : (
              <>{isPositive ? '+' : ''}{trend.value}%</>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
