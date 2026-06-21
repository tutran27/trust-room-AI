'use client';

import { Badge } from '@trustroom/ui';
import { titleCaseStatus } from '../lib/format';

const VARIANT_BY_STATUS: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
  Draft: 'muted',
  Created: 'info',
  WaitingForCounterparty: 'warning',
  WalletVerified: 'info',
  EscrowCreated: 'info',
  Deposited: 'warning',
  Negotiating: 'warning',
  TermsConfirmed: 'info',
  DeliverySubmitted: 'warning',
  ReadyToRelease: 'warning',
  Released: 'success',
  Refunded: 'success',
  ResolvedRelease: 'success',
  ResolvedRefund: 'success',
  ResolvedSplit: 'success',
  Disputed: 'danger',
  Cancelled: 'muted',
  Expired: 'muted',
  Open: 'warning',
  UnderReview: 'info',
  Resolved: 'success',
  Escalated: 'danger',
  Funded: 'warning',
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <Badge variant={VARIANT_BY_STATUS[value] ?? 'muted'}>
      {titleCaseStatus(value)}
    </Badge>
  );
}
