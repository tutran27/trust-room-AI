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

export function getEventForAction(action: DealAction): string {
  const map: Partial<Record<DealAction, string>> = {
    publish: DealEvent.DealPublished,
    'open-invitation': DealEvent.DealInvitationOpened,
    'verify-wallets': DealEvent.WalletVerified,
    cancel: DealEvent.DealCancelled,
  };
  return map[action] ?? `deal.${action}`;
}
