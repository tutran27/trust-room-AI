import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  className?: string;
}

export function PageHeader({ title, description, action, actions, breadcrumbs, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-8', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-4 flex items-center space-x-2 text-sm text-surface-400">
          {breadcrumbs.map((crumb, index) => (
            <span key={index} className="flex items-center">
              {index > 0 && <span className="mx-2 text-surface-500">/</span>}
              {crumb.href ? (
                <a href={crumb.href} className="hover:text-brand-400 transition-colors">
                  {crumb.label}
                </a>
              ) : (
                <span className="text-surface-200">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-surface-400">{description}</p>
          )}
        </div>
        {(action || actions) && <div>{action || actions}</div>}
      </div>
    </div>
  );
}