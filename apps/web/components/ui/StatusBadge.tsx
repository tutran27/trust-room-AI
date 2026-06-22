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
  created: 'bg-surface-500/20 text-surface-300 border-surface-500/30',
  funded: 'bg-brand-500/20 text-brand-400 border-brand-500/30',
  termsconfirmed: 'bg-accent-500/20 text-accent-400 border-accent-500/30',
  deliverysubmitted: 'bg-warning-500/20 text-warning-400 border-warning-500/30',
  released: 'bg-success-500/20 text-success-400 border-success-500/30',
  refunded: 'bg-surface-500/20 text-surface-300 border-surface-500/30',
  disputed: 'bg-danger-500/20 text-danger-400 border-danger-500/30',
  // General statuses
  active: 'bg-success-500/20 text-success-400 border-success-500/30',
  pending: 'bg-warning-500/20 text-warning-400 border-warning-500/30',
  completed: 'bg-success-500/20 text-success-400 border-success-500/30',
  cancelled: 'bg-surface-500/20 text-surface-300 border-surface-500/30',
  resolved: 'bg-success-500/20 text-success-400 border-success-500/30',
  in_progress: 'bg-brand-500/20 text-brand-400 border-brand-500/30',
  open: 'bg-brand-500/20 text-brand-400 border-brand-500/30',
  closed: 'bg-surface-500/20 text-surface-300 border-surface-500/30',
  won: 'bg-success-500/20 text-success-400 border-success-500/30',
  lost: 'bg-danger-500/20 text-danger-400 border-danger-500/30',
  expired: 'bg-warning-500/20 text-warning-400 border-warning-500/30',
  scheduled: 'bg-accent-500/20 text-accent-400 border-accent-500/30',
  underreview: 'bg-brand-500/20 text-brand-400 border-brand-500/30',
  escalated: 'bg-danger-500/20 text-danger-400 border-danger-500/30',
};

export function StatusBadge({ status, type, className }: StatusBadgeProps) {
  const normalizedStatus = status?.toLowerCase().replace(/\s+/g, '_') || 'pending';
  const style = statusStyles[normalizedStatus] || 'bg-surface-500/20 text-surface-300 border-surface-500/30';

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