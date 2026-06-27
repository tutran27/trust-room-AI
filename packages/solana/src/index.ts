import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
export { Connection, PublicKey, clusterApiUrl };
export { EscrowClient, ESCROW_PROGRAM_ID, EscrowState, DisputeOutcome } from './anchor-client.js';
export type { EscrowAccountData } from './anchor-client.js';

export type SolanaCluster = 'devnet' | 'testnet' | 'mainnet-beta';

/** Create an RPC connection. Prefer an explicit RPC URL (Helius/QuickNode) in prod. */
export function getConnection(cluster: SolanaCluster = 'devnet', rpcUrl?: string): Connection {
  return new Connection(rpcUrl ?? clusterApiUrl(cluster), 'confirmed');
}

/**
 * Derive the escrow PDA for a deal. The on-chain program owns one escrow account
 * per deal, seeded by a constant + the deal id hash. Keep the seed scheme in sync
 * with the Anchor program (`programs/escrow`).
 */
export function deriveEscrowPda(programId: PublicKey, dealIdHash: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('escrow'), Buffer.from(dealIdHash)], programId);
}

/** Returns true if a string is a syntactically valid Solana address (base58, on-curve check skipped). */
export function isValidAddress(value: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}
