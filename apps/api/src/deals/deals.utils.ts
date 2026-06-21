import { createHash } from 'node:crypto';
import { Prisma } from '@trustroom/db';
import { DealAction, DealEvent, DealStatus } from '@trustroom/types';

export function encodeCursor(input: { updatedAt: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({
      updatedAt: input.updatedAt.toISOString(),
      id: input.id,
    }),
    'utf8',
  ).toString('base64url');
}

export function decodeCursor(cursor: string): { updatedAt: Date; id: string } {
  const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
    updatedAt: string;
    id: string;
  };
  return {
    updatedAt: new Date(payload.updatedAt),
    id: payload.id,
  };
}

export function amountToString(value: Prisma.Decimal | string): string {
  return typeof value === 'string' ? value : value.toString();
}

export function getTargetStatusForAction(
  currentStatus: DealStatus,
  action: DealAction,
): DealStatus | null {
  if (action === 'publish' && currentStatus === DealStatus.Draft) {
    return DealStatus.Created;
  }
  if (
    action === 'open-invitation' &&
    currentStatus === DealStatus.Created
  ) {
    return DealStatus.WaitingForCounterparty;
  }
  if (
    action === 'verify-wallets' &&
    currentStatus === DealStatus.WaitingForCounterparty
  ) {
    return DealStatus.WalletVerified;
  }
  if (action === 'create-escrow' && currentStatus === DealStatus.WalletVerified) {
    return DealStatus.EscrowCreated;
  }
  if (action === 'deposit' && currentStatus === DealStatus.EscrowCreated) {
    return DealStatus.Deposited;
  }
  if (action === 'start-negotiation' && currentStatus === DealStatus.Deposited) {
    return DealStatus.Negotiating;
  }
  if (action === 'confirm-terms' && currentStatus === DealStatus.Negotiating) {
    return DealStatus.TermsConfirmed;
  }
  if (action === 'submit-delivery' && currentStatus === DealStatus.TermsConfirmed) {
    return DealStatus.DeliverySubmitted;
  }
  if (action === 'mark-ready' && currentStatus === DealStatus.DeliverySubmitted) {
    return DealStatus.ReadyToRelease;
  }
  if (action === 'release' && currentStatus === DealStatus.ReadyToRelease) {
    return DealStatus.Released;
  }
  if (action === 'raise-dispute') {
    switch (currentStatus) {
      case DealStatus.Deposited:
      case DealStatus.Negotiating:
      case DealStatus.TermsConfirmed:
      case DealStatus.DeliverySubmitted:
      case DealStatus.ReadyToRelease:
        return DealStatus.Disputed;
      default:
        return null;
    }
  }
  if (action === 'refund') {
    switch (currentStatus) {
      case DealStatus.Deposited:
      case DealStatus.Negotiating:
      case DealStatus.TermsConfirmed:
        return DealStatus.Refunded;
      default:
        return null;
    }
  }
  if (action === 'cancel') {
    switch (currentStatus) {
      case DealStatus.Draft:
      case DealStatus.Created:
      case DealStatus.WaitingForCounterparty:
      case DealStatus.WalletVerified:
      case DealStatus.EscrowCreated:
        return DealStatus.Cancelled;
      default:
        return null;
    }
  }
  return null;
}

/**
 * Deterministic terms hash for a deal. WHY: both parties sign the SAME terms hash
 * to confirm terms, so the hash must be stable across machines and insensitive to
 * key ordering or incidental whitespace. We build a canonical, sorted key=value
 * string from the load-bearing deal fields (the ones that define the agreement)
 * and sha256 it. amount is normalized via Decimal#toString to avoid float drift.
 */
export function hashDealTerms(input: {
  title: string;
  description?: string | null;
  type: string;
  amount: Prisma.Decimal | string;
  token: string;
  deadline?: Date | null;
}): string {
  const norm = (value: string) => value.normalize('NFC').replace(/\r\n/g, '\n').trim();
  const fields: Record<string, string> = {
    amount: amountToString(input.amount),
    deadline: input.deadline ? input.deadline.toISOString() : '',
    description: norm(input.description ?? ''),
    title: norm(input.title),
    token: norm(input.token),
    type: norm(input.type),
  };
  const canonical = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function getEventForAction(action: DealAction): string {
  const map: Partial<Record<DealAction, string>> = {
    publish: DealEvent.DealPublished,
    'open-invitation': DealEvent.DealInvitationOpened,
    'verify-wallets': DealEvent.WalletVerified,
    cancel: DealEvent.DealCancelled,
  };
  return map[action] ?? `deal.${action}`;
}
