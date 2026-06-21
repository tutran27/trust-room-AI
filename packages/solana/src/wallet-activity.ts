import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

/**
 * On-chain activity summary for a single wallet, used by the Wallet Risk Check.
 * All fields degrade gracefully: when the RPC is unreachable, `available` is
 * false and the numeric fields are null so callers can fall back to internal
 * (DB-only) scoring without throwing.
 */
export interface WalletOnChainActivity {
  /** True when the RPC call succeeded. False means the caller should degrade to internal-only scoring. */
  available: boolean;
  /** Number of signatures fetched (bounded by `limit`). Null when unavailable. */
  signatureCount: number | null;
  /** Unix seconds of the oldest signature we could see. Null when unknown/unavailable. */
  oldestBlockTime: number | null;
  /** Wallet age in whole days derived from `oldestBlockTime`. Null when unknown. */
  ageDays: number | null;
  /** True when `signatureCount === limit`, i.e. the real count is a lower bound. */
  reachedLimit: boolean;
  /** Human-readable error reason when `available` is false. */
  error?: string;
}

const DEFAULT_LIMIT = 100;
const DEFAULT_TIMEOUT_MS = 4000;

/** Reject a promise after `ms` so a slow/hung RPC cannot block the request. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Estimate a wallet's on-chain history via a public RPC. Uses
 * `getSignaturesForAddress` (no API key, works against devnet) to approximate
 * transaction count and wallet age. Never throws — RPC failures/timeouts are
 * folded into `{ available: false }` so the caller can degrade gracefully.
 */
export async function getWalletOnChainActivity(
  address: string,
  opts: {
    rpcUrl?: string;
    cluster?: 'devnet' | 'testnet' | 'mainnet-beta';
    limit?: number;
    timeoutMs?: number;
    connection?: Connection;
  } = {},
): Promise<WalletOnChainActivity> {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(address);
  } catch {
    return {
      available: false,
      signatureCount: null,
      oldestBlockTime: null,
      ageDays: null,
      reachedLimit: false,
      error: 'invalid wallet address',
    };
  }

  const connection =
    opts.connection ??
    new Connection(opts.rpcUrl ?? clusterApiUrl(opts.cluster ?? 'devnet'), 'confirmed');

  try {
    const signatures = await withTimeout(
      connection.getSignaturesForAddress(pubkey, { limit }),
      timeoutMs,
    );

    const signatureCount = signatures.length;
    const reachedLimit = signatureCount >= limit;

    // getSignaturesForAddress returns newest-first; the oldest fetched entry is last.
    let oldestBlockTime: number | null = null;
    for (let i = signatures.length - 1; i >= 0; i -= 1) {
      const bt = signatures[i]?.blockTime;
      if (typeof bt === 'number') {
        oldestBlockTime = bt;
        break;
      }
    }

    const ageDays =
      oldestBlockTime !== null
        ? Math.max(0, Math.floor((Date.now() / 1000 - oldestBlockTime) / 86400))
        : null;

    return {
      available: true,
      signatureCount,
      oldestBlockTime,
      ageDays,
      reachedLimit,
    };
  } catch (err) {
    return {
      available: false,
      signatureCount: null,
      oldestBlockTime: null,
      ageDays: null,
      reachedLimit: false,
      error: err instanceof Error ? err.message : 'on-chain check failed',
    };
  }
}
