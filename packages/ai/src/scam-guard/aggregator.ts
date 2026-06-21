import {
  scoreToLevel,
  type RiskLevel,
  type ScamIntent,
} from '@trustroom/types';
import { maxLevel } from './detect.js';
import { suggestedActionFor } from './rules.js';

/**
 * Risk aggregator (technical brief §5.7 / plan §6). Combines the five risk
 * components into a single explainable verdict:
 *
 *   Final Risk Score =
 *     Conversation Risk + Wallet Risk + Escrow-State Risk + Evidence Risk + Repetition Penalty
 *
 * The AI only flags and recommends — `lockRelease`/`blockMessage` are UI hints the
 * frontend acts on; the system never moves funds autonomously.
 */

export type SignalSource =
  | 'rule'
  | 'llm'
  | 'wallet-parser'
  | 'wallet-risk'
  | 'deal-state'
  | 'evidence'
  | 'repetition';

/** A single intent-bearing risk detection from the conversation layers. */
export interface RiskSignal {
  intent: ScamIntent;
  riskLevel: RiskLevel;
  /** Base score contribution (0-100). */
  score: number;
  confidence: number;
  reason: string;
  suggestedAction: string;
  source: SignalSource;
  /** True when this intent directly threatens escrowed funds. */
  escrowThreat: boolean;
  evidence?: {
    speaker?: string;
    message?: string;
    matchedKeyword?: string | null;
    address?: string;
    url?: string;
    timestamp?: string;
  };
}

/** Intents that, when present at high/critical level, warrant locking Release. */
export const ESCROW_THREAT_INTENTS: ReadonlySet<ScamIntent> = new Set<ScamIntent>([
  'early_release_request',
  'external_wallet',
  'split_payment',
  'fake_payment_proof',
  'credential_request',
  'unverified_delivery',
  'move_off_platform',
]);

export interface ComponentRisk {
  score: number;
  reasons: string[];
}

export interface AggregateInput {
  conversationSignals: RiskSignal[];
  walletRisk?: ComponentRisk;
  escrowStateRisk?: ComponentRisk;
  evidenceRisk?: ComponentRisk;
  repetitionPenalty?: ComponentRisk;
}

export type UiAction =
  | 'log_only'
  | 'show_warning'
  | 'show_high_risk_popup_and_require_confirmation'
  | 'block_and_require_human_review';

export interface AggregateResult {
  signals: RiskSignal[];
  conversationRisk: number;
  walletRisk: number;
  escrowStateRisk: number;
  evidenceRisk: number;
  repetitionPenalty: number;
  finalScore: number;
  finalLevel: RiskLevel;
  suggestedAction: string;
  /** UI hint: temporarily lock the Release button. */
  lockRelease: boolean;
  /** UI hint: block the message from being delivered (e.g. seed phrase in chat). */
  blockMessage: boolean;
  uiAction: UiAction;
  reasons: string[];
}

const SEVERITY: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };

/**
 * De-duplicate conversation signals by intent, keeping the highest-scoring signal
 * per intent. This prevents the rule layer and the LLM layer both firing the same
 * intent from double-counting toward conversation risk.
 */
function dedupeByIntent(signals: RiskSignal[]): RiskSignal[] {
  const best = new Map<ScamIntent, RiskSignal>();
  for (const s of signals) {
    const existing = best.get(s.intent);
    if (!existing || s.score > existing.score) {
      best.set(s.intent, s);
    }
  }
  return Array.from(best.values());
}

function uiActionFor(level: RiskLevel): UiAction {
  switch (level) {
    case 'critical':
      return 'block_and_require_human_review';
    case 'high':
      return 'show_high_risk_popup_and_require_confirmation';
    case 'medium':
      return 'show_warning';
    default:
      return 'log_only';
  }
}

export function aggregate(input: AggregateInput): AggregateResult {
  const deduped = dedupeByIntent(input.conversationSignals);

  const conversationRisk = Math.min(
    100,
    deduped.reduce((sum, s) => sum + s.score, 0),
  );
  const walletRisk = input.walletRisk?.score ?? 0;
  const escrowStateRisk = input.escrowStateRisk?.score ?? 0;
  const evidenceRisk = input.evidenceRisk?.score ?? 0;
  const repetitionPenalty = input.repetitionPenalty?.score ?? 0;

  const finalScore = Math.min(
    100,
    conversationRisk + walletRisk + escrowStateRisk + evidenceRisk + repetitionPenalty,
  );

  // Level is the max of the score band and the highest individual signal severity,
  // so a lone critical signal (e.g. credential request) is never under-reported.
  const finalLevel = deduped.reduce<RiskLevel>(
    (lvl, s) => maxLevel(lvl, s.riskLevel),
    scoreToLevel(finalScore),
  );

  // Pick the highest-severity, then highest-score signal to drive the headline action.
  const headline = [...deduped].sort(
    (a, b) => SEVERITY[b.riskLevel] - SEVERITY[a.riskLevel] || b.score - a.score,
  )[0];

  const suggestedAction = headline
    ? suggestedActionFor(headline.intent)
    : 'Continue with normal caution. No specific scam indicators detected.';

  const escrowThreatPresent = deduped.some((s) => s.escrowThreat);
  const lockRelease =
    (finalLevel === 'high' || finalLevel === 'critical') && escrowThreatPresent;
  const blockMessage = deduped.some((s) => s.intent === 'credential_request');

  const reasons = [
    ...deduped.map((s) => s.reason),
    ...(input.walletRisk?.reasons ?? []),
    ...(input.escrowStateRisk?.reasons ?? []),
    ...(input.evidenceRisk?.reasons ?? []),
    ...(input.repetitionPenalty?.reasons ?? []),
  ];

  return {
    signals: deduped,
    conversationRisk,
    walletRisk,
    escrowStateRisk,
    evidenceRisk,
    repetitionPenalty,
    finalScore,
    finalLevel,
    suggestedAction,
    lockRelease,
    blockMessage,
    uiAction: uiActionFor(finalLevel),
    reasons,
  };
}
