import { LLMClient } from './llm.js';
import { analyzeTranscript } from './scam-guard/detect.js';

export interface ScamDetectionResult {
  isScam: boolean;
  confidence: number; // 0-1
  flags: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
  }>;
  analysis: string;
  /** Distinguishes a real LLM detection from the deterministic heuristic fallback. */
  source: 'llm' | 'heuristic';
}

const SCAM_DETECTION_PROMPT = `You are a scam detection specialist for a decentralized escrow platform.
Analyze the following deal description for scam indicators. Return a JSON object with:
{
  "isScam": boolean,
  "confidence": 0.0-1.0,
  "flags": [{ "type": "flag type", "severity": "low|medium|high|critical", "description": "detail" }],
  "analysis": "detailed analysis of scam indicators"
}

Red flags to look for:
- Unrealistic promises or returns
- Pressure to act quickly
- Requests to move funds off-platform
- Vague or shifting deliverables
- New accounts with no history
- Impersonation of known entities
- Too-good-to-be-true terms
`;

/**
 * Deterministic scam detection driven by the scam-guard rule engine. Maps fired
 * rules to flags and derives an isScam/confidence verdict from the aggregate
 * level. No network, never throws.
 */
export function detectScamHeuristic(dealDescription: string): ScamDetectionResult {
  const { hits, level } = analyzeTranscript(dealDescription ?? '', 'Negotiating');

  const flags: ScamDetectionResult['flags'] = hits.map((hit) => ({
    type: hit.rule.intent,
    severity: hit.rule.riskLevel,
    description: hit.rule.message,
  }));

  const isScam = level === 'high' || level === 'critical';
  // Confidence scales with severity; deterministic and explainable.
  const confidence =
    level === 'critical' ? 0.9 : level === 'high' ? 0.7 : level === 'medium' ? 0.4 : 0.1;

  const analysis = hits.length
    ? `Rule-based scam guard fired ${hits.length} rule(s): ${hits
        .map((h) => h.rule.ruleId)
        .join(', ')}. Highest severity: ${level}.`
    : 'No deterministic scam-rule indicators detected in the provided text.';

  return {
    isScam,
    confidence,
    flags,
    analysis,
    source: 'heuristic',
  };
}

export async function detectScam(
  client: LLMClient,
  dealDescription: string,
): Promise<ScamDetectionResult> {
  if (!client.isConfigured()) {
    return detectScamHeuristic(dealDescription);
  }

  try {
    const result = await client.chatWithJSON<ScamDetectionResult>(
      [{ role: 'user', content: `${SCAM_DETECTION_PROMPT}\n\nDeal description:\n${dealDescription}` }],
      { temperature: 0.1 },
    );

    return {
      ...result,
      confidence: Math.max(0, Math.min(1, result.confidence)),
      source: 'llm',
    };
  } catch {
    return detectScamHeuristic(dealDescription);
  }
}
