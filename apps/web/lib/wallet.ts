// Wallet abstraction for the demo. Supports two backends:
//  1. Demo wallet  — an Ed25519 keypair generated + persisted in localStorage, so
//     the full nonce/sign/verify auth flow works with ZERO browser-extension setup.
//  2. Phantom      — window.solana, used automatically when available and chosen.
// Both produce a base58 public key (= Solana address) and a base58 detached
// signature over the auth message, exactly what the API's verify endpoint expects.

import bs58 from 'bs58';
import nacl from 'tweetnacl';

const DEMO_KEY = 'trustroom_demo_wallet';
const DEMO_SEED = Uint8Array.from([
  17, 34, 51, 68, 85, 102, 119, 136,
  153, 170, 187, 204, 221, 238, 1, 18,
  35, 52, 69, 86, 103, 120, 137, 154,
  171, 188, 205, 222, 239, 2, 19, 36,
]);

export type WalletKind = 'demo' | 'phantom';

export interface SignedAuth {
  address: string;
  signature: string;
}

function loadOrCreateDemoKeypair(): nacl.SignKeyPair {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(DEMO_KEY);
    if (stored) {
      try {
        return nacl.sign.keyPair.fromSecretKey(bs58.decode(stored));
      } catch {
        // fall through to regenerate
      }
    }
  }
  const kp = nacl.sign.keyPair.fromSeed(DEMO_SEED);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DEMO_KEY, bs58.encode(kp.secretKey));
  }
  return kp;
}

export function getDemoAddress(): string {
  return bs58.encode(loadOrCreateDemoKeypair().publicKey);
}

export function resetDemoWallet(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(DEMO_KEY);
}

export function hasPhantom(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).solana?.isPhantom);
}

/** Connect a Phantom wallet and return its base58 address. */
export async function connectPhantom(): Promise<string> {
  const provider = (window as any).solana;
  if (!provider?.isPhantom) throw new Error('Phantom wallet not found.');
  const res = await provider.connect();
  return res.publicKey.toString();
}

/** Sign the auth message with the given wallet kind, returning address + base58 sig. */
export async function signAuthMessage(kind: WalletKind, message: string): Promise<SignedAuth> {
  const messageBytes = new TextEncoder().encode(message);

  if (kind === 'phantom') {
    const provider = (window as any).solana;
    if (!provider?.isPhantom) throw new Error('Phantom wallet not found.');
    const address: string = provider.publicKey?.toString() ?? (await connectPhantom());
    const { signature } = await provider.signMessage(messageBytes, 'utf8');
    return { address, signature: bs58.encode(signature as Uint8Array) };
  }

  // demo
  const kp = loadOrCreateDemoKeypair();
  const signature = nacl.sign.detached(messageBytes, kp.secretKey);
  return { address: bs58.encode(kp.publicKey), signature: bs58.encode(signature) };
}

/** Short display form of a wallet address. */
export function shortAddress(address: string | null | undefined, head = 4, tail = 4): string {
  if (!address) return '—';
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}
