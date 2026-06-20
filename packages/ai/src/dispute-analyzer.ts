import { LLMClient } from './llm';

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

export async function analyzeDispute(
  client: LLMClient,
  dealDescription: string,
  buyerEvidence: string[],
  sellerEvidence: string[],
): Promise<DisputeAnalysisResult> {
  const content = `${DISPUTE_ANALYSIS_PROMPT}

Deal: ${dealDescription}

Buyer Evidence:
${buyerEvidence.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Seller Evidence:
${sellerEvidence.map((e, i) => `${i + 1}. ${e}`).join('\n')}`;

  return client.chatWithJSON<DisputeAnalysisResult>(
    [{ role: 'user', content }],
    { temperature: 0.2 },
  );
}