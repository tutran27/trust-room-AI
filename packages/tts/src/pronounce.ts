/**
 * English pronunciation normalisation.
 *
 * Converts technical terms into forms that TTS voices can pronounce
 * naturally — e.g. "API" → "A P I", "SQL" → "sequel".
 *
 * The alias map is applied longest‑phrase‑first to avoid partial
 * matches (e.g. "API Gateway" is replaced before "API").
 */

// ─── EN_ALIAS_MAP — sorted longest phrase first ───────────────────────

export interface AliasEntry {
  phrase: string;
  replacement: string;
}

export const EN_ALIAS_MAP: AliasEntry[] = [
  // --- Multi-word ---
  { phrase: 'API Gateway', replacement: 'A P I Gateway' },
  { phrase: 'API gateway', replacement: 'A P I gateway' },

  // --- Technical terms ---
  { phrase: 'NoSQL', replacement: 'no sequel' },
  { phrase: 'WebSocket', replacement: 'Web Socket' },
  { phrase: 'Websocket', replacement: 'Web Socket' },
  { phrase: 'TypeScript', replacement: 'Type Script' },
  { phrase: 'JavaScript', replacement: 'Java Script' },
  { phrase: 'PostgreSQL', replacement: 'Postgres sequel' },
  { phrase: 'GraphQL', replacement: 'Graph sequel' },

  // --- All-caps ---
  { phrase: 'JSON', replacement: 'Jason' },
  { phrase: 'SQL', replacement: 'sequel' },
  { phrase: 'UUID', replacement: 'U U I D' },
  { phrase: 'JWT', replacement: 'J W T' },
  { phrase: 'LLM', replacement: 'L L M' },
  { phrase: 'HTTP', replacement: 'H T T P' },
  { phrase: 'HTTPS', replacement: 'H T T P S' },
  { phrase: 'OAuth', replacement: 'O Auth' },
  { phrase: 'URL', replacement: 'U R L' },
  { phrase: 'URI', replacement: 'U R I' },

  // --- Single-word shorter matches (applied last) ---
  { phrase: 'API', replacement: 'A P I' },
  { phrase: 'SDK', replacement: 'S D K' },
  { phrase: 'GPT', replacement: 'G P T' },
  { phrase: 'AI', replacement: 'A I' },
  { phrase: 'ML', replacement: 'M L' },
];

/** ALL-CAPS tokens that should be read character‑by‑character */
export const EN_CHARACTER_TOKENS = new Set([
  'AI', 'ML', 'LLM', 'API', 'HTTP', 'HTTPS', 'JWT', 'GPT',
  'URL', 'URI', 'UUID', 'REST', 'SDK',
]);

/**
 * Apply the alias map to text, longest‑phrase‑first.
 * This ensures "API Gateway" is replaced before "API" can be.
 */
export function applyAliases(text: string): string {
  let result = text;
  for (const { phrase, replacement } of EN_ALIAS_MAP) {
    // Case‑insensitive replacement (but preserve original where possible)
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), replacement);
  }
  return result;
}

/**
 * Apply aliases ONLY to English chunks in mixed VI‑EN text.
 * Run on each LangChunk where lang === 'en' before SSML building.
 */
export function normalizeEnglishText(text: string): string {
  return applyAliases(text);
}
