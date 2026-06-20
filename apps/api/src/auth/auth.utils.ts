import bs58 from 'bs58';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import * as nacl from 'tweetnacl';

export function isValidSolanaAddress(value: string): boolean {
  try {
    return bs58.decode(value).length === 32;
  } catch {
    return false;
  }
}

export function isValidSignature(value: string): boolean {
  try {
    return bs58.decode(value).length === 64;
  } catch {
    return false;
  }
}

export function createNonce(): string {
  return randomBytes(32).toString('base64url');
}

export function hashNonce(rawNonce: string): string {
  return createHash('sha256').update(rawNonce, 'utf8').digest('hex');
}

export function constantTimeHexEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function buildAuthMessage(input: {
  domain: string;
  uri: string;
  wallet: string;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
}): string {
  return [
    'TrustRoom AI authentication',
    `Domain: ${input.domain}`,
    `URI: ${input.uri}`,
    `Wallet: ${input.wallet}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt.toISOString()}`,
    `Expiration Time: ${input.expiresAt.toISOString()}`,
  ].join('\n');
}

export function verifyDetachedSignature(input: {
  message: string;
  signature: string;
  wallet: string;
}): boolean {
  const messageBytes = new TextEncoder().encode(input.message);
  const signatureBytes = bs58.decode(input.signature);
  const publicKeyBytes = bs58.decode(input.wallet);
  return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
}
