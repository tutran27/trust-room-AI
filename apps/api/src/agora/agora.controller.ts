import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AgoraService } from './agora.service';
import { CreateAgoraDto } from './dto/create-agora.dto';
import { VoteAgoraDto } from './dto/vote-agora.dto';

@Controller('agora')
@UseGuards(JwtAuthGuard)
export class AgoraController {
  constructor(@Inject(AgoraService) private readonly agoraService: AgoraService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateAgoraDto) {
    return this.agoraService.create(req.user.wallet, dto.title, dto.description, dto.category, dto.tokenMint);
  }

  @Get()
  async list(@Query('status') status?: string, @Query('category') category?: string) {
    return this.agoraService.list(status as any, category);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.agoraService.getById(id);
  }

  @Get(':id/votes')
  async getVotes(@Param('id') id: string) {
    return this.agoraService.getVotes(id);
  }

  @Get(':id/tally')
  async tally(@Param('id') id: string) {
    return this.agoraService.tally(id);
  }

  @Post(':id/vote')
  async vote(@Param('id') id: string, @Req() req: any, @Body() dto: VoteAgoraDto) {
    return this.agoraService.vote(id, req.user.wallet, dto.support, dto.amount, dto.votePower);
  }

  @Post(':id/close')
  async close(@Param('id') id: string, @Req() req: any) {
    return this.agoraService.closeProposal(id, req.user.wallet);
  }
}
