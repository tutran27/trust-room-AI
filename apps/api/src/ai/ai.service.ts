import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  getLLMClient,
  detectScam,
  classifyRisk,
  analyzeDispute,
  summarizeDeal,
  getRecommendations,
  extractTerms,
  type LLMClient,
  type DealProfile,
} from '@trustroom/ai';

@Injectable()
export class AiService {
  private readonly llmClient: LLMClient;

  constructor(private readonly config: ConfigService) {
    this.llmClient = getLLMClient({
      apiKey: this.config.get<string>('OPENAI_API_KEY'),
    });
  }

  async analyzeDeal(profileOrDescription: DealProfile | string) {
    const profile: DealProfile =
      typeof profileOrDescription === 'string'
        ? { description: profileOrDescription }
        : profileOrDescription;
    const terms = extractTerms(this.llmClient, profile.description || '');
    const risk = await classifyRisk(this.llmClient, profile);
    const scamCheck = await detectScam(this.llmClient, profile.description || '');

    return { terms, risk, scamCheck };
  }

  async analyzeDispute(dealDescription: string, buyerEvidence: string[], sellerEvidence: string[]) {
    return analyzeDispute(this.llmClient, dealDescription, buyerEvidence, sellerEvidence);
  }

  async detectScam(text: string) {
    return detectScam(this.llmClient, text);
  }

  async summarize(text: string) {
    return summarizeDeal(this.llmClient, text);
  }

  async getRecommendation(userProfile: Record<string, unknown>, dealHistory: Record<string, unknown>[]) {
    return getRecommendations(this.llmClient, userProfile, dealHistory);
  }
}