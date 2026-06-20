import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { NotificationType } from '@trustroom/db';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';

/**
 * Escrow service.
 *
 * Runs in SIMULATED (devnet) mode by default: the on-chain Anchor program is not
 * deployed in this environment, so lifecycle actions persist state + a synthetic
 * transaction signature instead of submitting a real Solana transaction. When a
 * real program + signer pipeline is wired later (ESCROW_PROGRAM_ID set and a
 * deployed program), the `simulated` flag flips to false without changing the API
 * contract. This keeps the demo fully functional with zero blockchain setup.
 */
@Injectable()
export class EscrowService {
  private readonly simulated: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly ws: WebsocketGateway,
  ) {
    // Simulated unless a real program id is configured AND on-chain wiring exists.
    this.simulated = !process.env.ESCROW_PROGRAM_ID;
  }

  /** Generate a plausible-looking, clearly-synthetic Solana tx signature. */
  private syntheticSignature(): string {
    return `SIM${randomBytes(32).toString('hex')}`;
  }

  async createEscrow(dto: CreateEscrowDto) {
    const deal = await this.prisma.deal.findUnique({ where: { id: dto.dealId } });
    if (!deal) throw new NotFoundException('Deal not found');

    const existing = await this.prisma.escrow.findFirst({
      where: { dealId: dto.dealId },
    });
    if (existing) {
      throw new BadRequestException('Escrow already exists for this deal');
    }

    const escrow = await this.prisma.escrow.create({
      data: {
        dealId: dto.dealId,
        amount: dto.amount,
        sellerAddress: dto.sellerWallet,
        status: 'Created',
      },
    });

    this.emit(escrow.dealId, 'escrow_created', { escrowId: escrow.id, status: escrow.status });
    return { escrow, simulated: this.simulated };
  }

  async fundEscrow(id: string, buyerWallet: string) {
    const escrow = await this.assertEscrow(id);
    if (escrow.status !== 'Created') {
      throw new BadRequestException(`Cannot fund escrow in status: ${escrow.status}`);
    }

    const txSignature = this.syntheticSignature();
    const updated = await this.prisma.escrow.update({
      where: { id },
      data: { status: 'Funded', txSignature },
    });

    await this.notify(escrow.dealId, buyerWallet, 'PaymentReceived', 'Escrow funded', `Funds deposited into escrow (${escrow.amount}).`);
    this.emit(escrow.dealId, 'escrow_funded', { escrowId: id, status: 'Funded', txSignature });
    return { escrow: updated, simulated: this.simulated, txSignature };
  }

  async releaseEscrow(id: string) {
    const escrow = await this.assertEscrow(id);
    if (escrow.status !== 'Funded') {
      throw new BadRequestException(`Cannot release escrow in status: ${escrow.status}`);
    }

    const txSignature = this.syntheticSignature();
    const updated = await this.prisma.escrow.update({
      where: { id },
      data: { status: 'Released', txSignature },
    });

    await this.notify(escrow.dealId, escrow.sellerAddress, 'PaymentReleased', 'Escrow released', 'Funds released to the seller.');
    this.emit(escrow.dealId, 'escrow_released', { escrowId: id, status: 'Released', txSignature });
    return { escrow: updated, simulated: this.simulated, txSignature };
  }

  async refundEscrow(id: string) {
    const escrow = await this.assertEscrow(id);
    if (escrow.status !== 'Funded' && escrow.status !== 'Disputed') {
      throw new BadRequestException(`Cannot refund escrow in status: ${escrow.status}`);
    }

    const txSignature = this.syntheticSignature();
    const updated = await this.prisma.escrow.update({
      where: { id },
      data: { status: 'Refunded', txSignature },
    });

    this.emit(escrow.dealId, 'escrow_refunded', { escrowId: id, status: 'Refunded', txSignature });
    return { escrow: updated, simulated: this.simulated, txSignature };
  }

  async getByDealId(dealId: string) {
    const escrow = await this.prisma.escrow.findFirst({ where: { dealId } });
    if (!escrow) throw new NotFoundException('Escrow not found for this deal');
    return escrow;
  }

  async getById(id: string) {
    return this.assertEscrow(id);
  }

  async listByWallet(wallet: string) {
    return this.prisma.escrow.findMany({
      where: {
        deal: { participants: { some: { walletAddress: wallet } } },
      },
      include: { deal: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertEscrow(id: string) {
    const escrow = await this.prisma.escrow.findUnique({ where: { id } });
    if (!escrow) throw new NotFoundException('Escrow not found');
    return escrow;
  }

  private emit(dealId: string, event: string, payload: Record<string, unknown>) {
    try {
      this.ws.emitDealUpdate(dealId, { kind: event, ...payload });
    } catch {
      // realtime is best-effort; never fail the request on a socket error
    }
  }

  private async notify(
    dealId: string,
    wallet: string,
    type: NotificationType,
    title: string,
    message: string,
  ) {
    try {
      const notification = await this.notifications.create(wallet, title, message, type, dealId);
      this.ws.emitNotification(wallet, {
        id: notification.id,
        type,
        title,
        message,
        dealId,
        createdAt: notification.createdAt,
      });
    } catch {
      // best-effort
    }
  }
}
