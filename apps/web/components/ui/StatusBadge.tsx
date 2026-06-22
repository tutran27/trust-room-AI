import { cn } from '@/lib/utils';

export type DealStatus = 'Created' | 'Funded' | 'TermsConfirmed' | 'DeliverySubmitted' | 'Released' | 'Refunded' | 'Disputed';
export type EscrowStatus = 'Pending' | 'Funded' | 'Released' | 'Refunded' | 'Disputed';
export type DisputeStatus = 'Open' | 'UnderReview' | 'Resolved' | 'Escalated' | 'Closed';

interface StatusBadgeProps {
  status: string;
  type?: string;
  className?: string;
}

const statusStyles: Record<string, string> = {
  // Deal statuses
  created: 'bg-surface-50 text-surface-600 border-surface-200',
  funded: 'bg-brand-50 text-brand-700 border-brand-200',
  termsconfirmed: 'bg-accent-50 text-accent-700 border-accent-200',
  deliverysubmitted: 'bg-warning-50 text-warning-700 border-warning-200',
  released: 'bg-success-50 text-success-700 border-success-200',
  refunded: 'bg-surface-50 text-surface-600 border-surface-200',
  disputed: 'bg-danger-50 text-danger-700 border-danger-200',
  // General statuses
  active: 'bg-success-50 text-success-700 border-success-200',
  pending: 'bg-warning-50 text-warning-700 border-warning-200',
  completed: 'bg-success-50 text-success-700 border-success-200',
  cancelled: 'bg-surface-50 text-surface-600 border-surface-200',
  resolved: 'bg-success-50 text-success-700 border-success-200',
  in_progress: 'bg-brand-50 text-brand-700 border-brand-200',
  open: 'bg-brand-50 text-brand-700 border-brand-200',
  closed: 'bg-surface-50 text-surface-600 border-surface-200',
  won: 'bg-success-50 text-success-700 border-success-200',
  lost: 'bg-danger-50 text-danger-700 border-danger-200',
  expired: 'bg-warning-50 text-warning-700 border-warning-200',
  scheduled: 'bg-accent-50 text-accent-700 border-accent-200',
  underreview: 'bg-brand-50 text-brand-700 border-brand-200',
  escalated: 'bg-danger-50 text-danger-700 border-danger-200',
};

export function StatusBadge({ status, type, className }: StatusBadgeProps) {
  const normalizedStatus = status?.toLowerCase().replace(/\s+/g, '_') || 'pending';
  const style = statusStyles[normalizedStatus] || 'bg-surface-50 text-surface-600 border-surface-200';

  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
      style,
      className
    )}>
      {status?.replace(/_/g, ' ') || 'Unknown'}
    </span>
  );
}
