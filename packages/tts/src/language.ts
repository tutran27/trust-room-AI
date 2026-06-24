/**
 * Mixed language detection for Vietnamese–English code‑switching.
 *
 * Meeting transcripts frequently switch between Vietnamese and English
 * technical terms ("Hôm nay bàn về API design cho WebSocket server").
 * This module detects the English spans and splits them so the TTS can
 * use the correct voice per language.
 */

import type { LangChunk, LanguageCode } from './types';

// ─── English term patterns ─────────────────────────────────────────────

/** Technical / strong English terms that should definitely be EN */
const STRONG_EN_TERMS = new Set([
  'api', 'sdk', 'websocket', 'gpt', 'json', 'realtime',
  'http', 'https', 'oauth', 'jwt', 'sql', 'nosql', 'llm',
  'ai', 'ml', 'url', 'uri', 'uuid', 'rest', 'graphql', 'grpc',
  'cli', 'gui', 'ide', 'yaml', 'toml', 'css', 'html', 'xml',
  'docker', 'kubernetes', 'terraform', 'ansible', 'git',
  'typescript', 'javascript', 'python', 'rust', 'node',
  'postgresql', 'mongodb', 'redis', 'qdrant', 'solana',
  'frontend', 'backend', 'middleware', 'middleware',
  'websocket', 'webhook', 'webassembly',
]);

/** Common English words that appear in VN‑EN mixed speech */
const COMMON_EN_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'you', 'your',
  'is', 'are', 'was', 'were', 'have', 'has', 'had', 'not',
  'but', 'from', 'they', 'them', 'their', 'what', 'which',
  'where', 'when', 'how', 'who', 'all', 'each', 'every',
  'some', 'any', 'no', 'yes', 'ok', 'okay', 'please',
  'thank', 'thanks', 'hello', 'hi', 'bye', 'goodbye',
  'yes', 'no', 'maybe', 'sure', 'right', 'wrong', 'good',
  'bad', 'new', 'old', 'big', 'small', 'high', 'low',
  'fast', 'slow', 'easy', 'hard', 'simple', 'complex',
  'open', 'close', 'start', 'stop', 'begin', 'end',
  'first', 'last', 'next', 'previous', 'final',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'eight', 'nine', 'ten', 'hundred', 'thousand', 'million',
  'more', 'less', 'most', 'least', 'very', 'too', 'enough',
  'here', 'there', 'now', 'then', 'today', 'tomorrow',
  'yesterday', 'again', 'always', 'never', 'often',
  'about', 'above', 'across', 'after', 'against', 'along',
  'among', 'around', 'at', 'before', 'behind', 'below',
  'beneath', 'beside', 'between', 'beyond', 'by', 'down',
  'during', 'except', 'for', 'from', 'in', 'inside', 'into',
  'near', 'of', 'off', 'on', 'out', 'outside', 'over',
  'through', 'to', 'toward', 'under', 'underneath', 'until',
  'up', 'upon', 'with', 'within', 'without',
]);

// ─── Language detection heuristics ─────────────────────────────────────

/** Check if a word looks Vietnamese (has Vietnamese diacritics) */
function looksVietnamese(word: string): boolean {
  return /[àáảãạăắằẵặâấầẫậđèéẻẽẹêếềễệìíỉĩịòóỏõọôốồỗộơớờỡợùúủũụưứừữựỳỹỷỵ]/.test(
    word.toLowerCase(),
  );
}

/** Check if a token looks like an ALL‑CAPS abbreviation */
function isAllCaps(word: string): boolean {
  return /^[A-Z]{2,}$/.test(word) && word.length <= 6;
}

/** Check if a token looks CamelCase (technical term) */
function isCamelCase(word: string): boolean {
  return /^[a-z]+[A-Z][a-zA-Z]*$/.test(word) || /^[A-Z][a-z]+[A-Z][a-zA-Z]*$/.test(word);
}

/** Check if a word is an English technical term (strong signal) */
function isStrongEnglishTerm(word: string): boolean {
  return STRONG_EN_TERMS.has(word.toLowerCase());
}

/** Check if a word is a common English word */
function isCommonEnglishWord(word: string): boolean {
  return COMMON_EN_WORDS.has(word.toLowerCase());
}

