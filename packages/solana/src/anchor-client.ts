/**
 * Anchor client wrapper for the TrustRoom escrow program.
 *
 * Provides typed helpers for interacting with the on-chain escrow program.
 * Uses raw Connection + Transaction instructions (no Anchor workspace dependency)
 * so the API can call it without bundling the full Anchor framework.
 *
 * SOL-based: all escrow transactions use native SOL (lamports), not SPL tokens.
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
export const ESCROW_PROGRAM_ID = new PublicKey('3DyccqgiVSUupDEfgvME8rduMHAgJdLxqhGEdPuhbjR7');

// Resolved from the ESCROW_PROGRAM_ID env at call time, falling back to the
// deployed default above. Constructed on demand (not at module load) so importing
// this module never throws when the env var is unset.
export function getEscrowProgramId(): PublicKey {
  const id = process.env.ESCROW_PROGRAM_ID;
  return id ? new PublicKey(id) : ESCROW_PROGRAM_ID;
}

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
  amount: bigint;
  state: EscrowState;
  termsHash: Buffer;
  evidenceHash: Buffer;
  createdAt: bigint;
  bump: number;
}

// ── Discriminator (first 8 bytes of SHA256("global:method_name")) ───────────
function methodDiscriminator(method: string): Buffer {
  const crypto = require('crypto') as typeof import('crypto');
  const hash = crypto.createHash('sha256').update(`global:${method}`).digest();
  return hash.subarray(0, 8);
}

// ── PDA Derivation Helpers ──────────────────────────────────────────────────

// No separate vault PDA needed — escrow PDA itself holds the SOL.

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
    this.programId = programId ?? getEscrowProgramId();
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

  /**
   * Build a full InitializeDeal transaction.
   * Creates the escrow PDA.
   */
  async buildInitializeDealTx(
    dealIdHash: Buffer,
    amount: bigint,
    buyer: PublicKey,
    seller: PublicKey,
  ): Promise<Transaction> {
    const pda = this.derivePda(dealIdHash);

    const discriminator = methodDiscriminator('initialize_deal');
    const ix = new TransactionInstruction({
      keys: [
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: buyer, isSigner: true, isWritable: true },
        { pubkey: seller, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.concat([discriminator, dealIdHash, this.encodeU64(amount)]),
    });

    const tx = new Transaction();
    tx.add(ix);
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = buyer;
    return tx;
  }

  /**
   * Build a Deposit transaction.
   * Transfers SOL from buyer to escrow PDA.
   */
  async buildDepositTx(
    dealIdHash: Buffer,
    buyer: PublicKey,
  ): Promise<Transaction> {
    const pda = this.derivePda(dealIdHash);

    const discriminator = methodDiscriminator('deposit');
    const ix = new TransactionInstruction({
      keys: [
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: buyer, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.concat([discriminator]),
    });

    const tx = new Transaction();
    tx.add(ix);
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = buyer;
    return tx;
  }

  /**
   * Build a confirm_terms instruction.
   */
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

  /**
   * Build a submit_delivery instruction.
   */
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

  /**
   * Build a Release transaction.
   * Transfers SOL from escrow PDA to seller. Only buyer can call.
   */
  async buildReleaseTx(
    dealIdHash: Buffer,
    buyer: PublicKey,
    seller: PublicKey,
  ): Promise<Transaction> {
    const pda = this.derivePda(dealIdHash);

    const discriminator = methodDiscriminator('release');
    const ix = new TransactionInstruction({
      keys: [
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: buyer, isSigner: true, isWritable: false },
        { pubkey: seller, isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data: Buffer.concat([discriminator]),
    });

    const tx = new Transaction();
    tx.add(ix);
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = buyer;
    return tx;
  }

  /**
   * Build a Refund transaction.
   * Transfers SOL from escrow PDA back to buyer.
   */
  async buildRefundTx(
    dealIdHash: Buffer,
    buyer: PublicKey,
  ): Promise<Transaction> {
    const pda = this.derivePda(dealIdHash);

    const discriminator = methodDiscriminator('refund');
    const ix = new TransactionInstruction({
      keys: [
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: buyer, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.concat([discriminator]),
    });

    const tx = new Transaction();
    tx.add(ix);
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = buyer;
    return tx;
  }

  /**
   * Build a raise_dispute instruction.
   */
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

  /**
   * Build a ResolveDispute transaction.
   * Transfers funds according to outcome (release/refund/split).
   */
  async buildResolveDisputeTx(
    dealIdHash: Buffer,
    outcome: DisputeOutcome,
    authority: PublicKey,
    buyer: PublicKey,
    seller: PublicKey,
  ): Promise<Transaction> {
    const pda = this.derivePda(dealIdHash);

    const discriminator = methodDiscriminator('resolve_dispute');
    const outcomeBuf = Buffer.alloc(1);
    outcomeBuf.writeUInt8(outcome);

    const ix = new TransactionInstruction({
      keys: [
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
        { pubkey: seller, isSigner: false, isWritable: true },
        { pubkey: buyer, isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data: Buffer.concat([discriminator, outcomeBuf]),
    });

    const tx = new Transaction();
    tx.add(ix);
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = authority;
    return tx;
  }

  /** Send and confirm a signed transaction, return the tx signature. */
  async sendAndConfirm(
    signedTx: Transaction,
  ): Promise<string> {
    const sig = await this.connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    await this.connection.confirmTransaction(sig, 'confirmed');
    return sig;
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
