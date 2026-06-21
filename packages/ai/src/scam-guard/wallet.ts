/**
 * Solana wallet address extraction + validation for the Scam Guard.
 *
 * A Solana address is a base58-encoded 32-byte ed25519 public key, which renders
 * as a 32-44 character base58 string. We don't pull in a base58 dependency here
 * (keeps @trustroom/ai dep-free); instead we decode candidates ourselves and
 * require the decoded payload to be exactly 32 bytes — that rejects look-alike
 * tokens (random alphanumerics, tx ids, etc.) far more reliably than a length
 * check alone.
 */

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_MAP: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (let i = 0; i < BASE58_ALPHABET.length; i++) m[BASE58_ALPHABET[i]!] = i;
  return m;
})();

/** Candidate base58-ish runs: 32-44 chars from the base58 alphabet (no 0,O,I,l). */
const CANDIDATE_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

/**
 * Decode a base58 string to bytes. Returns null when the string contains a
 * non-base58 character. (Big-integer-free byte accumulation so it works on any
 * runtime without BigInt assumptions.)
 */
function base58Decode(input: string): Uint8Array | null {
  if (input.length === 0) return null;
  const bytes: number[] = [0];
  for (const char of input) {
    const value = BASE58_MAP[char];
    if (value === undefined) return null;
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j]! * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Leading '1's in base58 encode leading zero bytes.
  for (let k = 0; k < input.length && input[k] === '1'; k++) {
    bytes.push(0);
  }
  return Uint8Array.from(bytes.reverse());
}

/** True when `value` is a syntactically valid Solana address (decodes to 32 bytes). */
export function isValidSolanaAddress(value: string): boolean {
  if (value.length < 32 || value.length > 44) return false;
  const decoded = base58Decode(value);
  return decoded !== null && decoded.length === 32;
}

/**
 * Extract all valid Solana wallet addresses found in free text, de-duplicated and
 * preserving first-seen order. Candidate runs that don't decode to 32 bytes are
 * dropped, so this is safe to run over arbitrary chat transcripts.
 */
export function extractSolanaAddresses(text: string): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of text.matchAll(CANDIDATE_RE)) {
    const candidate = match[0];
    if (isValidSolanaAddress(candidate) && !seen.has(candidate)) {
      seen.add(candidate);
      out.push(candidate);
    }
  }
  return out;
}

/**
 * Given the wallet addresses extracted from text and the set of wallets that
 * legitimately belong to a deal (buyer / seller / escrow), return the addresses
 * that are NOT part of the deal. A non-empty result means an external wallet was
 * referenced — the trigger for the EXTERNAL_WALLET rule.
 */
export function findExternalAddresses(text: string, knownWallets: string[]): string[] {
  const known = new Set(knownWallets.map((w) => w.trim()).filter(Boolean));
  return extractSolanaAddresses(text).filter((addr) => !known.has(addr));
}
