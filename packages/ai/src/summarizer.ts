import { LLMClient } from './llm.js';
import { analyzeTranscript } from './scam-guard/detect.js';

export interface DealSummaryResult {
  summary: string;
  keyPoints: string[];
  riskHighlights: string[];
  recommendedActions: string[];
  /** Distinguishes a real LLM summary from the deterministic heuristic fallback. */
  source: 'llm' | 'heuristic';
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

/** Split text into trimmed, non-empty sentences. */
function toSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。！？\n])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Deterministic deal summary. Truncates the input into a short summary, picks the
 * first sentences as key points, and folds scam-guard rule hits into risk
 * highlights + recommended actions. No network, never throws.
 */
export function summarizeDealHeuristic(dealDescription: string): DealSummaryResult {
  const text = (dealDescription ?? '').trim();
  const sentences = toSentences(text);

  const summary = text
    ? sentences.slice(0, 2).join(' ') || (text.length > 200 ? `${text.slice(0, 197)}...` : text)
    : 'No deal description provided.';

  const keyPoints = sentences.slice(0, 4);

  const { hits, level } = analyzeTranscript(text, 'Negotiating');
  const riskHighlights = hits.map((h) => `${h.rule.ruleId}: ${h.rule.message}`);

  const recommendedActions =
    level === 'critical' || level === 'high'
      ? ['Do not release escrow until delivery is verified.', 'Preserve evidence and consider human review.']
      : level === 'medium'
        ? ['Proceed with caution and keep transaction evidence.']
        : ['Confirm terms with both parties before depositing to escrow.'];

  return {
    summary,
    keyPoints,
    riskHighlights,
    recommendedActions,
    source: 'heuristic',
  };
}

export async function summarizeDeal(
  client: LLMClient,
  dealDescription: string,
): Promise<DealSummaryResult> {
  if (!client.isConfigured()) {
    return summarizeDealHeuristic(dealDescription);
  }

  try {
    const result = await client.chatWithJSON<DealSummaryResult>(
      [{ role: 'user', content: `${SUMMARIZER_PROMPT}\n\nDeal:\n${dealDescription}` }],
      { temperature: 0.3 },
    );
    return { ...result, source: 'llm' };
  } catch {
    return summarizeDealHeuristic(dealDescription);
  }
}
