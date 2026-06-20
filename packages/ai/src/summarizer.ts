import { LLMClient } from './llm';

export interface DealSummaryResult {
  summary: string;
  keyPoints: string[];
  riskHighlights: string[];
  recommendedActions: string[];
}

const SUMMARIZER_PROMPT = `You are a deal summary assistant. Summarize the following deal 
providing key points, risk highlights, and recommended actions. Return a JSON object:
{
  "summary": "concise 2-3 sentence summary",
  "keyPoints": ["key point 1", "key point 2"],
  "riskHighlights": ["risk 1", "risk 2"],
  "recommendedActions": ["action 1", "action 2"]
}
`;

export async function summarizeDeal(
  client: LLMClient,
  dealDescription: string,
): Promise<DealSummaryResult> {
  return client.chatWithJSON<DealSummaryResult>(
    [{ role: 'user', content: `${SUMMARIZER_PROMPT}\n\nDeal:\n${dealDescription}` }],
    { temperature: 0.3 },
  );
}