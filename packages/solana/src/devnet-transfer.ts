/**
 * Real devnet SOL transfer helper for the escrow demo.
 *
 * Moves a tiny amount of SOL between two PRE-FUNDED devnet keypairs so escrow
 * deposit/release produce a real, Explorer-verifiable transaction signature
 * instead of a synthetic SIM string. Deliberately NOT using airdrop (rate-limited,
 * breaks live demos) — the keypairs must be funded ahead of time.
 *
 * Configuration (all optional; absence => caller falls back to simulated mode):
 *   ESCROW_PAYER_SECRET_KEY    JSON array (e.g. "[12,34,...]") or base58 secret key
 *   ESCROW_RECEIVER_PUBKEY     base58 public key that receives the transfer
 *   ESCROW_DEMO_LAMPORTS       optional override for the transfer size (default 5000)
 */

import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { getConnection, type SolanaCluster } from './index';

const DEFAULT_DEMO_LAMPORTS = 5_000; // 0.000005 SOL — enough to land a real tx, trivial cost

/** Parse a secret key from a JSON byte array or a base58 string. */
function parseSecretKey(raw: string): Uint8Array {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    return Uint8Array.from(JSON.parse(trimmed) as number[]);
  }
  // base58 — decode using PublicKey's bs58 dependency indirectly via Keypair is not
  // possible, so do a minimal base58 decode here.
  return bs58Decode(trimmed);
}

const BS58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function bs58Decode(str: string): Uint8Array {
  const bytes: number[] = [0];
  for (const char of str) {
    const value = BS58_ALPHABET.indexOf(char);
    if (value === -1) throw new Error(`Invalid base58 character: ${char}`);
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += (bytes[j] ?? 0) * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Account for leading zeros.
  for (let k = 0; k < str.length && str[k] === '1'; k++) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
}

export interface DevnetTransferConfig {
  cluster?: SolanaCluster;
  rpcUrl?: string;
}

/** True when the env is configured to attempt a real devnet transfer. */
export function isDevnetTransferConfigured(): boolean {
  return Boolean(process.env.ESCROW_PAYER_SECRET_KEY && process.env.ESCROW_RECEIVER_PUBKEY);
}

/**
 * Send a real SOL transfer on devnet between the configured pre-funded keypairs.
 * Returns the confirmed transaction signature. Throws if not configured or if the
 * RPC call fails — callers should catch and fall back to a simulated signature so a
 * flaky RPC never breaks the demo flow.
 */
export async function sendDevnetTransfer(config: DevnetTransferConfig = {}): Promise<string> {
  const payerRaw = process.env.ESCROW_PAYER_SECRET_KEY;
  const receiverRaw = process.env.ESCROW_RECEIVER_PUBKEY;
  if (!payerRaw || !receiverRaw) {
    throw new Error('Devnet transfer not configured (missing payer/receiver env)');
  }

  const payer = Keypair.fromSecretKey(parseSecretKey(payerRaw));
  const receiver = new PublicKey(receiverRaw.trim());
  const lamports = Number(process.env.ESCROW_DEMO_LAMPORTS) || DEFAULT_DEMO_LAMPORTS;

  const connection = getConnection(config.cluster ?? 'devnet', config.rpcUrl);
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: receiver,
      lamports,
    }),
  );

  return sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: 'confirmed',
    maxRetries: 3,
  });
}
