import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('escrow')
@UseGuards(JwtAuthGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post()
  async create(@Body() dto: CreateEscrowDto) {
    return this.escrowService.createEscrow(dto);
  }

  @Post(':id/fund')
  async fund(@Param('id') id: string, @Request() req: any) {
    return this.escrowService.fundEscrow(id, req.user.wallet);
  }

  @Post(':id/release')
  async release(@Param('id') id: string) {
    return this.escrowService.releaseEscrow(id);
  }

  @Post(':id/refund')
  async refund(@Param('id') id: string) {
    return this.escrowService.refundEscrow(id);
  }

  @Get('deal/:dealId')
  async getByDealId(@Param('dealId') dealId: string) {
    return this.escrowService.getByDealId(dealId);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.escrowService.getById(id);
  }

  @Get('wallet/:wallet')
  async listByWallet(@Param('wallet') wallet: string) {
    return this.escrowService.listByWallet(wallet);
  }
}