import { LLMClient } from './llm.js';

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
  /** Distinguishes a real LLM recommendation from the deterministic heuristic fallback. */
  source: 'llm' | 'heuristic';
}

const RECOMMENDATION_PROMPT = `You are a recommendation engine for a decentralized escrow platform.
Based on user profile and history, recommend deals and connections. Return JSON:
{
  "recommendedDeals": [{ "dealId": "string", "score": 0-100, "reason": "string" }],
  "suggestedConnections": [{ "wallet": "string", "reason": "string", "compatibilityScore": 0-100 }],
  "riskAlerts": [{ "type": "string", "message": "string", "severity": "low|medium|high" }]
}
`;

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Deterministic recommendations from the user's own deal history. Surfaces recent
 * deals, derives connection suggestions from counterpart wallets, and raises a
 * thin-history alert. No network, never throws.
 */
export function getRecommendationsHeuristic(
  userProfile: Record<string, unknown>,
  dealHistory: Record<string, unknown>[],
): UserRecommendations {
  const history = Array.isArray(dealHistory) ? dealHistory : [];

  const recommendedDeals: DealRecommendation[] = history.slice(0, 5).map((deal, index) => {
    const dealId = asString(deal.id) ?? asString(deal.dealId) ?? `deal-${index + 1}`;
    return {
      dealId,
      score: Math.max(10, 80 - index * 10),
      reason: 'Surfaced from your recent deal history (heuristic ranking by recency).',
    };
  });

  const wallets = new Set<string>();
  for (const deal of history) {
    const buyer = asString(deal.buyerWallet);
    const seller = asString(deal.sellerWallet);
    if (buyer) wallets.add(buyer);
    if (seller) wallets.add(seller);
  }
  const selfWallet = asString(userProfile.wallet) ?? asString(userProfile.walletAddress);
  if (selfWallet) wallets.delete(selfWallet);

  const suggestedConnections = Array.from(wallets)
    .slice(0, 5)
    .map((wallet) => ({
      wallet,
      reason: 'You have transacted with this wallet before.',
      compatibilityScore: 60,
    }));

  const riskAlerts: UserRecommendations['riskAlerts'] = [];
  if (history.length === 0) {
    riskAlerts.push({
      type: 'no_history',
      message: 'No deal history yet — start with smaller escrow amounts to build reputation.',
      severity: 'low',
    });
  }

  return {
    recommendedDeals,
    suggestedConnections,
    riskAlerts,
    source: 'heuristic',
  };
}

export async function getRecommendations(
  client: LLMClient,
  userProfile: Record<string, unknown>,
  dealHistory: Record<string, unknown>[],
): Promise<UserRecommendations> {
  if (!client.isConfigured()) {
    return getRecommendationsHeuristic(userProfile, dealHistory);
  }

  try {
    const result = await client.chatWithJSON<UserRecommendations>(
      [{
        role: 'user',
        content: `${RECOMMENDATION_PROMPT}\n\nUser Profile:\n${JSON.stringify(userProfile, null, 2)}\n\nDeal History:\n${JSON.stringify(dealHistory, null, 2)}`,
      }],
      { temperature: 0.3 },
    );
    return { ...result, source: 'llm' };
  } catch {
    return getRecommendationsHeuristic(userProfile, dealHistory);
  }
}
