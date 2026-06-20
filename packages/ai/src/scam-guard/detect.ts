import {
  scoreToLevel,
  type DealStatus,
  type RiskLevel,
  type ScamIntent,
} from '@trustroom/types';
import { SCAM_RULES, type ScamRule } from './rules.js';

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
 */
export function runRules(text: string, dealStatus: DealStatus): RuleHit[] {
  const normalized = normalize(text);
  const hits: RuleHit[] = [];

  for (const rule of SCAM_RULES) {
    // State-gated rules: the risky action is only suspicious BEFORE the deal reaches
    // a safe state. If we're already in one of those safe states, skip the rule.
    if (rule.invalidBeforeStates?.includes(dealStatus)) {
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
): TranscriptAnalysis {
  const hits = runRules(text, dealStatus);
  const { score, level } = aggregateRisk(hits);
  const intents = Array.from(new Set(hits.map((h) => h.rule.intent)));
  return { hits, score, level, intents };
}
