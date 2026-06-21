import {
  scoreToLevel,
  type DealStatus,
  type RiskLevel,
  type ScamIntent,
} from '@trustroom/types';
import { SCAM_RULES, type ScamRule } from './rules.js';
import { findExternalAddresses } from './wallet.js';

/** Intents that are dangerous enough to penalize on repetition (technical brief §5.7). */
const REPEATABLE_INTENTS: ScamIntent[] = [
  'early_release_request',
  'move_off_platform',
  'fake_payment_proof',
  'credential_request',
  'external_wallet',
  'time_pressure',
  'impersonation',
];

/** Per-repeat penalty and cap for a single repeated intent. */
const REPETITION_STEP = 10;
const REPETITION_PER_INTENT_CAP = 30;
const REPETITION_TOTAL_CAP = 40;

/** Normalize transcript text for keyword matching (lowercase, collapse whitespace). */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

export interface RuleHit {
  rule: ScamRule;
  matchedKeyword: string | null;
}

/**
 * Run the deterministic rule layer over a single transcript chunk.
 * Deal state gates state-sensitive rules (e.g. early-release is only risky before
 * delivery is submitted).
 *
 * `knownWallets` (optional) is the set of wallet addresses that legitimately belong
 * to the deal (buyer / seller / escrow). When provided, any Solana address found in
 * the text that is NOT in that set fires the EXTERNAL_WALLET rule. When omitted, the
 * external-wallet check is skipped entirely (backward-compatible behavior).
 */
export function runRules(
  text: string,
  dealStatus: DealStatus,
  knownWallets?: string[],
): RuleHit[] {
  const normalized = normalize(text);
  const hits: RuleHit[] = [];

  for (const rule of SCAM_RULES) {
    // State-gated rules: the risky action is only suspicious BEFORE the deal reaches
    // a safe state. If we're already in one of those safe states, skip the rule.
    if (rule.invalidBeforeStates?.includes(dealStatus)) {
      continue;
    }

    // EXTERNAL_WALLET has no keyword list — it fires from address extraction, and
    // only when a caller supplies the deal's known wallets to compare against.
    if (rule.ruleId === 'EXTERNAL_WALLET') {
      if (knownWallets && knownWallets.length > 0) {
        const external = findExternalAddresses(text, knownWallets);
        if (external.length > 0) {
          hits.push({ rule, matchedKeyword: external[0]! });
        }
      }
      continue;
    }

    if (rule.keywords?.length) {
      const matched = rule.keywords.find((k) => normalized.includes(normalize(k)));
      if (matched) {
        hits.push({ rule, matchedKeyword: matched });
      }
    }
  }
  return hits;
}

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  hits: RuleHit[];
}

const LEVEL_ORDER: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

function maxLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  return LEVEL_ORDER.indexOf(a) >= LEVEL_ORDER.indexOf(b) ? a : b;
}

/**
 * Aggregate rule hits into a final score/level. This is the conversation-risk
 * component only; the full aggregator (technical brief §5.7) also folds in
 * wallet risk, escrow-state risk, evidence risk, and a repetition penalty.
 *
 * The level is the MAX of the score-derived level and the highest per-rule
 * severity — so a single high-severity rule (e.g. early-release at 40 pts, or a
 * critical credential request) is never under-reported just because its raw
 * score sits in a lower band.
 */
export function aggregateRisk(hits: RuleHit[]): RiskAssessment {
  const score = Math.min(
    100,
    hits.reduce((sum, h) => sum + h.rule.score, 0),
  );
  const level = hits.reduce<RiskLevel>(
    (lvl, h) => maxLevel(lvl, h.rule.riskLevel),
    scoreToLevel(score),
  );
  return { score, level, hits };
}

/**
 * Repetition penalty (technical brief §5.7). When the same dangerous intent shows
 * up again in the conversation, the manipulation signal is stronger than a one-off
 * mention — so we add a penalty that scales with how many times each dangerous
 * intent has fired across the whole conversation.
 *
 * Counting model: for each dangerous intent, total occurrences = prior + current.
 * Every occurrence BEYOND the first contributes {@link REPETITION_STEP} points,
 * capped per-intent and then capped overall. A single first-time hit yields 0.
 *
 * @param currentIntents intents that fired on the current message
 * @param priorIntents   intents seen earlier in the conversation (flat history)
 */
