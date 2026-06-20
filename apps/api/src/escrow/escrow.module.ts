import { Module } from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { EscrowController } from './escrow.controller';
import { PrismaService } from '../database/prisma.service';

@Module({
  controllers: [EscrowController],
  providers: [EscrowService, PrismaService],
  exports: [EscrowService],
})
export class EscrowModule {}