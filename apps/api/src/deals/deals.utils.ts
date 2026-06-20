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
  switch (action) {
    case 'publish':
      return DealEvent.DealPublished;
    case 'open-invitation':
      return DealEvent.DealInvitationOpened;
    case 'verify-wallets':
      return DealEvent.WalletVerified;
    case 'cancel':
      return DealEvent.DealCancelled;
  }
}
