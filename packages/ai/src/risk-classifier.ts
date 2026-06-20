import { LLMClient } from './llm';

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

export async function classifyRisk(
  client: LLMClient,
  deal: DealProfile,
): Promise<RiskClassificationResult> {
  const dealContext = JSON.stringify(deal, null, 2);
  const result = await client.chatWithJSON<RiskClassificationResult>(
    [{ role: 'user', content: `${RISK_CLASSIFICATION_PROMPT}\n\nDeal:\n${dealContext}` }],
    { temperature: 0.2 },
  );

  return {
    ...result,
    score: Math.max(0, Math.min(100, result.score)),
  };
}
