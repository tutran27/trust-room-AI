import { Injectable, Logger } from '@nestjs/common';
import { EscrowClient, deriveVaultPda, ESCROW_PROGRAM_ID, type SolanaCluster, type EscrowAccountData } from '@trustroom/solana';
import { Connection, PublicKey } from '@solana/web3.js';

/**
 * Thin wrapper around the @trustroom/solana EscrowClient.
 * SOL-based escrow — no SPL tokens involved.
 */
@Injectable()
export class SolanaService {
  private readonly logger = new Logger(SolanaService.name);
  private readonly client: EscrowClient;

  constructor() {
    const cluster = (process.env.SOLANA_CLUSTER as SolanaCluster) || 'devnet';
    const rpcUrl = process.env.SOLANA_RPC_URL;
    const programId = process.env.ESCROW_PROGRAM_ID
      ? new PublicKey(process.env.ESCROW_PROGRAM_ID)
      : ESCROW_PROGRAM_ID;

    this.client = new EscrowClient(cluster, rpcUrl, programId);
    this.logger.log(`SolanaService initialized: cluster=${cluster}, program=${programId.toBase58()}`);
  }

  /** Fetch on-chain escrow state by deal ID hash. */
  async getEscrowState(dealIdHash: string): Promise<EscrowAccountData | null> {
    const hash = Buffer.from(dealIdHash, 'hex');
    return this.client.getEscrow(hash);
  }

  /** Build an unsigned initialize-deal transaction. */
  async buildInitialize(
    dealIdHash: string,
    amount: bigint,
    buyer: PublicKey,
    seller: PublicKey,
  ): Promise<import('@solana/web3.js').Transaction> {
    const hash = Buffer.from(dealIdHash, 'hex');
    return this.client.buildInitializeDealTx(hash, amount, buyer, seller);
  }

  /** Build an unsigned deposit transaction. */
  async buildDeposit(
    dealIdHash: string,
    buyer: PublicKey,
  ): Promise<import('@solana/web3.js').Transaction> {
    const hash = Buffer.from(dealIdHash, 'hex');
    return this.client.buildDepositTx(hash, buyer);
  }

  /** Build an unsigned release transaction. */
  async buildRelease(
    dealIdHash: string,
    buyer: PublicKey,
    seller: PublicKey,
  ): Promise<import('@solana/web3.js').Transaction> {
    const hash = Buffer.from(dealIdHash, 'hex');
    return this.client.buildReleaseTx(hash, buyer, seller);
  }

  /** Build an unsigned refund transaction. */
  async buildRefund(
    dealIdHash: string,
    buyer: PublicKey,
  ): Promise<import('@solana/web3.js').Transaction> {
    const hash = Buffer.from(dealIdHash, 'hex');
    return this.client.buildRefundTx(hash, buyer);
  }

  getConnection(): Connection {
    return this.client.getConnection();
  }

  /** Convert a deal ID string to a 32-byte hash (SHA-256) for on-chain use. */
  dealIdToHash(dealId: string): string {
    const crypto = require('crypto') as typeof import('crypto');
    return crypto.createHash('sha256').update(dealId).digest('hex');
  }
}
