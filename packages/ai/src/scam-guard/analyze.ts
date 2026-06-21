import { type DealStatus, type ScamIntent } from '@trustroom/types';
import type { LLMClient } from '../llm.js';
import {
  aggregate,
  ESCROW_THREAT_INTENTS,
  type AggregateResult,
  type ComponentRisk,
  type RiskSignal,
} from './aggregator.js';
import { runRules } from './detect.js';
import { scoreEscrowStateRisk } from './deal-state.js';
import { scoreEvidenceRisk, type EvidenceItem } from './evidence-risk.js';
import { classifyIntents } from './llm-classifier.js';
import { suggestedActionFor } from './rules.js';
import { parseWalletsAndLinks } from './wallet-parser.js';
import { scoreWalletRisk, type WalletRiskProfile } from './wallet-risk.js';

/**
 * Full-context Scam Guard analyzer. Runs every detection layer over one message
 * and aggregates them into a single explainable verdict:
 *
 *   rules → wallet/link parser → (optional) LLM intent classifier
 *         → wallet risk → escrow-state risk → evidence risk → repetition penalty
 *         → risk aggregator
 *
 * Use `analyzeMessageSync` on the hot path (no network) and `analyzeMessage`
 * when an LLM client is available for semantic coverage of paraphrased scams.
 */

export interface ScamAnalysisInput {
  message: string;
  dealStatus: DealStatus;

  dealId?: string;
  speakerId?: string;
  speakerRole?: 'buyer' | 'seller' | 'ai' | 'system';
  timestamp?: string;
  escrowState?: string;

  /** Verified wallets for this deal — anything else found in chat is "external". */
  knownAddresses?: Array<string | null | undefined>;
  /** The confirmed deal terms (passed to the LLM classifier as context). */
  confirmedTerms?: Record<string, unknown> | null;
  /** On-chain / internal risk profile of the counterparty wallet. */
  walletProfile?: WalletRiskProfile;
  /** Evidence supplied so far (payment/delivery proofs). */
  evidence?: EvidenceItem[];

  /** Intents already detected earlier in this deal — drives the repetition penalty. */
  priorIntents?: ScamIntent[];
  /** Recent message texts for LLM context (most recent last). */
  recentMessages?: string[];
}

export interface ScamAnalysisResult extends AggregateResult {
  dealId: string | null;
  intents: ScamIntent[];
  /** Echoes the trigger for the Evidence Vault / timeline. */
  triggerText: string;
}

const RULE_CONFIDENCE = 0.85;

function ruleSignals(input: ScamAnalysisInput): RiskSignal[] {
  return runRules(input.message, input.dealStatus).map((hit) => ({
    intent: hit.rule.intent,
    riskLevel: hit.rule.riskLevel,
    score: hit.rule.score,
    confidence: RULE_CONFIDENCE,
    reason: hit.rule.message,
    suggestedAction: suggestedActionFor(hit.rule.intent),
    source: 'rule',
    escrowThreat: hit.rule.escrowThreat ?? false,
    evidence: {
      speaker: input.speakerId ?? input.speakerRole,
      message: input.message,
      matchedKeyword: hit.matchedKeyword,
      timestamp: input.timestamp,
    },
  }));
}

function walletAndLinkSignals(input: ScamAnalysisInput): RiskSignal[] {
  const parsed = parseWalletsAndLinks({
    text: input.message,
    knownAddresses: input.knownAddresses,
  });

  const signals: RiskSignal[] = [];

  for (const address of parsed.externalAddresses) {
    signals.push({
      intent: 'external_wallet',
      riskLevel: 'critical',
      score: 80,
      confidence: 0.9,
      reason: `Wallet address ${address} is not part of the verified deal/escrow.`,
      suggestedAction: suggestedActionFor('external_wallet'),
      source: 'wallet-parser',
      escrowThreat: true,
      evidence: {
        speaker: input.speakerId ?? input.speakerRole,
        message: input.message,
        address,
        timestamp: input.timestamp,
      },
    });
  }

  for (const url of parsed.suspiciousUrls) {
    signals.push({
      intent: 'phishing_link',
      riskLevel: 'high',
      score: 35,
      confidence: 0.75,
      reason: url.reason ?? 'Suspicious link detected.',
      suggestedAction: suggestedActionFor('phishing_link'),
      source: 'wallet-parser',
      escrowThreat: true,
      evidence: {
        speaker: input.speakerId ?? input.speakerRole,
        message: input.message,
        url: url.url,
        timestamp: input.timestamp,
      },
    });
  }

  return signals;
}