export function repetitionPenalty(
  currentIntents: ScamIntent[],
  priorIntents: ScamIntent[] = [],
): number {
  const counts = new Map<ScamIntent, number>();
  for (const intent of [...priorIntents, ...currentIntents]) {
    if (!REPEATABLE_INTENTS.includes(intent)) continue;
    counts.set(intent, (counts.get(intent) ?? 0) + 1);
  }

  let penalty = 0;
  for (const occurrences of counts.values()) {
    const repeats = Math.max(0, occurrences - 1);
    penalty += Math.min(repeats * REPETITION_STEP, REPETITION_PER_INTENT_CAP);
  }
  return Math.min(penalty, REPETITION_TOTAL_CAP);
}

export interface FullRiskInput {
  /** Rule hits from the current message (conversation_risk component). */
  conversationHits: RuleHit[];
  /** Wallet risk (e.g. new wallet / no deal history). Default 0. */
  walletRisk?: number;
  /** Escrow-state risk (state-machine sensitive risk). Default 0. */
  escrowStateRisk?: number;
  /** Evidence risk (unverified delivery, fake proof signals). Default 0. */
  evidenceRisk?: number;
  /** Repetition penalty (see {@link repetitionPenalty}). Default 0. */
  repetitionPenalty?: number;
}

export interface FullRiskAssessment extends RiskAssessment {
  /** Per-component breakdown for explainability / UI. */
  components: {
    conversationRisk: number;
    walletRisk: number;
    escrowStateRisk: number;
    evidenceRisk: number;
    repetitionPenalty: number;
  };
}

/**
 * Full risk aggregator (technical brief §5.7):
 *
 *   score = conversation_risk + wallet_risk + escrow_state_risk
 *         + evidence_risk + repetition_penalty   (summed, capped at 100)
 *
 * The level is the MAX of the score-derived level and the highest per-rule severity
 * among the conversation hits, so a single critical rule (credential request,
 * external wallet) is never under-reported by a low cumulative score.
 *
 * AI/risk only WARNS — this never triggers a release/refund; callers decide.
 */
export function aggregateFullRisk(input: FullRiskInput): FullRiskAssessment {
  const hits = input.conversationHits;
  const conversationRisk = hits.reduce((sum, h) => sum + h.rule.score, 0);
  const walletRisk = Math.max(0, input.walletRisk ?? 0);
  const escrowStateRisk = Math.max(0, input.escrowStateRisk ?? 0);
  const evidenceRisk = Math.max(0, input.evidenceRisk ?? 0);
  const penalty = Math.max(0, input.repetitionPenalty ?? 0);

  const rawScore =
    conversationRisk + walletRisk + escrowStateRisk + evidenceRisk + penalty;
  const score = Math.min(100, rawScore);

  const level = hits.reduce<RiskLevel>(
    (lvl, h) => maxLevel(lvl, h.rule.riskLevel),
    scoreToLevel(score),
  );

  return {
    score,
    level,
    hits,
    components: {
      conversationRisk: Math.min(100, conversationRisk),
      walletRisk,
      escrowStateRisk,
      evidenceRisk,
      repetitionPenalty: penalty,
    },
  };
}

export interface TranscriptAnalysis {
  hits: RuleHit[];
  score: number;
  level: RiskLevel;
  intents: ScamIntent[];
}

/**
 * Convenience one-shot analyzer for API/UI consumption. Runs the deterministic
 * rule layer over a transcript chunk and aggregates the result into a flat
 * `{ hits, score, level, intents }` shape. `intents` is the de-duplicated list of
 * scam intents that fired, in rule-catalog order.
 */
export function analyzeTranscript(
  text: string,
  dealStatus: DealStatus,
  knownWallets?: string[],
): TranscriptAnalysis {
  const hits = runRules(text, dealStatus, knownWallets);
  const { score, level } = aggregateRisk(hits);
  const intents = Array.from(new Set(hits.map((h) => h.rule.intent)));
  return { hits, score, level, intents };
}
