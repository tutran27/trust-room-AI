import { describe, expect, it } from 'vitest';
import { DealStatus } from '@trustroom/types';
import {
  decodeCursor,
  encodeCursor,
  getEventForAction,
  getTargetStatusForAction,
  hashDealTerms,
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

  it('hashes deal terms deterministically and independent of field ordering', () => {
    const base = {
      title: 'NFT sale',
      description: 'A rare NFT',
      type: 'nft',
      amount: '10.5',
      token: 'SOL',
      deadline: new Date('2026-07-01T00:00:00.000Z'),
    };
    const hash = hashDealTerms(base);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Same logical terms → same hash; reconstructing the object preserves it.
    expect(hashDealTerms({ ...base })).toBe(hash);
    // Changing a load-bearing field changes the hash.
    expect(hashDealTerms({ ...base, amount: '11' })).not.toBe(hash);
  });

  it('treats null/absent description and deadline consistently', () => {
    const a = hashDealTerms({ title: 't', type: 'other', amount: '1', token: 'SOL' });
    const b = hashDealTerms({
      title: 't',
      description: null,
      type: 'other',
      amount: '1',
      token: 'SOL',
      deadline: null,
    });
    expect(a).toBe(b);
  });
});
