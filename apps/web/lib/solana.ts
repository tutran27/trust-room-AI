/**
 * Solana transaction helpers for the frontend.
 *
 * Receives a base64-encoded unsigned tx from the API, signs it with
 * the user's Phantom wallet, and sends it to devnet.
 */

import {
  Connection,
  Transaction,
  clusterApiUrl,
} from '@solana/web3.js';

const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('devnet');

/** Singleton connection to Solana devnet. */
export function getConnection(): Connection {
  return new Connection(SOLANA_RPC, 'confirmed');
}

/**
 * Get the Phantom wallet provider from window.
 */
function getPhantomProvider(): any {
  if (typeof window === 'undefined') return null;
  const provider = (window as any).solana;
  if (provider?.isPhantom) return provider;
  return null;
}

/**
 * Check if Phantom wallet is available in the browser.
 */
export function isPhantomInstalled(): boolean {
  return getPhantomProvider() !== null;
}

/**
 * Ensure Phantom is connected and return the address.
 */
export async function ensurePhantomConnected(): Promise<string> {
  const provider = getPhantomProvider();
  if (!provider) throw new Error('Phantom wallet not found. Please install Phantom.');
  if (!provider.publicKey) {
    await provider.connect();
  }
  return provider.publicKey.toString();
}

/**
 * Sign and send a base64-encoded transaction via Phantom.
 *
 * @param txBase64 - base64-encoded unsigned transaction from the API
 * @returns tx signature (base58 string)
 */
export async function signAndSendTx(txBase64: string): Promise<string> {
  const provider = getPhantomProvider();
  if (!provider) throw new Error('Phantom wallet not found. Please install Phantom.');

  if (!provider.publicKey) {
    await provider.connect();
  }

  // Decode the base64 transaction
  const txBytes = Uint8Array.from(Buffer.from(txBase64, 'base64'));
  const tx = Transaction.from(txBytes);

  // Get fresh blockhash
  const connection = getConnection();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = provider.publicKey;

  // User signs via Phantom popup
  const signedTx = await provider.signTransaction(tx);

  // Send to devnet
  const signature = await connection.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  // Wait for confirmation using blockheight strategy (avoids "Blockhash not found" on devnet)
  const latestBlockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    'confirmed',
  );

  return signature;
}
