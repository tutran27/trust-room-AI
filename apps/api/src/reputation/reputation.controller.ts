import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReputationService } from './reputation.service';

@Controller('reputation')
@UseGuards(JwtAuthGuard)
export class ReputationController {
  constructor(
    @Inject(ReputationService)
    private readonly reputationService: ReputationService,
  ) {}

  @Get('leaderboard')
  async leaderboard(@Query('limit') limit?: string) {
    return this.reputationService.getLeaderboard(limit ? parseInt(limit, 10) : 20);
  }

  @Get(':wallet')
  async getByWallet(@Param('wallet') wallet: string) {
    return this.reputationService.getByWallet(wallet);
  }
}
