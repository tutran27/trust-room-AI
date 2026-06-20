import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/authenticated-request';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { DisputesService } from './disputes.service';

@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateDisputeDto) {
    return this.disputesService.createDispute(req.user.wallet, dto);
  }

  @Post(':id/evidence')
  addEvidence(
    @Req() req: AuthenticatedRequest,
    @Param('id') disputeId: string,
    @Body() dto: CreateEvidenceDto,
  ) {
    return this.disputesService.addEvidence(req.user.wallet, disputeId, dto);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.disputesService.listDisputes(req.user.wallet);
  }

  @Get(':id')
  findOne(@Req() req: AuthenticatedRequest, @Param('id') disputeId: string) {
    return this.disputesService.getDisputeById(req.user.wallet, disputeId);
  }

  @Post(':id/resolve')
  resolve(@Param('id') disputeId: string, @Body() dto: ResolveDisputeDto) {
    return this.disputesService.resolveDispute(disputeId, dto);
  }
}
