import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode | EmptyStateAction;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      {icon && <div className="mb-4 text-surface-500">{icon}</div>}
      <h3 className="text-lg font-semibold text-surface-200">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-surface-400">{description}</p>
      )}
      {action && (
        <div className="mt-4">
          {typeof action === 'object' && 'label' in action && 'onClick' in action ? (
            <Button onClick={action.onClick}>{action.label}</Button>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  );
}