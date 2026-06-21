import { type RiskLevel } from '@trustroom/types';

/**
 * Evidence verification engine (technical brief §5.7, plan §3.3 / §3.11).
 *
 * MVP rule: a screenshot / text claim is NEVER sufficient proof of payment or
 * delivery — only an on-chain transaction hash (or a verified file/NFT transfer)
 * counts. When a counterparty pushes for release while the only "evidence" is an
 * unverified screenshot, this layer raises evidence risk.
 */

export type EvidenceKind =
  | 'tx_hash'
  | 'nft_transfer'
  | 'token_transfer'
  | 'file'
  | 'screenshot'
  | 'email'
  | 'link'
  | 'text';

export interface EvidenceItem {
  kind: EvidenceKind;
  /** Whether this item has been independently verified (on-chain / hash check). */
  verified?: boolean;
}

/** Evidence kinds that can constitute final proof once verified. */
const STRONG_KINDS = new Set<EvidenceKind>(['tx_hash', 'nft_transfer', 'token_transfer', 'file']);

/** Evidence kinds that are only ever a weak/secondary signal. */
const WEAK_KINDS = new Set<EvidenceKind>(['screenshot', 'email', 'text', 'link']);

export interface EvidenceRiskInput {
  /** Evidence the counterparty has supplied so far for this deal. */
  evidence?: EvidenceItem[];
  /** True when the current message is pressuring the user to release/act now. */
  pressureToRelease?: boolean;
  /** True when payment/delivery is being claimed in the message. */
  claimsPaymentOrDelivery?: boolean;
}

export interface EvidenceRiskResult {
  score: number;
  level: RiskLevel;
  reasons: string[];
  /** True when no strong (verified) evidence backs the claim. */
  unverified: boolean;
}

/**
 * Score evidence risk. Returns 0 when there is no payment/delivery claim and no
 * release pressure — evidence risk only matters when someone is asking to act on
 * a claim.
 */
export function scoreEvidenceRisk(input: EvidenceRiskInput): EvidenceRiskResult {
  const evidence = input.evidence ?? [];
  const reasons: string[] = [];

  const hasStrongVerified = evidence.some((e) => STRONG_KINDS.has(e.kind) && e.verified);
  const hasWeakOnly =
    evidence.length > 0 && evidence.every((e) => WEAK_KINDS.has(e.kind) || !e.verified);

  const claiming = input.claimsPaymentOrDelivery || input.pressureToRelease;
  if (!claiming) {
    return { score: 0, level: 'low', reasons: [], unverified: !hasStrongVerified };
  }

  let score = 0;

  if (hasStrongVerified) {
    return { score: 0, level: 'low', reasons: ['Claim is backed by verified on-chain evidence.'], unverified: false };
  }

  if (evidence.some((e) => WEAK_KINDS.has(e.kind)) && hasWeakOnly) {
    score += 20;
    reasons.push('Only a screenshot/text was provided — not valid proof of an on-chain payment.');
  } else if (evidence.length === 0 && input.pressureToRelease) {
    score += 20;
    reasons.push('Release is being pushed with no delivery/payment proof attached.');
  } else if (!hasStrongVerified) {
    score += 15;
    reasons.push('No verified on-chain evidence backs this payment/delivery claim.');
  }

  return { score: Math.min(100, score), level: 'low', reasons, unverified: true };
}
