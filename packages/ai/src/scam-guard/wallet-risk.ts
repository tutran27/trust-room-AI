import { scoreToLevel, type RiskLevel } from '@trustroom/types';

/**
 * Wallet risk engine (technical brief §5.6 / plan §3.12, §6.1). MVP is a
 * transparent, additive rule-based score over on-chain + internal-history
 * features. Every contributing factor is returned as a human-readable reason so
 * the warning explains WHY a wallet is risky, never an opaque number.
 */

export interface WalletRiskProfile {
  /** Age of the wallet in days (on-chain first-seen). */
  walletAgeDays?: number;
  /** Total number of on-chain transactions. */
  txCount?: number;
  /** Total lifetime volume in USD. */
  totalVolumeUsd?: number;
  /** Deals completed on this platform. */
  completedDeals?: number;
  disputeCount?: number;
  refundCount?: number;
  /** This wallet has itself been reported. */
  isReportedWallet?: boolean;
  /** Count of linked wallets that have been reported. */
  linkedReportedWallets?: number;
  /**
   * Qualitative inflow/outflow velocity. "high" = receives then immediately
   * forwards funds (a classic mule pattern).
   */
  inflowOutflowVelocity?: 'low' | 'medium' | 'high';
}

export interface WalletRiskResult {
  score: number;
  level: RiskLevel;
  reasons: string[];
  factors: string[];
}

interface Factor {
  test: (p: WalletRiskProfile) => boolean;
  points: number;
  factor: string;
  reason: string;
}

const FACTORS: Factor[] = [
  {
    test: (p) => p.walletAgeDays !== undefined && p.walletAgeDays < 7,
    points: 10,
    factor: 'new_wallet',
    reason: 'Wallet is less than 7 days old.',
  },
  {
    test: (p) => p.completedDeals !== undefined && p.completedDeals === 0,
    points: 10,
    factor: 'no_deal_history',
    reason: 'Wallet has no completed deal history on the platform.',
  },
  {
    test: (p) => p.txCount !== undefined && p.txCount < 10,
    points: 5,
    factor: 'low_activity',
    reason: 'Wallet has very few on-chain transactions.',
  },
  {
    test: (p) => (p.disputeCount ?? 0) >= 1,
    points: 15,
    factor: 'prior_disputes',
    reason: 'Wallet has been involved in prior disputes.',
  },
  {
    test: (p) => (p.refundCount ?? 0) >= 2,
    points: 10,
    factor: 'repeated_refunds',
    reason: 'Wallet has an unusual number of prior refunds.',
  },
  {
    test: (p) => p.isReportedWallet === true,
    points: 40,
    factor: 'reported_wallet',
    reason: 'This wallet has been reported for suspicious activity.',
  },
  {
    test: (p) => (p.linkedReportedWallets ?? 0) >= 1,
    points: 20,
    factor: 'linked_to_reported',
    reason: 'Wallet is linked to one or more reported wallets.',
  },
  {
    test: (p) => p.inflowOutflowVelocity === 'high',
    points: 15,
    factor: 'mule_velocity',
    reason: 'Wallet receives and immediately forwards funds (mule-like pattern).',
  },
];

/**
 * Score a wallet from its risk profile. Returns 0 with no reasons when the profile
 * is empty/unknown — absence of data is not treated as risk on its own.
 */
export function scoreWalletRisk(profile?: WalletRiskProfile): WalletRiskResult {
  if (!profile) {
    return { score: 0, level: 'low', reasons: [], factors: [] };
  }

  const reasons: string[] = [];
  const factors: string[] = [];
  let score = 0;

  for (const f of FACTORS) {
    if (f.test(profile)) {
      score += f.points;
      reasons.push(f.reason);
      factors.push(f.factor);
    }
  }

  score = Math.min(100, score);
  return { score, level: scoreToLevel(score), reasons, factors };
}
