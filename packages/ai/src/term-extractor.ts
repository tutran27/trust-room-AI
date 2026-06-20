import { LLMClient } from './llm.js';

export interface ExtractedTermsResult {
  parties: Array<{ name: string; role: string; wallet?: string }>;
  deliverables: Array<{
    description: string;
    deadline?: string;
    amount?: string;
  }>;
  milestones: Array<{
    name: string;
    description: string;
    amount?: string;
    deadline?: string;
  }>;
  totalAmount?: string;
  currency?: string;
  deadline?: string;
  disputeResolution?: string;
  notes?: string;
  rawText: string;
  /** Distinguishes a real LLM extraction from the deterministic heuristic fallback. */
  source: 'llm' | 'heuristic';
  /** Heuristic-only: fields the deterministic extractor could not fill. */
  missingFields?: string[];
  /** Heuristic-only: rough confidence in the deterministic extraction. */
  confidence?: number;
}

const EXTRACTION_PROMPT = `You are a legal/contract term extractor. Analyze the following deal description
and extract structured terms. Return a JSON object with the following structure:
{
  "parties": [{ "name": "string", "role": "string", "wallet": "optional solana address" }],
  "deliverables": [{ "description": "string", "deadline": "optional ISO date", "amount": "optional lamports" }],
  "milestones": [{ "name": "string", "description": "string", "amount": "optional lamports", "deadline": "optional ISO date" }],
  "totalAmount": "total in lamports if mentioned",
  "currency": "SOL or USDC",
  "deadline": "overall deadline ISO date if mentioned",
  "disputeResolution": "how disputes should be resolved",
  "notes": "any additional important terms"
}

Deal description:
`;

// base58 (Solana) address — 32-44 chars, no 0/O/I/l. Word-bounded.
const WALLET_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
// amount + token, e.g. "5 SOL", "100 USDC", "2.5 sol"
const AMOUNT_TOKEN_RE = /(\d+(?:\.\d+)?)\s*(sol|usdc)\b/gi;
// bare amount fallback, e.g. "$1,000", "1000"
const BARE_AMOUNT_RE = /(?:\$|amount[:\s]+)?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)/i;
// date-ish phrases — ISO dates or "in N days/weeks"
const ISO_DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/;
const RELATIVE_DEADLINE_RE =
  /\b(?:in|within|trong|sau)\s+(\d+)\s*(day|days|week|weeks|ngày|tuần)\b/i;

/**
 * Deterministic, demo-useful term extraction. Pulls amount + token, wallet-like
 * base58 strings, and deadline phrasing via regex/keywords. No network, never
 * throws. Confidence is intentionally low (~0.4) to signal it is a heuristic.
 */
export function extractTermsHeuristic(dealDescription: string): ExtractedTermsResult {
  const text = dealDescription ?? '';

  // Wallets
  const wallets = Array.from(new Set((text.match(WALLET_RE) ?? []).map((w) => w.trim())));
  const parties: ExtractedTermsResult['parties'] = wallets.map((wallet, index) => ({
    name: index === 0 ? 'Party A' : index === 1 ? 'Party B' : `Party ${index + 1}`,
    role: index === 0 ? 'buyer' : index === 1 ? 'seller' : 'participant',
    wallet,
  }));

  // Amount + token
  let totalAmount: string | undefined;
  let currency: string | undefined;
  const amountMatch = AMOUNT_TOKEN_RE.exec(text);
  AMOUNT_TOKEN_RE.lastIndex = 0; // reset stateful regex
  if (amountMatch) {
    totalAmount = amountMatch[1];
    currency = amountMatch[2]!.toUpperCase();
  } else {
    const bare = BARE_AMOUNT_RE.exec(text);
    if (bare) totalAmount = bare[1]!.replace(/,/g, '');
  }

  // Deadline
  let deadline: string | undefined;
  const isoDate = ISO_DATE_RE.exec(text);
  if (isoDate) {
    deadline = isoDate[0];
  } else {
    const rel = RELATIVE_DEADLINE_RE.exec(text);
    if (rel) deadline = `${rel[1]} ${rel[2]}`;
  }

  const missingFields: string[] = [];
  if (parties.length === 0) missingFields.push('parties');
  if (!totalAmount) missingFields.push('totalAmount');
  if (!currency) missingFields.push('currency');
  if (!deadline) missingFields.push('deadline');

  const deliverables: ExtractedTermsResult['deliverables'] = text.trim()
    ? [
        {
          description:
            text.trim().length > 160 ? `${text.trim().slice(0, 157)}...` : text.trim(),
          deadline,
          amount: totalAmount,
        },
      ]
    : [];

  return {
    parties,
    deliverables,
    milestones: [],
    totalAmount,
    currency,
    deadline,
    disputeResolution: undefined,
    notes: 'Extracted by deterministic heuristic (no LLM key configured).',
    rawText: dealDescription,
    source: 'heuristic',
    missingFields,
    confidence: 0.4,
  };
}

export async function extractTerms(
  client: LLMClient,
  dealDescription: string,
): Promise<ExtractedTermsResult> {
  if (!client.isConfigured()) {
    return extractTermsHeuristic(dealDescription);
  }

  try {
    const result = await client.chatWithJSON<ExtractedTermsResult>(
      [{ role: 'user', content: EXTRACTION_PROMPT + dealDescription }],
      { temperature: 0.1 },
    );

    return {
      ...result,
      rawText: dealDescription,
      source: 'llm',
    };
  } catch {
    return extractTermsHeuristic(dealDescription);
  }
}
