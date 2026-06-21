import { describe, expect, it } from 'vitest';
import type { WalletOnChainActivity } from '@trustroom/solana';
import { scoreWalletRisk, type WalletInternalHistory } from './wallet-risk.scoring';

const wallet = '11111111111111111111111111111111';

function history(overrides: Partial<WalletInternalHistory> = {}): WalletInternalHistory {
  return {
    completedDeals: 5,
    successfulDeals: 5,
    disputedDeals: 0,
    participatedDeals: 5,
    ...overrides,
  };
}

function activity(overrides: Partial<WalletOnChainActivity> = {}): WalletOnChainActivity {
  return {
    available: true,
    signatureCount: 50,
    oldestBlockTime: Math.floor(Date.now() / 1000) - 200 * 86400,
    ageDays: 200,
    reachedLimit: false,
    ...overrides,
  };
}

describe('scoreWalletRisk', () => {
  it('returns low risk for an established wallet with clean history', () => {
    const result = scoreWalletRisk(wallet, history(), activity());
    expect(result.riskScore).toBe(0);
    expect(result.riskLevel).toBe('low');
    expect(result.reasons).toContain('No notable risk signals detected');
  });

  it('adds points and a reason when there are no completed deals', () => {
    const result = scoreWalletRisk(
      wallet,
      history({ completedDeals: 0, successfulDeals: 0, participatedDeals: 3 }),
      activity(),
    );
    expect(result.riskScore).toBe(10);
    expect(result.reasons).toContain('No completed deals on TrustRoom AI');
  });

  it('flags a brand-new wallet with no platform footprint', () => {
    const result = scoreWalletRisk(
      wallet,
      history({ completedDeals: 0, successfulDeals: 0, participatedDeals: 0 }),
      activity(),
    );
    // 10 (no completed) + 5 (no participation)
    expect(result.riskScore).toBe(15);
    expect(result.reasons).toContain('No completed deals on TrustRoom AI');
    expect(result.reasons).toContain('No prior deal activity on TrustRoom AI');
  });

  it('penalizes disputes, escalating with count and capping at 40', () => {
    const one = scoreWalletRisk(wallet, history({ disputedDeals: 1 }), activity());
    expect(one.riskScore).toBe(20);
    expect(one.reasons).toContain('1 disputed deal in history');

    const many = scoreWalletRisk(wallet, history({ disputedDeals: 10 }), activity());
    // base penalty caps at 40; clean otherwise
    expect(many.riskScore).toBe(40);
    expect(many.reasons).toContain('10 disputed deals in history');
  });

  it('adds risk for a recently created, low-activity wallet', () => {
    const result = scoreWalletRisk(
      wallet,
      history(),
      activity({ ageDays: 2, signatureCount: 3, oldestBlockTime: Math.floor(Date.now() / 1000) - 2 * 86400 }),
    );
    // 15 (age < 7d) + 15 (< 5 tx)
    expect(result.riskScore).toBe(30);
    expect(result.riskLevel).toBe('medium');
    expect(result.reasons).toContain('Wallet created recently (less than a week ago)');
    expect(result.reasons).toContain('Only 3 transactions found');
  });

  it('reports no transactions when signature count is zero', () => {
    const result = scoreWalletRisk(
      wallet,
      history(),
      activity({ ageDays: null, oldestBlockTime: null, signatureCount: 0 }),
    );
    expect(result.reasons).toContain('No transactions found on-chain');
    expect(result.riskScore).toBe(15);
  });

  it('degrades gracefully when on-chain check is unavailable', () => {
    const result = scoreWalletRisk(
      wallet,
      history({ completedDeals: 0, successfulDeals: 0, participatedDeals: 0 }),
      {
        available: false,
        signatureCount: null,
        oldestBlockTime: null,
        ageDays: null,
        reachedLimit: false,
        error: 'timeout',
      },
    );
    // internal-only: 10 + 5; plus the explanatory reason
    expect(result.riskScore).toBe(15);
    expect(result.reasons).toContain('On-chain check unavailable');
  });

  it('does not add tx-count risk when the signature limit was reached (count is a lower bound)', () => {
    const result = scoreWalletRisk(
      wallet,
      history(),
      activity({ signatureCount: 100, reachedLimit: true }),
    );
    expect(result.riskScore).toBe(0);
    expect(result.reasons).toContain('No notable risk signals detected');
  });

  it('caps the total risk score at 100', () => {
    const result = scoreWalletRisk(
      wallet,
      history({ completedDeals: 0, successfulDeals: 0, disputedDeals: 10, participatedDeals: 0 }),
      activity({ ageDays: 1, signatureCount: 0, oldestBlockTime: Math.floor(Date.now() / 1000) - 86400, reachedLimit: false }),
    );
    expect(result.riskScore).toBeLessThanOrEqual(100);
    expect(result.riskLevel).toBe('critical');
  });
});