/** Guess the language of a single word */
function guessWordLang(word: string): 'vi' | 'en' {
  if (!word) return 'vi';

  // Strong signals
  if (isAllCaps(word)) return 'en';
  if (isCamelCase(word)) return 'en';
  if (isStrongEnglishTerm(word)) return 'en';
  if (looksVietnamese(word)) return 'vi';

  // Check for other scripts (Cyrillic, CJK, etc.) → treat as non-VI
  if (/[Ѐ-ӿ一-鿿぀-ゟ゠-ヿ]/.test(word)) return 'en';

  // Punctuation / numbers only → neutral (keep context)
  if (/^[\d\s.,!?;:()%$#@+\-*/=<>[\]{}"'«»…—–-]+$/.test(word)) return 'vi';

  // Common English — strong enough signal unless it has VN diacritics
  if (isCommonEnglishWord(word)) return 'en';

  // Fallback: if it has ASCII letters but no VI diacritics → en
  if (/^[a-zA-Z]+$/.test(word) && word.length >= 2) return 'en';

  return 'vi';
}

// ─── Main detection API ────────────────────────────────────────────────

/**
 * Split a mixed VI‑EN text into language‑labelled chunks.
 *
 * Heuristic: tokenise by whitespace, classify each word, then merge
 * consecutive runs of the same language. Short EN runs (≤2 characters)
 * are merged into neighbouring VI chunks.
 */
export function detectLanguageChunks(text: string): LangChunk[] {
  if (!text) return [];

  // Tokenise: words + whitespace + punctuation as separators.
  // We preserve punctuation in the chunks so SSML break tags work.
  const tokens = text.split(/(\s+)/);
  if (tokens.length === 0) return [{ lang: 'vi', text }];

  // Classify each content word; accumulate runs
  const runs: { lang: 'vi' | 'en'; words: string[] }[] = [];
  let currentLang: 'vi' | 'en' | null = null;
  let currentWords: string[] = [];

  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      // Whitespace — attach to current run if any, or skip (leading WS)
      if (currentWords.length > 0) currentWords.push(token);
      continue;
    }
    if (!token) continue;

    const wordLang = guessWordLang(token);

    if (currentLang === null) {
      currentLang = wordLang;
      currentWords = [token];
    } else if (wordLang === currentLang) {
      currentWords.push(token);
    } else {
      // Flush current run
      runs.push({ lang: currentLang, words: currentWords });
      currentLang = wordLang;
      currentWords = [token];
    }
  }
  if (currentLang !== null && currentWords.length > 0) {
    runs.push({ lang: currentLang, words: currentWords });
  }

  // Merge short EN runs into neighbouring VI
  const merged: LangChunk[] = [];
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i]!;
    if (run.lang === 'en' && run.words.join(' ').replace(/\s/g, '').length <= 2) {
      // Merge into the next VI chunk, or the previous one
      if (i + 1 < runs.length && runs[i + 1]!.lang === 'vi') {
        runs[i + 1]!.words = [...run.words, ...runs[i + 1]!.words];
        continue;
      }
      if (merged.length > 0 && merged[merged.length - 1]!.lang === 'vi') {
        merged[merged.length - 1]!.text += ' ' + run.words.join('');
        continue;
      }
    }
    merged.push({ lang: run.lang, text: run.words.join('') });
  }

  // Trim leading/trailing whitespace
  for (const chunk of merged) {
    chunk.text = chunk.text.trim();
  }
  return merged.filter((c) => c.text.length > 0);
}

/**
 * Quick language guess for a text when no mixed detection is needed.
 * Returns "vi" if any Vietnamese diacritics are found, else "vi" (safe default
 * since Vietnamese is the primary meeting language).
 */
export function guessLanguage(text: string): LanguageCode {
  if (!text) return 'vi';
  // Check for Vietnamese diacritics
  if (/[àáảãạăắằẵặâấầẫậđèéẻẽẹêếềễệìíỉĩịòóỏõọôốồỗộơớờỡợùúủũụưứừữựỳỹỷỵ]/.test(text.toLowerCase())) {
    return 'vi';
  }
  return 'vi'; // safe default
}
