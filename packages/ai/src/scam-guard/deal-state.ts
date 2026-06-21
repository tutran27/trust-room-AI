import { type DealStatus, type RiskLevel, type ScamIntent } from '@trustroom/types';

/**
 * Deal-state checker (technical brief §5.5). Adds *escrow-state risk*: the same
 * sentence is more or less dangerous depending on where the deal is in its
 * lifecycle. e.g. an early-release request is critical while funded but harmless
 * once delivery is verified.
 *
 * This is intentionally separate from the keyword rule's `invalidBeforeStates`
 * gate: the gate decides whether the rule fires at all; this layer adds an
 * additional contextual score on top when the deal is in an especially exposed
 * state (funds locked, terms confirmed).
 */

/** Deal states where buyer funds are locked in escrow and directly at risk. */
const FUNDS_LOCKED_STATES = new Set<DealStatus>([
  'Deposited',
  'Negotiating',
  'TermsConfirmed',
  'DeliverySubmitted',
]);

/** Deal states where the agreed terms are locked and changes are suspicious. */
const TERMS_LOCKED_STATES = new Set<DealStatus>([
  'TermsConfirmed',
  'DeliverySubmitted',
  'ReadyToRelease',
]);

/** Deal states where releasing now would be premature (no verified delivery). */
const PRE_DELIVERY_STATES = new Set<DealStatus>([
  'Deposited',
  'Negotiating',
  'TermsConfirmed',
]);

export interface EscrowStateRisk {
  score: number;
  level: RiskLevel;
  reasons: string[];
}

/**
 * Compute escrow-state risk from the set of detected intents and the current
 * deal status. Returns additive points (0 when the state is not exposed to the
 * detected intents).
 */
export function scoreEscrowStateRisk(
  intents: ScamIntent[],
  dealStatus: DealStatus,
): EscrowStateRisk {
  const reasons: string[] = [];
  let score = 0;
  const has = (i: ScamIntent) => intents.includes(i);

  const fundsLocked = FUNDS_LOCKED_STATES.has(dealStatus);
  const termsLocked = TERMS_LOCKED_STATES.has(dealStatus);
  const preDelivery = PRE_DELIVERY_STATES.has(dealStatus);

  if ((has('early_release_request') || has('unverified_delivery')) && preDelivery) {
    score += 25;
    reasons.push(
      `Release/delivery is being pushed while the deal is "${dealStatus}" (before delivery is verified).`,
    );
  }

  if ((has('external_wallet') || has('split_payment')) && fundsLocked) {
    score += 20;
    reasons.push(
      `An out-of-escrow payment is suggested while funds are locked ("${dealStatus}").`,
    );
  }

  if (has('term_change_after_deposit') && termsLocked) {
    score += 25;
    reasons.push(
      `Terms are being changed after they were confirmed ("${dealStatus}") — requires a re-signed amendment.`,
    );
  }

  if (has('move_off_platform') && fundsLocked) {
    score += 15;
    reasons.push(
      `Counterparty wants to move off-platform while escrow funds are locked ("${dealStatus}").`,
    );
  }

  return { score: Math.min(100, score), level: 'low', reasons };
}
