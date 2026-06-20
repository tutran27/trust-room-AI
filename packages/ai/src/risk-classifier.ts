import { LLMClient } from './llm.js';
import { analyzeTranscript } from './scam-guard/detect.js';

export interface DealProfile {
  id?: string;
  title?: string;
  description?: string;
  amount?: string;
  token?: string;
  participants?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface RiskClassificationResult {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-100
  factors: Array<{
    name: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  recommendation: string;
  /** Distinguishes a real LLM classification from the deterministic heuristic fallback. */
  source: 'llm' | 'heuristic';
}

const RISK_CLASSIFICATION_PROMPT = `You are a risk assessment specialist for a decentralized escrow platform.
Analyze the following deal and classify its risk level. Return a JSON object with:
{
  "riskLevel": "low|medium|high|critical",
  "score": 0-100 numeric risk score,
  "factors": [{ "name": "factor name", "severity": "low|medium|high", "description": "why this matters" }],
  "recommendation": "actionable recommendation for this deal"
}

Consider: counterparty reputation, total value, deliverable ambiguity, timeline reasonableness, dispute history.
`;

/** Map a scam-guard critical level into the module's high|medium|low factor severity. */
function toFactorSeverity(level: string): 'low' | 'medium' | 'high' {
  if (level === 'critical' || level === 'high') return 'high';
  if (level === 'medium') return 'medium';
  return 'low';
}

/** Flatten a deal profile into a single text blob for keyword/rule analysis. */
function profileToText(deal: DealProfile): string {
  const parts: string[] = [];
  if (deal.title) parts.push(deal.title);
  if (deal.description) parts.push(deal.description);
  if (deal.amount) parts.push(`amount ${deal.amount}`);
  if (deal.token) parts.push(`token ${deal.token}`);
  // Include any other string-ish fields for keyword coverage.
  for (const [key, value] of Object.entries(deal)) {
    if (['title', 'description', 'amount', 'token', 'id'].includes(key)) continue;
    if (typeof value === 'string') parts.push(value);
  }
  return parts.join('\n');
}

/**
 * Deterministic risk classification driven by the scam-guard rule engine. Runs
 * the rule layer over the deal's text and maps the aggregate score/level into the
 * module's return shape. No network, never throws.
 */
export function classifyRiskHeuristic(deal: DealProfile): RiskClassificationResult {
  const text = profileToText(deal);
  // Deal state is unknown at classification time; use 'Negotiating' so all
  // pre-delivery rules (e.g. early-release) remain active.
  const { score, level, hits } = analyzeTranscript(text, 'Negotiating');

  const factors: RiskClassificationResult['factors'] = hits.map((hit) => ({
    name: hit.rule.ruleId,
    severity: toFactorSeverity(hit.rule.riskLevel),
    description: hit.rule.message,
  }));

  const recommendation =
    level === 'critical'
      ? 'Critical risk detected — block release and route to human review.'
      : level === 'high'
        ? 'High risk — require explicit confirmation and verify delivery before release.'
        : level === 'medium'
          ? 'Moderate risk — proceed with caution and keep evidence.'
          : 'No significant rule-based risk detected. Standard escrow safeguards apply.';

  return {
    riskLevel: level,
    score: Math.max(0, Math.min(100, score)),
    factors,
    recommendation,
    source: 'heuristic',
  };
}

export async function classifyRisk(
  client: LLMClient,
  deal: DealProfile,
): Promise<RiskClassificationResult> {
  if (!client.isConfigured()) {
    return classifyRiskHeuristic(deal);
  }

  try {
    const dealContext = JSON.stringify(deal, null, 2);
    const result = await client.chatWithJSON<RiskClassificationResult>(
      [{ role: 'user', content: `${RISK_CLASSIFICATION_PROMPT}\n\nDeal:\n${dealContext}` }],
      { temperature: 0.2 },
    );

    return {
      ...result,
      score: Math.max(0, Math.min(100, result.score)),
      source: 'llm',
    };
  } catch {
    return classifyRiskHeuristic(deal);
  }
}
