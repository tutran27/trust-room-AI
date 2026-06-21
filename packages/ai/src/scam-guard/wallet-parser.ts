/**
 * Wallet-address and link parsing layer.
 *
 * The transcript is scanned for Solana (base58) addresses and URLs. Any address
 * that is not one of the verified deal/escrow wallets becomes a `external_wallet`
 * signal (technical brief §3.10); suspicious URLs become `phishing_link` signals
 * (§3.5). This is the layer that actually fires the EXTERNAL_WALLET rule — a flat
 * keyword list cannot, because an address is unbounded data, not a fixed phrase.
 */

/**
 * Base58 token matcher. Solana addresses are 32–44 base58 chars (no 0, O, I, l).
 * We match candidate tokens of that shape anywhere in the raw text (NOT the
 * accent-folded text, which would corrupt addresses) and validate length.
 */
const BASE58_ADDRESS_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi;

/** Known URL shorteners — links here hide their true destination. */
const URL_SHORTENERS = [
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'cutt.ly',
  'is.gd',
  'rb.gy',
  'shorturl.at',
  't.me', // telegram deep links double as off-platform lures
];

/**
 * Look-alike / lure tokens commonly embedded in phishing domains targeting
 * wallet users. Presence of any of these in a host is a strong signal.
 */
const PHISHING_DOMAIN_LURES = [
  'airdrop',
  'claim',
  'connect',
  'wallet-',
  '-wallet',
  'validate',
  'verify',
  'free-',
  'giveaway',
  'unlock',
  'restore',
  'metamask',
  'phantom-',
  'solana-',
];

export interface DetectedAddress {
  address: string;
  /** True when the address matches a known deal/escrow wallet. */
  isKnown: boolean;
}

export interface DetectedUrl {
  url: string;
  host: string;
  suspicious: boolean;
  reason: string | null;
}

export interface WalletParseInput {
  /** Raw (un-normalized) transcript text — addresses are case-sensitive. */
  text: string;
  /** Wallets that legitimately belong to this deal (buyer/seller/escrow). */
  knownAddresses?: Array<string | null | undefined>;
}

export interface WalletParseResult {
  addresses: DetectedAddress[];
  /** Detected addresses that are NOT part of the verified deal/escrow. */
  externalAddresses: string[];
  urls: DetectedUrl[];
  suspiciousUrls: DetectedUrl[];
}

/** Tokens that pass the base58 shape test but are common words, not addresses. */
function isLikelyAddress(token: string): boolean {
  // Require a mix of letters and digits — real addresses are high-entropy.
  const hasDigit = /[0-9]/.test(token);
  const hasUpper = /[A-Z]/.test(token);
  const hasLower = /[a-z]/.test(token);
  return hasDigit && (hasUpper || hasLower);
}

function extractHost(url: string): string {
  const stripped = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  const host = stripped.split(/[/?#]/)[0] ?? stripped;
  return host.toLowerCase();
}

function classifyUrl(url: string): DetectedUrl {
  const host = extractHost(url);
  const lowerUrl = url.toLowerCase();

  if (URL_SHORTENERS.some((s) => host === s || host.endsWith(`.${s}`))) {
    return { url, host, suspicious: true, reason: 'URL shortener hides the real destination.' };
  }
  const lure = PHISHING_DOMAIN_LURES.find((l) => host.includes(l) || lowerUrl.includes(l));
  if (lure) {
    return {
      url,
      host,
      suspicious: true,
      reason: `Domain/path contains a wallet-phishing lure ("${lure}").`,
    };
  }
  return { url, host, suspicious: false, reason: null };
}

/**
 * Parse a transcript chunk for on-chain addresses and links, classifying each
 * against the deal's known wallets and a phishing heuristic.
 */
export function parseWalletsAndLinks(input: WalletParseInput): WalletParseResult {
  const text = input.text ?? '';
  const known = new Set(
    (input.knownAddresses ?? [])
      .filter((a): a is string => typeof a === 'string' && a.length > 0),
  );

  const addresses: DetectedAddress[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(BASE58_ADDRESS_RE)) {
    const token = match[0];
    if (seen.has(token) || !isLikelyAddress(token)) continue;
    seen.add(token);
    addresses.push({ address: token, isKnown: known.has(token) });
  }

  const urls: DetectedUrl[] = [];
  const seenUrls = new Set<string>();
  for (const match of text.matchAll(URL_RE)) {
    const url = match[0].replace(/[.,;:)]+$/, ''); // trim trailing punctuation
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    urls.push(classifyUrl(url));
  }

  return {
    addresses,
    externalAddresses: addresses.filter((a) => !a.isKnown).map((a) => a.address),
    urls,
    suspiciousUrls: urls.filter((u) => u.suspicious),
  };
}
