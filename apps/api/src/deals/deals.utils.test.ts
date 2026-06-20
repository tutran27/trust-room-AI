import { describe, expect, it } from 'vitest';
import { DealStatus } from '@trustroom/types';
import {
  decodeCursor,
  encodeCursor,
  getEventForAction,
  getTargetStatusForAction,
} from './deals.utils';

describe('deals.utils', () => {
  it('encodes and decodes cursor payloads', () => {
    const value = {
      updatedAt: new Date('2026-06-20T12:00:00.000Z'),
      id: 'deal_123',
    };

    expect(decodeCursor(encodeCursor(value))).toEqual(value);
  });

  it('maps actions to legal target statuses', () => {
    expect(
      getTargetStatusForAction(DealStatus.Draft, 'publish'),
    ).toBe(DealStatus.Created);
    expect(
      getTargetStatusForAction(DealStatus.Created, 'open-invitation'),
    ).toBe(DealStatus.WaitingForCounterparty);
    expect(
      getTargetStatusForAction(DealStatus.WaitingForCounterparty, 'verify-wallets'),
    ).toBe(DealStatus.WalletVerified);
    expect(
      getTargetStatusForAction(DealStatus.Deposited, 'cancel'),
    ).toBeNull();
  });

  it('maps actions to canonical event vocabulary', () => {
    expect(getEventForAction('publish')).toBe('deal.published');
    expect(getEventForAction('open-invitation')).toBe('deal.invitation_opened');
    expect(getEventForAction('verify-wallets')).toBe('wallet.verified');
    expect(getEventForAction('cancel')).toBe('deal.cancelled');
  });
});