/** Repetition penalty (§6.1): repeating a flagged behavior compounds risk. */
function scoreRepetition(
  currentIntents: ScamIntent[],
  priorIntents: ScamIntent[] = [],
): ComponentRisk {
  if (priorIntents.length === 0) return { score: 0, reasons: [] };

  const reasons: string[] = [];
  let score = 0;
  const counted = new Set<ScamIntent>();

  for (const intent of currentIntents) {
    if (counted.has(intent)) continue;
    const priorCount = priorIntents.filter((i) => i === intent).length;
    if (priorCount > 0) {
      counted.add(intent);
      const points = Math.min(30, 10 * priorCount);
      score += points;
      reasons.push(
        `Repeated "${intent}" behavior (${priorCount} prior occurrence${priorCount > 1 ? 's' : ''}).`,
      );
    }
  }

  return { score: Math.min(30, score), reasons };
}

/** Build the aggregate from a set of conversation signals + the rich context. */
function buildResult(input: ScamAnalysisInput, conversationSignals: RiskSignal[]): ScamAnalysisResult {
  const intents = Array.from(new Set(conversationSignals.map((s) => s.intent)));

  const walletRisk = scoreWalletRisk(input.walletProfile);
  const escrowStateRisk = scoreEscrowStateRisk(intents, input.dealStatus);
  const evidenceRisk = scoreEvidenceRisk({
    evidence: input.evidence,
    pressureToRelease: intents.includes('early_release_request'),
    claimsPaymentOrDelivery:
      intents.includes('fake_payment_proof') || intents.includes('unverified_delivery'),
  });
  const repetitionPenalty = scoreRepetition(intents, input.priorIntents);

  const result = aggregate({
    conversationSignals,
    walletRisk: { score: walletRisk.score, reasons: walletRisk.reasons },
    escrowStateRisk,
    evidenceRisk: { score: evidenceRisk.score, reasons: evidenceRisk.reasons },
    repetitionPenalty,
  });

  return {
    ...result,
    dealId: input.dealId ?? null,
    intents: result.signals.map((s) => s.intent),
    triggerText: input.message,
  };
}

/**
 * Synchronous full-context analysis (rules + wallet/link parser + wallet/escrow/
 * evidence/repetition risk). No network — safe for the realtime hot path.
 */
export function analyzeMessageSync(input: ScamAnalysisInput): ScamAnalysisResult {
  const conversationSignals = [...ruleSignals(input), ...walletAndLinkSignals(input)];
  return buildResult(input, conversationSignals);
}

/**
 * Full-context analysis including the LLM intent classifier. Degrades to exactly
 * `analyzeMessageSync` when no client/key is available or the LLM call fails.
 */
export async function analyzeMessage(
  input: ScamAnalysisInput,
  client?: LLMClient,
): Promise<ScamAnalysisResult> {
  const deterministic = [...ruleSignals(input), ...walletAndLinkSignals(input)];

  const llmSignals = await classifyIntents(client, input.message, {
    dealStatus: input.dealStatus,
    escrowState: input.escrowState,
    speakerRole: input.speakerRole,
    confirmedTerms: input.confirmedTerms,
    recentMessages: input.recentMessages,
  });

  const conversationSignals: RiskSignal[] = [
    ...deterministic,
    ...llmSignals.map((s) => ({
      intent: s.intent,
      riskLevel: s.riskLevel,
      score: s.scoreDelta,
      confidence: s.confidence,
      reason: s.reason,
      suggestedAction: suggestedActionFor(s.intent),
      source: 'llm' as const,
      escrowThreat: ESCROW_THREAT_INTENTS.has(s.intent),
      evidence: {
        speaker: input.speakerId ?? input.speakerRole,
        message: input.message,
        timestamp: input.timestamp,
      },
    })),
  ];

  return buildResult(input, conversationSignals);
}
