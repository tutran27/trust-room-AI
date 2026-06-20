import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLLMClient, llmAvailable } from './llm.js';
import { extractTerms } from './term-extractor.js';
import { classifyRisk } from './risk-classifier.js';
import { detectScam } from './scam-detector.js';
import { summarizeDeal } from './summarizer.js';
import { analyzeChat } from './chat-analyzer.js';
import { analyzeDispute } from './dispute-analyzer.js';
import { getRecommendations } from './recommendation-engine.js';

/**
 * These tests assert that with NO API key set, every LLM-backed module returns a
 * valid, deterministic heuristic result instead of throwing. This is the core
 * "demo works with zero keys" guarantee.
 */
describe('Heuristic fallbacks (no API key)', () => {
  let savedGroq: string | undefined;
  let savedOpenAI: string | undefined;
  let savedBaseUrl: string | undefined;

  beforeEach(() => {
    savedGroq = process.env.GROQ_API_KEY;
    savedOpenAI = process.env.OPENAI_API_KEY;
    savedBaseUrl = process.env.LLM_BASE_URL;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_BASE_URL;
  });

  afterEach(() => {
    if (savedGroq === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = savedGroq;
    if (savedOpenAI === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = savedOpenAI;
    if (savedBaseUrl === undefined) delete process.env.LLM_BASE_URL;
    else process.env.LLM_BASE_URL = savedBaseUrl;
  });

  it('reports the client as not configured and llmAvailable() false', () => {
    expect(llmAvailable()).toBe(false);
    expect(createLLMClient().isConfigured()).toBe(false);
  });

  it('chat() throws when no key, but isConfigured() lets callers avoid the throw', async () => {
    const client = createLLMClient();
    expect(client.isConfigured()).toBe(false);
    await expect(client.chat([{ role: 'user', content: 'hi' }])).rejects.toThrow();
  });

  it('extractTerms returns a heuristic result with parsed amount/token/wallet', async () => {
    const client = createLLMClient();
    const result = await extractTerms(
      client,
      'Buyer pays 5 SOL to wallet 4Nd1mYabc23Hk9PqRsTuVwXyZ12345678abcdefghJK for an NFT, deliver in 3 days.',
    );
    expect(result.source).toBe('heuristic');
    expect(result.totalAmount).toBe('5');
    expect(result.currency).toBe('SOL');
    expect(result.confidence).toBeCloseTo(0.4);
    expect(Array.isArray(result.missingFields)).toBe(true);
    expect(result.rawText.length).toBeGreaterThan(0);
  });

  it('classifyRisk returns a heuristic result with a valid level and 0-100 score', async () => {
    const client = createLLMClient();
    const result = await classifyRisk(client, {
      title: 'Risky deal',
      description: 'Please release trước đi rồi tôi gửi file sau',
    });
    expect(result.source).toBe('heuristic');
    expect(['low', 'medium', 'high', 'critical']).toContain(result.riskLevel);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    // early-release phrase should push to high/critical
    expect(['high', 'critical']).toContain(result.riskLevel);
  });

  it('detectScam returns a heuristic result with valid shape', async () => {
    const client = createLLMClient();
    const result = await detectScam(client, 'cho mình xin seed phrase với');
    expect(result.source).toBe('heuristic');
    expect(typeof result.isScam).toBe('boolean');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(Array.isArray(result.flags)).toBe(true);
    // credential request is critical → isScam true
    expect(result.isScam).toBe(true);
  });

  it('summarizeDeal returns a heuristic result with valid arrays', async () => {
    const client = createLLMClient();
    const result = await summarizeDeal(client, 'Sell a domain for 100 USDC. Deliver after payment.');
    expect(result.source).toBe('heuristic');
    expect(typeof result.summary).toBe('string');
    expect(Array.isArray(result.keyPoints)).toBe(true);
    expect(Array.isArray(result.riskHighlights)).toBe(true);
    expect(Array.isArray(result.recommendedActions)).toBe(true);
    expect(result.recommendedActions.length).toBeGreaterThan(0);
  });

  it('analyzeChat returns a heuristic result with valid sentiment shape', async () => {
    const client = createLLMClient();
    const result = await analyzeChat(client, [
      { role: 'buyer', content: 'thanks, looks good', timestamp: '2026-06-20T00:00:00Z' },
      { role: 'seller', content: 'release trước đi rồi tôi gửi file sau', timestamp: '2026-06-20T00:01:00Z' },
    ]);
    expect(result.source).toBe('heuristic');
    expect(['positive', 'neutral', 'negative']).toContain(result.sentiment.overall);
    expect(result.sentiment.score).toBeGreaterThanOrEqual(-1);
    expect(result.sentiment.score).toBeLessThanOrEqual(1);
    expect(Array.isArray(result.disputes)).toBe(true);
    expect(Array.isArray(result.escrowRelevantMessages)).toBe(true);
  });

  it('analyzeDispute returns a heuristic result with a 100% responsibility split', async () => {
    const client = createLLMClient();
    const result = await analyzeDispute(
      client,
      'Buyer claims item never delivered',
      ['screenshot of chat', 'tx hash', 'email thread'],
      [],
    );
    expect(result.source).toBe('heuristic');
    expect(result.responsibilitySplit.buyer + result.responsibilitySplit.seller).toBe(100);
    expect(['weak', 'moderate', 'strong']).toContain(result.evidenceStrength.buyerEvidence);
    expect(typeof result.recommendedEscalation).toBe('boolean');
  });

  it('getRecommendations returns a heuristic result with valid arrays', async () => {
    const client = createLLMClient();
    const result = await getRecommendations(
      client,
      { wallet: 'selfWallet111' },
      [{ id: 'd1', buyerWallet: 'selfWallet111', sellerWallet: 'other222' }],
    );
    expect(result.source).toBe('heuristic');
    expect(Array.isArray(result.recommendedDeals)).toBe(true);
    expect(Array.isArray(result.suggestedConnections)).toBe(true);
    expect(Array.isArray(result.riskAlerts)).toBe(true);
    expect(result.recommendedDeals[0]?.dealId).toBe('d1');
  });
});
