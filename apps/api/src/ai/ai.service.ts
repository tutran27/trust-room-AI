import { Injectable } from '@nestjs/common';
import {
  getLLMClient,
  detectScam,
  classifyRisk,
  analyzeDispute,
  summarizeDeal,
  getRecommendations,
  extractTerms,
  llmAvailable,
  type LLMClient,
  type DealProfile,
} from '@trustroom/ai';

/**
 * AI service. The underlying @trustroom/ai functions each degrade to a
 * deterministic heuristic when no LLM key is configured, so every method here is
 * safe to call with zero external setup. `available` reports whether a real LLM
 * is wired (Groq/OpenAI key present).
 */
@Injectable()
export class AiService {
  /**
   * Resolve the LLM client lazily on every use rather than caching it at
   * construction. `getLLMClient()` returns the shared client only when a key is
   * configured, otherwise a fresh (unconfigured) client — so adding GROQ_API_KEY to
   * .env and restarting is enough to go live, with no stale-singleton from the
   * moment the service was instantiated.
   */
  private get llmClient(): LLMClient {
    return getLLMClient();
  }

  get available(): boolean {
    return llmAvailable();
  }

  async analyzeDeal(profileOrDescription: DealProfile | string) {
    const profile: DealProfile =
      typeof profileOrDescription === 'string'
        ? { description: profileOrDescription }
        : profileOrDescription;
    const description = profile.description || '';

    const [terms, risk, scamCheck] = await Promise.all([
      extractTerms(this.llmClient, description),
      classifyRisk(this.llmClient, profile),
      detectScam(this.llmClient, description),
    ]);

    return { terms, risk, scamCheck, llmAvailable: this.available };
  }

  async analyzeDispute(
    dealDescription: string,
    buyerEvidence: string[],
    sellerEvidence: string[],
  ) {
    return analyzeDispute(this.llmClient, dealDescription, buyerEvidence, sellerEvidence);
  }

  async detectScam(text: string) {
    return detectScam(this.llmClient, text);
  }

  async summarize(text: string) {
    return summarizeDeal(this.llmClient, text);
  }

  async getRecommendation(
    userProfile: Record<string, unknown>,
    dealHistory: Record<string, unknown>[],
  ) {
    return getRecommendations(this.llmClient, userProfile, dealHistory);
  }
}
