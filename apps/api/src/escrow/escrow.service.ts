import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { PrismaService } from '../database/prisma.service';
import { NotificationType } from '@trustroom/db';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { SolanaService } from './solana.service';

@Injectable()
export class EscrowService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
    @Inject(WebsocketGateway) private readonly ws: WebsocketGateway,
    @Inject(SolanaService) private readonly solana: SolanaService,
  ) {}

  /** Create escrow + build unsigned init tx for buyer to sign. */
  async createEscrow(dto: CreateEscrowDto) {
    const deal = await this.prisma.deal.findUnique({ where: { id: dto.dealId } });
    if (!deal) throw new NotFoundException('Deal not found');

    const existing = await this.prisma.escrow.findFirst({ where: { dealId: dto.dealId } });
    if (existing) throw new BadRequestException('Escrow already exists for this deal');

    const dealIdHash = this.solana.dealIdToHash(dto.dealId);
    const buyer = new PublicKey(dto.buyerWallet);
    const seller = new PublicKey(dto.sellerWallet);
    // amount in lamports: 1 SOL = 1_000_000_000 lamports
    const amountLamports = BigInt(Math.round(parseFloat(dto.amount) * 1_000_000_000));

    const initTx = await this.solana.buildInitialize(dealIdHash, amountLamports, buyer, seller);
    const serializedTx = initTx.serialize({ requireAllSignatures: false }).toString('base64');

    const escrow = await this.prisma.escrow.create({
      data: {
        dealId: dto.dealId,
        amount: dto.amount,
        buyerAddress: dto.buyerWallet,
        sellerAddress: dto.sellerWallet,
        tokenMint: 'SOL',
        dealIdHash,
        status: 'Created',
      },
    });

    this.emit(escrow.dealId, 'escrow_created', {
      escrowId: escrow.id, status: escrow.status, dealIdHash, txBase64: serializedTx,
    });

    return { escrow, txBase64: serializedTx, dealIdHash, tokenMint: 'SOL' };
  }

  /** Build unsigned deposit tx for buyer to sign. */
  async fundEscrow(id: string, buyerWallet: string) {
    const escrow = await this.assertEscrow(id);
    if (escrow.status !== 'Created') {
      throw new BadRequestException(`Cannot fund escrow in status: ${escrow.status}`);
    }
    if (!escrow.dealIdHash) {
      throw new BadRequestException('Escrow has no dealIdHash — init may not have completed.');
    }

    // Check that the PDA exists on-chain before building deposit tx
    const onChain = await this.solana.getEscrowState(escrow.dealIdHash);
    if (!onChain) {
      throw new BadRequestException(
        'Escrow PDA not found on-chain yet. Please wait a few seconds and try again — the init transaction may still be confirming.',
      );
    }

    const buyer = new PublicKey(buyerWallet);
    const depositTx = await this.solana.buildDeposit(escrow.dealIdHash!, buyer);
    const serializedTx = depositTx.serialize({ requireAllSignatures: false }).toString('base64');

    this.emit(escrow.dealId, 'escrow_fund_tx_ready', { escrowId: id, txBase64: serializedTx });

    return { escrowId: id, status: escrow.status, txBase64: serializedTx };
  }

  /** Confirm init tx was confirmed on-chain (called by frontend after signing init tx). */
  async confirmCreated(id: string, txSignature: string) {
    const escrow = await this.assertEscrow(id);
    if (escrow.status !== 'Created') {
      throw new BadRequestException(`Cannot confirm creation in status: ${escrow.status}`);
    }

    const updated = await this.prisma.escrow.update({
      where: { id },
      data: { txSignature },
    });

    this.emit(escrow.dealId, 'escrow_initialized_onchain', { escrowId: id, txSignature });
    return { escrow: updated, txSignature };
  }

  /** Confirm deposit was confirmed on-chain (called by frontend after tx confirmed). */
  async confirmFunded(id: string, txSignature: string) {
    const escrow = await this.assertEscrow(id);
    if (escrow.status !== 'Created') {
      throw new BadRequestException(`Cannot confirm funding in status: ${escrow.status}`);
    }

    const updated = await this.prisma.escrow.update({
      where: { id },
      data: { status: 'Funded', txSignature },
    });

    await this.notify(escrow.dealId, escrow.buyerAddress, 'PaymentReceived', 'Escrow funded',
      `Funds deposited into escrow (${escrow.amount} SOL).`);
    this.emit(escrow.dealId, 'escrow_funded', { escrowId: id, status: 'Funded', txSignature });
    return { escrow: updated, txSignature };
  }

  /** Build unsigned release tx for buyer to sign. */
  async releaseEscrow(id: string) {
    const escrow = await this.assertEscrow(id);
    if (escrow.status !== 'Funded' && escrow.status !== 'DeliverySubmitted') {
      throw new BadRequestException(`Cannot release escrow in status: ${escrow.status}`);
    }

    const buyer = new PublicKey(escrow.buyerAddress);
    const seller = new PublicKey(escrow.sellerAddress);
    const releaseTx = await this.solana.buildRelease(escrow.dealIdHash!, buyer, seller);
    const serializedTx = releaseTx.serialize({ requireAllSignatures: false }).toString('base64');

    this.emit(escrow.dealId, 'escrow_release_tx_ready', { escrowId: id, txBase64: serializedTx });

    return { escrowId: id, status: escrow.status, txBase64: serializedTx };
  }

  /** Confirm release on-chain tx. */
  async confirmReleased(id: string, txSignature: string) {
    const escrow = await this.assertEscrow(id);
    if (escrow.status !== 'Funded' && escrow.status !== 'DeliverySubmitted') {
      throw new BadRequestException(`Cannot confirm release in status: ${escrow.status}`);
    }

    const updated = await this.prisma.escrow.update({
      where: { id },
      data: { status: 'Released', txSignature },
    });

    await this.notify(escrow.dealId, escrow.sellerAddress, 'PaymentReleased', 'Escrow released',
      'Funds released to the seller.');
    this.emit(escrow.dealId, 'escrow_released', { escrowId: id, status: 'Released', txSignature });
    return { escrow: updated, txSignature };
  }

  // ── Confirm terms (both buyer + seller must confirm) ───────

  async doConfirmTerms(dealId: string, walletAddress: string) {
    const escrow = await this.prisma.escrow.findFirst({ where: { dealId } });
    if (!escrow) throw new NotFoundException('Escrow not found for this deal');
    if (escrow.status !== 'Funded') {
      throw new BadRequestException(`Cannot confirm terms in status: ${escrow.status}`);
    }

    // Determine role
    const isBuyer = walletAddress === escrow.buyerAddress;
    const isSeller = walletAddress === escrow.sellerAddress;
    if (!isBuyer && !isSeller) {
      throw new BadRequestException('Wallet is not a participant in this escrow');
    }
    if (isBuyer && escrow.buyerConfirmed) {
      throw new BadRequestException('Buyer already confirmed terms');
    }
    if (isSeller && escrow.sellerConfirmed) {
      throw new BadRequestException('Seller already confirmed terms');
    }

    // Check on-chain state
    if (!escrow.dealIdHash) {
      throw new BadRequestException('No dealIdHash — escrow may not be on-chain yet');
    }
    const onChain = await this.solana.getEscrowState(escrow.dealIdHash);
    if (!onChain) {
      throw new BadRequestException('Escrow not found on-chain. Fund tx may not have completed yet.');
    }

    // If on-chain is already TermsConfirmed (2), skip on-chain tx — just update DB
    if (onChain.state === 2) {
      const updateData: Record<string, unknown> = {};
      if (isBuyer) updateData.buyerConfirmed = true;
      if (isSeller) updateData.sellerConfirmed = true;
      const bothNow = (isBuyer ? true : escrow.buyerConfirmed) &&
                      (isSeller ? true : escrow.sellerConfirmed);
      if (bothNow) updateData.status = 'TermsConfirmed';
      await this.prisma.escrow.update({ where: { id: escrow.id }, data: updateData });
      this.emit(escrow.dealId, 'escrow_terms_confirmed', { escrowId: escrow.id, role: isBuyer ? 'buyer' : 'seller' });
      return { escrowId: escrow.id, txBase64: null, role: isBuyer ? 'buyer' : 'seller', skipped: true };
    }

    // On-chain must be Deposited (1)
    if (onChain.state !== 1) {
      throw new BadRequestException(`On-chain state is ${onChain.state}, expected Deposited (1).`);
    }

    const signer = new PublicKey(walletAddress);
    const termsHash = Buffer.alloc(32, 1);
    const tx = await this.solana.buildConfirmTerms(escrow.dealIdHash!, termsHash, signer);
    const serializedTx = tx.serialize({ requireAllSignatures: false }).toString('base64');

    return { escrowId: escrow.id, txBase64: serializedTx, role: isBuyer ? 'buyer' : 'seller' };
  }

  async doConfirmTermsDone(id: string, walletAddress: string, txSignature: string) {
    const escrow = await this.assertEscrow(id);
    const isBuyer = walletAddress === escrow.buyerAddress;
    const isSeller = walletAddress === escrow.sellerAddress;
    if (!isBuyer && !isSeller) {
      throw new BadRequestException('Wallet is not a participant');
    }

    const updateData: Record<string, unknown> = { txSignature };
    if (isBuyer) updateData.buyerConfirmed = true;
    if (isSeller) updateData.sellerConfirmed = true;

    // If both confirmed, update status
    const bothConfirmed = (isBuyer ? true : escrow.buyerConfirmed) &&
                          (isSeller ? true : escrow.sellerConfirmed);
    if (bothConfirmed) {
      updateData.status = 'TermsConfirmed';
    }

    const updated = await this.prisma.escrow.update({ where: { id }, data: updateData });

    const role = isBuyer ? 'buyer' : 'seller';
    this.emit(escrow.dealId, 'escrow_terms_confirmed', {
      escrowId: id, role, txSignature, bothConfirmed,
    });
    return { escrow: updated, txSignature, role, bothConfirmed };
  }

  // ── Submit delivery (seller only) ──────────────────────────

  async doSubmitDelivery(dealId: string, walletAddress: string) {
    const escrow = await this.prisma.escrow.findFirst({ where: { dealId } });
    if (!escrow) throw new NotFoundException('Escrow not found for this deal');
    if (escrow.status !== 'Funded' && escrow.status !== 'TermsConfirmed') {
      throw new BadRequestException(`Cannot submit delivery in status: ${escrow.status}`);
    }
    if (walletAddress !== escrow.sellerAddress) {
      throw new BadRequestException('Only seller can submit delivery');
    }

    const signer = new PublicKey(walletAddress);
    const tx = await this.solana.buildSubmitDelivery(escrow.dealIdHash!, signer);
    const serializedTx = tx.serialize({ requireAllSignatures: false }).toString('base64');

    return { escrowId: escrow.id, txBase64: serializedTx };
  }

  async doSubmitDeliveryDone(id: string, txSignature: string) {
    const escrow = await this.assertEscrow(id);
    const updated = await this.prisma.escrow.update({
      where: { id },
      data: { status: 'DeliverySubmitted', deliverySubmitted: true, txSignature },
    });
    this.emit(escrow.dealId, 'escrow_delivery_submitted', { escrowId: id, txSignature });
    return { escrow: updated, txSignature };
  }

  /** Build unsigned refund tx for buyer to sign. */
  async refundEscrow(id: string) {
    const escrow = await this.assertEscrow(id);
    if (escrow.status !== 'Funded' && escrow.status !== 'Disputed') {
      throw new BadRequestException(`Cannot refund escrow in status: ${escrow.status}`);
    }

    const buyer = new PublicKey(escrow.buyerAddress);
    const refundTx = await this.solana.buildRefund(escrow.dealIdHash!, buyer);
    const serializedTx = refundTx.serialize({ requireAllSignatures: false }).toString('base64');

    this.emit(escrow.dealId, 'escrow_refund_tx_ready', { escrowId: id, txBase64: serializedTx });

    return { escrowId: id, status: escrow.status, txBase64: serializedTx };
  }

  /** Confirm refund on-chain tx. */
  async confirmRefunded(id: string, txSignature: string) {
    const escrow = await this.assertEscrow(id);
    if (escrow.status !== 'Funded' && escrow.status !== 'Disputed') {
      throw new BadRequestException(`Cannot confirm refund in status: ${escrow.status}`);
    }

    const updated = await this.prisma.escrow.update({
      where: { id },
      data: { status: 'Refunded', txSignature },
    });

    this.emit(escrow.dealId, 'escrow_refunded', { escrowId: id, status: 'Refunded', txSignature });
    return { escrow: updated, txSignature };
  }

  // ── Queries ──────────────────────────────────────────────────────

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
      where: { deal: { participants: { some: { walletAddress: wallet } } } },
      include: { deal: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOnChainState(dealId: string) {
    const escrow = await this.assertEscrow(dealId);
    if (!escrow.dealIdHash) return null;
    return this.solana.getEscrowState(escrow.dealIdHash);
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private async assertEscrow(id: string) {
    const escrow = await this.prisma.escrow.findUnique({ where: { id } });
    if (!escrow) throw new NotFoundException('Escrow not found');
    return escrow;
  }

  private emit(dealId: string, event: string, payload: Record<string, unknown>) {
    try {
      this.ws.emitDealUpdate(dealId, { kind: event, ...payload });
    } catch { /* best-effort */ }
  }

  private async notify(dealId: string, wallet: string, type: NotificationType,
    title: string, message: string) {
    try {
      const notification = await this.notifications.create(wallet, title, message, type, dealId);
      this.ws.emitNotification(wallet, {
        id: notification.id, type, title, message, dealId, createdAt: notification.createdAt,
      });
    } catch { /* best-effort */ }
  }
}
