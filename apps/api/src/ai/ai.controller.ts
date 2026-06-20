import { Controller, Post, Body, UseGuards, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiService } from './ai.service';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(@Inject(AiService) private readonly aiService: AiService) {}

  @Post('analyze-deal')
  async analyzeDeal(@Body() body: { dealDescription: string }) {
    return this.aiService.analyzeDeal(body.dealDescription);
  }

  @Post('analyze-dispute')
  async analyzeDispute(@Body() body: { dealDescription: string; buyerEvidence: string[]; sellerEvidence: string[] }) {
    return this.aiService.analyzeDispute(body.dealDescription, body.buyerEvidence, body.sellerEvidence);
  }

  @Post('detect-scam')
  async detectScam(@Body() body: { text: string }) {
    return this.aiService.detectScam(body.text);
  }

  @Post('summarize')
  async summarize(@Body() body: { text: string }) {
    return this.aiService.summarize(body.text);
  }

  @Post('recommend')
  async recommend(@Body() body: { userProfile: Record<string, unknown>; dealHistory: Record<string, unknown>[] }) {
    return this.aiService.getRecommendation(body.userProfile, body.dealHistory);
  }
}
