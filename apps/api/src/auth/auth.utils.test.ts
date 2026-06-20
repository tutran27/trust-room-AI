import { describe, expect, it } from 'vitest';
import * as nacl from 'tweetnacl';
import bs58 from 'bs58';
import {
  buildAuthMessage,
  constantTimeHexEqual,
  hashNonce,
  isValidSignature,
  isValidSolanaAddress,
  verifyDetachedSignature,
} from './auth.utils';

describe('auth.utils', () => {
  it('builds the canonical auth message', () => {
    const message = buildAuthMessage({
      domain: 'localhost',
      uri: 'http://localhost:3000',
      wallet: '11111111111111111111111111111111',
      nonce: 'nonce-value',
      issuedAt: new Date('2026-06-20T00:00:00.000Z'),
      expiresAt: new Date('2026-06-20T00:05:00.000Z'),
    });

    expect(message).toContain('TrustRoom AI authentication');
    expect(message).toContain('Nonce: nonce-value');
    expect(message).toContain('Expiration Time: 2026-06-20T00:05:00.000Z');
  });

  it('hashes and compares nonce hashes in constant time', () => {
    const first = hashNonce('abc');
    const second = hashNonce('abc');
    const third = hashNonce('xyz');

    expect(constantTimeHexEqual(first, second)).toBe(true);
    expect(constantTimeHexEqual(first, third)).toBe(false);
  });

  it('validates base58 Solana wallet and signature payloads', () => {
    const keypair = nacl.sign.keyPair();
    const wallet = bs58.encode(keypair.publicKey);
    const signature = bs58.encode(new Uint8Array(64).fill(1));

    expect(isValidSolanaAddress(wallet)).toBe(true);
    expect(isValidSolanaAddress('not-a-wallet')).toBe(false);
    expect(isValidSignature(signature)).toBe(true);
    expect(isValidSignature('bad-signature')).toBe(false);
  });

  it('verifies detached ed25519 signatures', () => {
    const keypair = nacl.sign.keyPair();
    const message = 'TrustRoom AI authentication';
    const signature = nacl.sign.detached(
      new TextEncoder().encode(message),
      keypair.secretKey,
    );

    expect(
      verifyDetachedSignature({
        message,
        signature: bs58.encode(signature),
        wallet: bs58.encode(keypair.publicKey),
      }),
    ).toBe(true);
  });
});
