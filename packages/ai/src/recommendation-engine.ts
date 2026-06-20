import { LLMClient } from './llm';

export interface DealRecommendation {
  dealId: string;
  score: number;
  reason: string;
}

export interface UserRecommendations {
  recommendedDeals: DealRecommendation[];
  suggestedConnections: Array<{
    wallet: string;
    reason: string;
    compatibilityScore: number;
  }>;
  riskAlerts: Array<{
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

const RECOMMENDATION_PROMPT = `You are a recommendation engine for a decentralized escrow platform.
Based on user profile and history, recommend deals and connections. Return JSON:
{
  "recommendedDeals": [{ "dealId": "string", "score": 0-100, "reason": "string" }],
  "suggestedConnections": [{ "wallet": "string", "reason": "string", "compatibilityScore": 0-100 }],
  "riskAlerts": [{ "type": "string", "message": "string", "severity": "low|medium|high" }]
}
`;

export async function getRecommendations(
  client: LLMClient,
  userProfile: Record<string, unknown>,
  dealHistory: Record<string, unknown>[],
): Promise<UserRecommendations> {
  return client.chatWithJSON<UserRecommendations>(
    [{
      role: 'user',
      content: `${RECOMMENDATION_PROMPT}\n\nUser Profile:\n${JSON.stringify(userProfile, null, 2)}\n\nDeal History:\n${JSON.stringify(dealHistory, null, 2)}`,
    }],
    { temperature: 0.3 },
  );
}