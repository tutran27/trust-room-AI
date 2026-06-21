import { scoreToLevel, type RiskLevel } from '@trustroom/types';
import type { WalletOnChainActivity } from '@trustroom/solana';

/** Internal (DB-derived) deal history for a wallet on TrustRoom AI. */
export interface WalletInternalHistory {
  /** Total deals the wallet has completed on the platform. */
  completedDeals: number;
  /** Subset of completed deals that finished successfully. */
  successfulDeals: number;
  /** Deals the wallet was involved in that went to dispute. */
  disputedDeals: number;
  /** Total deals the wallet ever participated in (from DealParticipant), regardless of outcome. */
  participatedDeals: number;
}

export interface WalletRiskResult {
  wallet: string;
  riskScore: number;
  riskLevel: RiskLevel;
  reasons: string[];
}

const MAX_SCORE = 100;

/**
 * Pure, additive, explainable wallet-risk scorer. Combines internal deal
 * history with optional on-chain activity. Mirrors the MVP scoring table:
 * new wallet / no history +10, disputes increase score, very new or very
 * low-activity on-chain wallets add risk. Returns reasons[] for transparency
 * (warnings explain reasons, not opaque scores).
 */
export function scoreWalletRisk(
  wallet: string,
  history: WalletInternalHistory,
  activity: WalletOnChainActivity,
): WalletRiskResult {
  let score = 0;
  const reasons: string[] = [];

  // ── Internal: TrustRoom AI deal history ────────────────────────────
  if (history.completedDeals === 0) {
    score += 10;
    reasons.push('No completed deals on TrustRoom AI');
  }

  if (history.participatedDeals === 0) {
    // Brand-new wallet with no footprint at all on the platform.
    score += 5;
    reasons.push('No prior deal activity on TrustRoom AI');
  }

  if (history.disputedDeals > 0) {
    // Base penalty plus a per-dispute increment, capped so a single noisy
    // wallet cannot dominate the whole score.
    const disputePenalty = Math.min(20 + (history.disputedDeals - 1) * 10, 40);
    score += disputePenalty;
    reasons.push(
      history.disputedDeals === 1
        ? '1 disputed deal in history'
        : `${history.disputedDeals} disputed deals in history`,
    );
  }

  // ── On-chain: wallet age + transaction count ───────────────────────
  if (!activity.available) {
    reasons.push('On-chain check unavailable');
  } else {
    if (activity.ageDays !== null) {
      if (activity.ageDays < 7) {
        score += 15;
        reasons.push('Wallet created recently (less than a week ago)');
      } else if (activity.ageDays < 30) {
        score += 10;
        reasons.push('Wallet created recently (less than a month ago)');
      }
    } else if (activity.signatureCount !== null && activity.signatureCount > 0) {
      // We saw activity but no block time — treat age as unknown, mild signal.
      reasons.push('Wallet age could not be determined');
    }

    if (activity.signatureCount !== null && !activity.reachedLimit) {
      if (activity.signatureCount === 0) {
        score += 15;
        reasons.push('No transactions found on-chain');
      } else if (activity.signatureCount < 5) {
        score += 15;
        reasons.push(`Only ${activity.signatureCount} transactions found`);
      } else if (activity.signatureCount < 20) {
        score += 5;
        reasons.push(`Low on-chain activity (${activity.signatureCount} transactions)`);
      }
    }
  }

  const riskScore = Math.min(MAX_SCORE, score);
  if (reasons.length === 0) {
    reasons.push('No notable risk signals detected');
  }

  return {
    wallet,
    riskScore,
    riskLevel: scoreToLevel(riskScore),
    reasons,
  };
}
