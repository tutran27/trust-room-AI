/**
 * Anchor client wrapper for the TrustRoom escrow program.
 *
 * Provides typed helpers for interacting with the on-chain escrow program.
 * Uses raw Connection + Transaction instructions (no Anchor workspace dependency)
 * so the API can call it without bundling the full Anchor framework.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { getConnection, deriveEscrowPda, type SolanaCluster } from './index';

// ── Program ID (must match declare_id! in lib.rs) ──────────────────────────
export const ESCROW_PROGRAM_ID = new PublicKey('Escrow111111111111111111111111111111111111');

// ── Escrow state enum (mirrors on-chain enum) ───────────────────────────────
export enum EscrowState {
  Initialized = 0,
  Deposited = 1,
  TermsConfirmed = 2,
  DeliverySubmitted = 3,
  Released = 4,
  Refunded = 5,
  Disputed = 6,
  Resolved = 7,
}

export enum DisputeOutcome {
  Release = 0,
  Refund = 1,
  Split = 2,
}

// ── On-chain account layout ─────────────────────────────────────────────────
export interface EscrowAccountData {
  dealIdHash: Buffer;
  buyer: PublicKey;
  seller: PublicKey;
  tokenMint: PublicKey;
  amount: bigint;
  state: EscrowState;
  termsHash: Buffer;
  evidenceHash: Buffer;
  createdAt: bigint;
  bump: number;
}

// ── Discriminator (first 8 bytes of SHA256("global:method_name")) ───────────
function methodDiscriminator(method: string): Buffer {
  // Anchor uses first 8 bytes of sha256("global:<method>")
  const crypto = require('crypto') as typeof import('crypto');
  const hash = crypto.createHash('sha256').update(`global:${method}`).digest();
  return hash.subarray(0, 8);
}

// ── Client ──────────────────────────────────────────────────────────────────
export class EscrowClient {
  private connection: Connection;
  private programId: PublicKey;

  constructor(
    cluster: SolanaCluster = 'devnet',
    rpcUrl?: string,
    programId?: PublicKey,
  ) {
    this.connection = getConnection(cluster, rpcUrl);
    this.programId = programId ?? ESCROW_PROGRAM_ID;
  }

  /** Derive the escrow PDA for a given deal ID hash. */
  derivePda(dealIdHash: Buffer): PublicKey {
    const [pda] = deriveEscrowPda(this.programId, dealIdHash);
    return pda;
  }

  /** Fetch and decode the escrow account for a deal. */
  async getEscrow(dealIdHash: Buffer): Promise<EscrowAccountData | null> {
    const pda = this.derivePda(dealIdHash);
    const accountInfo = await this.connection.getAccountInfo(pda);
    if (!accountInfo) return null;
    return this.decodeEscrowAccount(accountInfo.data);
  }

  /** Build an initialize_deal instruction. */
  buildInitializeDealIx(
    dealIdHash: Buffer,
    amount: bigint,
    buyer: PublicKey,
    seller: PublicKey,
    tokenMint: PublicKey,
  ): TransactionInstruction {
    const pda = this.derivePda(dealIdHash);
    const discriminator = methodDiscriminator('initialize_deal');

    return new TransactionInstruction({
      keys: [
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: buyer, isSigner: true, isWritable: true },
        { pubkey: seller, isSigner: false, isWritable: false },
        { pubkey: tokenMint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.concat([discriminator, dealIdHash, this.encodeU64(amount)]),
    });
  }

  /** Build a deposit instruction. */
  buildDepositIx(dealIdHash: Buffer, buyer: PublicKey): TransactionInstruction {
    const pda = this.derivePda(dealIdHash);
    const discriminator = methodDiscriminator('deposit');

    return new TransactionInstruction({
      keys: [
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: buyer, isSigner: true, isWritable: true },
      ],
      programId: this.programId,
      data: Buffer.concat([discriminator]),
    });
  }

  /** Build a confirm_terms instruction. */
  buildConfirmTermsIx(
    dealIdHash: Buffer,
    termsHash: Buffer,
    authority: PublicKey,
  ): TransactionInstruction {
    const pda = this.derivePda(dealIdHash);
    const discriminator = methodDiscriminator('confirm_terms');

    return new TransactionInstruction({
      keys: [
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.concat([discriminator, termsHash]),
    });
  }

  /** Build a submit_delivery instruction. */
  buildSubmitDeliveryIx(dealIdHash: Buffer, authority: PublicKey): TransactionInstruction {
    const pda = this.derivePda(dealIdHash);
    const discriminator = methodDiscriminator('submit_delivery');

    return new TransactionInstruction({
      keys: [
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.concat([discriminator]),
    });
  }

  /** Build a release instruction (buyer releases funds to seller). */
  buildReleaseIx(dealIdHash: Buffer, buyer: PublicKey): TransactionInstruction {
    const pda = this.derivePda(dealIdHash);
    const discriminator = methodDiscriminator('release');

    return new TransactionInstruction({
      keys: [
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: buyer, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.concat([discriminator]),
    });
  }

  /** Build a refund instruction. */
  buildRefundIx(dealIdHash: Buffer, authority: PublicKey): TransactionInstruction {
    const pda = this.derivePda(dealIdHash);
    const discriminator = methodDiscriminator('refund');

    return new TransactionInstruction({
      keys: [
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.concat([discriminator]),
    });
  }

  /** Build a raise_dispute instruction. */
  buildRaiseDisputeIx(
    dealIdHash: Buffer,
    evidenceHash: Buffer,
    authority: PublicKey,
  ): TransactionInstruction {
    const pda = this.derivePda(dealIdHash);
    const discriminator = methodDiscriminator('raise_dispute');

    return new TransactionInstruction({
      keys: [
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.concat([discriminator, evidenceHash]),
    });
  }

  /** Build a resolve_dispute instruction. */
  buildResolveDisputeIx(
    dealIdHash: Buffer,
    outcome: DisputeOutcome,
    authority: PublicKey,
  ): TransactionInstruction {
    const pda = this.derivePda(dealIdHash);
    const discriminator = methodDiscriminator('resolve_dispute');

    const outcomeBuf = Buffer.alloc(1);
    outcomeBuf.writeUInt8(outcome);

    return new TransactionInstruction({
      keys: [
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.concat([discriminator, outcomeBuf]),
    });
  }

  /** Get the current Solana connection. */
  getConnection(): Connection {
    return this.connection;
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private decodeEscrowAccount(data: Buffer): EscrowAccountData {
    let offset = 8; // skip Anchor discriminator
    const dealIdHash = data.subarray(offset, offset + 32);
    offset += 32;
    const buyer = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const seller = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const tokenMint = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const amount = data.readBigUInt64LE(offset);
    offset += 8;
    const state = data.readUInt8(offset) as EscrowState;
    offset += 1;
    const termsHash = data.subarray(offset, offset + 32);
    offset += 32;
    const evidenceHash = data.subarray(offset, offset + 32);
    offset += 32;
    const createdAt = data.readBigInt64LE(offset);
    offset += 8;
    const bump = data.readUInt8(offset);

    return {
      dealIdHash: Buffer.from(dealIdHash),
      buyer,
      seller,
      tokenMint,
      amount,
      state,
      termsHash: Buffer.from(termsHash),
      evidenceHash: Buffer.from(evidenceHash),
      createdAt,
      bump,
    };
  }

  private encodeU64(value: bigint): Buffer {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(value);
    return buf;
  }
}