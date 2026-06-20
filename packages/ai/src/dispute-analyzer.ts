import { LLMClient } from './llm.js';

export interface DisputeAnalysisResult {
  rootCause: string;
  responsibilitySplit: {
    buyer: number; // percentage 0-100
    seller: number;
  };
  suggestedResolution: string;
  evidenceStrength: {
    buyerEvidence: 'weak' | 'moderate' | 'strong';
    sellerEvidence: 'weak' | 'moderate' | 'strong';
  };
  recommendedEscalation: boolean;
  similarCases: Array<{
    description: string;
    outcome: string;
    relevance: number;
  }>;
  /** Distinguishes a real LLM analysis from the deterministic heuristic fallback. */
  source: 'llm' | 'heuristic';
}

const DISPUTE_ANALYSIS_PROMPT = `You are a dispute resolution specialist for a decentralized escrow platform.
Analyze the dispute and evidence from both parties. Return a JSON object:
{
  "rootCause": "main cause of dispute",
  "responsibilitySplit": { "buyer": 0-100, "seller": 0-100 },
  "suggestedResolution": "recommended resolution",
  "evidenceStrength": { "buyerEvidence": "weak|moderate|strong", "sellerEvidence": "weak|moderate|strong" },
  "recommendedEscalation": boolean,
  "similarCases": [{ "description": "string", "outcome": "string", "relevance": 0-1 }]
}
`;

/** Grade evidence strength by how much material each party submitted. */
function evidenceStrength(evidence: string[]): 'weak' | 'moderate' | 'strong' {
  const meaningful = evidence.filter((e) => e.trim().length > 0).length;
  if (meaningful >= 3) return 'strong';
  if (meaningful >= 1) return 'moderate';
  return 'weak';
}

const STRENGTH_RANK: Record<'weak' | 'moderate' | 'strong', number> = {
  weak: 0,
  moderate: 1,
  strong: 2,
};

/**
 * Deterministic dispute analysis. Splits responsibility by relative evidence
 * strength and recommends escalation when evidence is thin or balanced. No
 * network, never throws. AI is an assistant here — it never decides release.
 */
export function analyzeDisputeHeuristic(
  dealDescription: string,
  buyerEvidence: string[],
  sellerEvidence: string[],
): DisputeAnalysisResult {
  const buyerStrength = evidenceStrength(buyerEvidence);
  const sellerStrength = evidenceStrength(sellerEvidence);
  const buyerRank = STRENGTH_RANK[buyerStrength];
  const sellerRank = STRENGTH_RANK[sellerStrength];

  // Lean responsibility toward the party with WEAKER evidence (less able to
  // substantiate their position). Default to an even split when equal.
  let buyer = 50;
  if (buyerRank > sellerRank) buyer = 35;
  else if (sellerRank > buyerRank) buyer = 65;
  const seller = 100 - buyer;

  const recommendedEscalation =
    (buyerStrength === 'weak' && sellerStrength === 'weak') || buyerRank === sellerRank;

  return {
    rootCause: dealDescription.trim()
      ? `Dispute over: ${dealDescription.trim().slice(0, 140)}${dealDescription.trim().length > 140 ? '...' : ''}`
      : 'Dispute root cause unspecified — insufficient description provided.',
    responsibilitySplit: { buyer, seller },
    suggestedResolution:
      'Heuristic assessment only. Review on-chain evidence and submitted proofs; a human arbitrator should make the final release/refund decision.',
    evidenceStrength: { buyerEvidence: buyerStrength, sellerEvidence: sellerStrength },
    recommendedEscalation,
    similarCases: [],
    source: 'heuristic',
  };
}

export async function analyzeDispute(
  client: LLMClient,
  dealDescription: string,
  buyerEvidence: string[],
  sellerEvidence: string[],
): Promise<DisputeAnalysisResult> {
  if (!client.isConfigured()) {
    return analyzeDisputeHeuristic(dealDescription, buyerEvidence, sellerEvidence);
  }

  const content = `${DISPUTE_ANALYSIS_PROMPT}

Deal: ${dealDescription}

Buyer Evidence:
${buyerEvidence.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Seller Evidence:
${sellerEvidence.map((e, i) => `${i + 1}. ${e}`).join('\n')}`;

  try {
    const result = await client.chatWithJSON<DisputeAnalysisResult>(
      [{ role: 'user', content }],
      { temperature: 0.2 },
    );
    return { ...result, source: 'llm' };
  } catch {
    return analyzeDisputeHeuristic(dealDescription, buyerEvidence, sellerEvidence);
  }
}
