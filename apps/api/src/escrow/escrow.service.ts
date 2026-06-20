import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@trustroom/db';
import { EscrowClient, PublicKey } from '@trustroom/solana';
import { CreateEscrowDto } from './dto/create-escrow.dto';

@Injectable()
export class EscrowService {
  private escrowClient: EscrowClient;

  constructor(private readonly prisma: PrismaService) {
    this.escrowClient = new EscrowClient(
      'devnet',
      process.env.SOLANA_RPC_URL,
    );
  }

  async createEscrow(dto: CreateEscrowDto) {
    const deal = await this.prisma.deal.findUnique({ where: { id: dto.dealId } });
    if (!deal) throw new NotFoundException('Deal not found');

    const existing = await this.prisma.escrow.findFirst({
      where: { dealId: dto.dealId },
    });
    if (existing) throw new BadRequestException('Escrow already exists for this deal');

    const escrow = await this.prisma.escrow.create({
      data: {
        dealId: dto.dealId,
        amount: dto.amount,
        sellerAddress: dto.sellerWallet,
        status: 'Created',
      },
    });

    return escrow;
  }

  async fundEscrow(id: string, buyerWallet: string) {
    const escrow = await this.prisma.escrow.findUnique({
      where: { id },
      include: { deal: true },
    });
    if (!escrow) throw new NotFoundException('Escrow not found');
    if (escrow.status !== 'Created')
      throw new BadRequestException(`Cannot fund escrow in status: ${escrow.status}`);

    // Build the deposit instruction
    const crypto = await import('crypto');
    const dealIdHash = crypto.createHash('sha256').update(escrow.dealId).digest();

    const ix = this.escrowClient.buildDepositIx(
      dealIdHash,
      new PublicKey(buyerWallet),
    );

    await this.prisma.escrow.update({
      where: { id },
      data: {
        status: 'Funded',
      },
    });

    return { instruction: ix };
  }

  async releaseEscrow(id: string) {
    const escrow = await this.prisma.escrow.findUnique({ where: { id } });
    if (!escrow) throw new NotFoundException('Escrow not found');
    if (escrow.status !== 'Funded')
      throw new BadRequestException(`Cannot release escrow in status: ${escrow.status}`);

    const crypto = await import('crypto');
    const dealIdHash = crypto.createHash('sha256').update(escrow.dealId).digest();

    const ix = this.escrowClient.buildReleaseIx(
      dealIdHash,
      new PublicKey(escrow.sellerAddress),
    );

    await this.prisma.escrow.update({
      where: { id },
      data: {
        status: 'Released',
      },
    });

    return { instruction: ix };
  }

  async refundEscrow(id: string) {
    const escrow = await this.prisma.escrow.findUnique({ where: { id } });
    if (!escrow) throw new NotFoundException('Escrow not found');
    if (escrow.status !== 'Funded' && escrow.status !== 'Disputed')
      throw new BadRequestException(`Cannot refund escrow in status: ${escrow.status}`);

    const crypto = await import('crypto');
    const dealIdHash = crypto.createHash('sha256').update(escrow.dealId).digest();

    const ix = this.escrowClient.buildRefundIx(
      dealIdHash,
      new PublicKey(escrow.sellerAddress),
    );

    await this.prisma.escrow.update({
      where: { id },
      data: {
        status: 'Refunded',
      },
    });

    return { instruction: ix };
  }

  async getByDealId(dealId: string) {
    const escrow = await this.prisma.escrow.findFirst({
      where: { dealId },
    });
    if (!escrow) throw new NotFoundException('Escrow not found for this deal');
    return escrow;
  }

  async getById(id: string) {
    const escrow = await this.prisma.escrow.findUnique({ where: { id } });
    if (!escrow) throw new NotFoundException('Escrow not found');
    return escrow;
  }

  async listByWallet(wallet: string) {
    return this.prisma.escrow.findMany({
      where: {
        deal: {
          participants: { some: { walletAddress: wallet } },
        },
      },
      include: { deal: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}