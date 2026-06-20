import { LLMClient } from './llm';

export interface ScamDetectionResult {
  isScam: boolean;
  confidence: number; // 0-1
  flags: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
  }>;
  analysis: string;
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

export async function detectScam(
  client: LLMClient,
  dealDescription: string,
): Promise<ScamDetectionResult> {
  const result = await client.chatWithJSON<ScamDetectionResult>(
    [{ role: 'user', content: `${SCAM_DETECTION_PROMPT}\n\nDeal description:\n${dealDescription}` }],
    { temperature: 0.1 },
  );

  return {
    ...result,
    confidence: Math.max(0, Math.min(1, result.confidence)),
  };
}