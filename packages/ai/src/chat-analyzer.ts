import { LLMClient } from './llm.js';
import { analyzeTranscript } from './scam-guard/detect.js';

export interface ChatMessage {
  role: 'buyer' | 'seller' | 'arbitrator' | 'system';
  content: string;
  timestamp: string;
}

export interface ChatAnalysisResult {
  sentiment: {
    overall: 'positive' | 'neutral' | 'negative';
    score: number; // -1 to 1
    buyerSentiment: number;
    sellerSentiment: number;
  };
  disputes: Array<{
    topic: string;
    severity: 'low' | 'medium' | 'high';
    suggestedResolution: string;
  }>;
  commitmentChanges: Array<{
    original: string;
    modified: string;
    initiator: string;
  }>;
  escrowRelevantMessages: Array<{
    content: string;
    category: 'payment' | 'delivery' | 'quality' | 'timeline' | 'other';
    importance: 'low' | 'medium' | 'high';
  }>;
  /** Distinguishes a real LLM analysis from the deterministic heuristic fallback. */
  source: 'llm' | 'heuristic';
}

const CHAT_ANALYSIS_PROMPT = `Analyze chat conversation between parties in a deal. Return JSON:
{
  "sentiment": { "overall": "positive|neutral|negative", "score": -1.0 to 1.0, "buyerSentiment": -1 to 1, "sellerSentiment": -1 to 1 },
  "disputes": [{ "topic": "string", "severity": "low|medium|high", "suggestedResolution": "string" }],
  "commitmentChanges": [{ "original": "string", "modified": "string", "initiator": "string" }],
  "escrowRelevantMessages": [{ "content": "string", "category": "payment|delivery|quality|timeline|other", "importance": "low|medium|high" }]
}
`;

const POSITIVE_WORDS = ['thanks', 'great', 'agree', 'ok', 'good', 'perfect', 'deal', 'cảm ơn', 'tốt', 'đồng ý'];
const NEGATIVE_WORDS = ['scam', 'refund', 'dispute', 'angry', 'never', 'lừa', 'hoàn tiền', 'tranh chấp', 'không'];

const CATEGORY_KEYWORDS: Array<[ChatAnalysisResult['escrowRelevantMessages'][number]['category'], string[]]> = [
  ['payment', ['pay', 'payment', 'deposit', 'release', 'refund', 'chuyển', 'thanh toán']],
  ['delivery', ['deliver', 'send file', 'ship', 'gửi file', 'giao']],
  ['quality', ['quality', 'broken', 'defect', 'chất lượng', 'lỗi']],
  ['timeline', ['deadline', 'late', 'on time', 'hạn', 'trễ']],
];

function sentimentScore(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const w of POSITIVE_WORDS) if (lower.includes(w)) score += 1;
  for (const w of NEGATIVE_WORDS) if (lower.includes(w)) score -= 1;
  // Clamp to -1..1
  return Math.max(-1, Math.min(1, score / 3));
}

function categorize(content: string): ChatAnalysisResult['escrowRelevantMessages'][number]['category'] | null {
  const lower = content.toLowerCase();
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) return category;
  }
  return null;
}

/**
 * Deterministic chat analysis. Computes keyword-based sentiment per role, derives
 * disputes from scam-guard rule hits, and tags escrow-relevant messages by keyword
 * category. No network, never throws.
 */
export function analyzeChatHeuristic(messages: ChatMessage[]): ChatAnalysisResult {
  const buyerMsgs = messages.filter((m) => m.role === 'buyer');
  const sellerMsgs = messages.filter((m) => m.role === 'seller');

  const avg = (msgs: ChatMessage[]): number =>
    msgs.length ? msgs.reduce((s, m) => s + sentimentScore(m.content), 0) / msgs.length : 0;

  const buyerSentiment = avg(buyerMsgs);
  const sellerSentiment = avg(sellerMsgs);
  const score = messages.length
    ? messages.reduce((s, m) => s + sentimentScore(m.content), 0) / messages.length
    : 0;
  const overall: ChatAnalysisResult['sentiment']['overall'] =
    score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral';

  const fullText = messages.map((m) => m.content).join('\n');
  const { hits } = analyzeTranscript(fullText, 'Negotiating');
  const disputes: ChatAnalysisResult['disputes'] = hits.map((h) => ({
    topic: h.rule.intent,
    severity: h.rule.riskLevel === 'critical' ? 'high' : (h.rule.riskLevel as 'low' | 'medium' | 'high'),
    suggestedResolution: h.rule.message,
  }));

  const escrowRelevantMessages: ChatAnalysisResult['escrowRelevantMessages'] = [];
  for (const m of messages) {
    const category = categorize(m.content);
    if (category) {
      escrowRelevantMessages.push({
        content: m.content.length > 160 ? `${m.content.slice(0, 157)}...` : m.content,
        category,
        importance: category === 'payment' ? 'high' : 'medium',
      });
    }
  }

  return {
    sentiment: { overall, score, buyerSentiment, sellerSentiment },
    disputes,
    commitmentChanges: [],
    escrowRelevantMessages,
    source: 'heuristic',
  };
}

export async function analyzeChat(
  client: LLMClient,
  messages: ChatMessage[],
): Promise<ChatAnalysisResult> {
  if (!client.isConfigured()) {
    return analyzeChatHeuristic(messages);
  }

  try {
    const result = await client.chatWithJSON<ChatAnalysisResult>(
      [{ role: 'user', content: `${CHAT_ANALYSIS_PROMPT}\n\nConversation:\n${JSON.stringify(messages, null, 2)}` }],
      { temperature: 0.2 },
    );
    return { ...result, source: 'llm' };
  } catch {
    return analyzeChatHeuristic(messages);
  }
}
