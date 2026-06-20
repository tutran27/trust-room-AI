import { LLMClient } from './llm';

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
}

const CHAT_ANALYSIS_PROMPT = `Analyze chat conversation between parties in a deal. Return JSON:
{
  "sentiment": { "overall": "positive|neutral|negative", "score": -1.0 to 1.0, "buyerSentiment": -1 to 1, "sellerSentiment": -1 to 1 },
  "disputes": [{ "topic": "string", "severity": "low|medium|high", "suggestedResolution": "string" }],
  "commitmentChanges": [{ "original": "string", "modified": "string", "initiator": "string" }],
  "escrowRelevantMessages": [{ "content": "string", "category": "payment|delivery|quality|timeline|other", "importance": "low|medium|high" }]
}
`;

export async function analyzeChat(
  client: LLMClient,
  messages: ChatMessage[],
): Promise<ChatAnalysisResult> {
  return client.chatWithJSON<ChatAnalysisResult>(
    [{ role: 'user', content: `${CHAT_ANALYSIS_PROMPT}\n\nConversation:\n${JSON.stringify(messages, null, 2)}` }],
    { temperature: 0.2 },
  );
}