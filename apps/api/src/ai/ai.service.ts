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
  // Auto-resolves Groq-first, then OpenAI, from the environment.
  private readonly llmClient: LLMClient = getLLMClient();

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
