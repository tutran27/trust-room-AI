/**
 * Text chunking for low‑latency TTS.
 *
 * Splits text into clauses at sentence boundaries so each clause can be
 * synthesised independently and streamed immediately — no need to wait
 * for the full text to be processed.
 *
 * Soft chunk fallback handles the case where text is long but has no
 * natural sentence boundaries (common in meeting speech).
 */

import type { LangChunk, LanguageCode } from './types.js';
import { detectLanguageChunks } from './language.js';

const CHUNK_MIN_CHARS = 28;
const CHUNK_HARD_LIMIT = 90;

/**
 * A clause is a segment of text delimited by sentence‑ending punctuation.
 * Each clause is independent and can be TTS‑ed immediately.
 */
export interface Clause {
  text: string;
  lang: LanguageCode;
}

/**
 * Split full text into clauses for TTS pipelining.
 *
 * Strategy:
 * 1. Split by sentence boundaries (. ! ? ; \n)
 * 2. Detect language per clause
 * 3. Merge short adjacent clauses (same language)
 * 4. Apply soft fallback for over‑long clauses
 */
export function splitClauses(text: string): Clause[] {
  if (!text.trim()) return [];

  // Split by sentence boundaries (preserve the delimiter)
  const rawParts = text.split(/([^.!?;:\n]+[.!?;:\n]?)/).filter(Boolean);

  // Language‑tag each part
  const tagged: Clause[] = [];
  for (const part of rawParts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const chunks = detectLanguageChunks(trimmed);
    if (chunks.length === 0) continue;

    // If single language, keep it; if mixed, use first dominant
    const dominantLang = chunks.length === 1
      ? chunks[0]!.lang
      : 'vi' as LanguageCode;

    tagged.push({ text: trimmed, lang: dominantLang });
  }

  // Merge short adjacent clauses (same language)
  const merged: Clause[] = [];
  for (const clause of tagged) {
    const last = merged[merged.length - 1];

    if (last && last.lang === clause.lang && last.text.length < CHUNK_MIN_CHARS) {
      last.text += ' ' + clause.text;
    } else {
      merged.push({ ...clause });
    }
  }

  // Apply soft fallback for over‑long clauses
  const result: Clause[] = [];
  for (const clause of merged) {
    if (clause.text.length > CHUNK_HARD_LIMIT) {
      const split = softChunkFallback(clause.text);
      for (const s of split) {
        result.push({ text: s, lang: clause.lang });
      }
    } else {
      result.push(clause);
    }
  }

  return result;
}

/**
 * Soft chunk fallback: split a long clause without sentence boundaries.
 *
 * Tries (in order):
 * 1. Split at the last comma or colon within [CHUNK_MIN_CHARS, CHUNK_HARD_LIMIT]
 * 2. Split at the last space within that range
 * 3. Do NOT cut — let it pass as one chunk (better to be long than broken)
 */
function softChunkFallback(text: string): string[] {
  if (text.length <= CHUNK_HARD_LIMIT) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > CHUNK_HARD_LIMIT) {
    const segment = remaining.slice(0, CHUNK_HARD_LIMIT);

    // Try splitting at comma or colon
    const punctMatch = findLastMatch(segment, /[,:]/);
    if (punctMatch && punctMatch.index >= CHUNK_MIN_CHARS) {
      const splitAt = punctMatch.index + 1;
      chunks.push(remaining.slice(0, splitAt).trim());
      remaining = remaining.slice(splitAt).trim();
      continue;
    }

    // Try splitting at space
    const spaceMatch = findLastMatch(segment, /\s/);
    if (spaceMatch && spaceMatch.index >= CHUNK_MIN_CHARS) {
      chunks.push(remaining.slice(0, spaceMatch.index).trim());
      remaining = remaining.slice(spaceMatch.index + 1).trim();
      continue;
    }

    // No good split point — pass the rest as one chunk
    chunks.push(remaining.trim());
    remaining = '';
  }

  if (remaining.trim()) {
    chunks.push(remaining.trim());
  }

  return chunks;
}

/** Find the last occurrence index of a pattern within bounds */
function findLastMatch(text: string, pattern: RegExp): { index: number } | null {
  let match: RegExpExecArray | null = null;
  let last: { index: number } | null = null;
  const regex = new RegExp(pattern.source, 'g');

  while ((match = regex.exec(text)) !== null) {
    last = { index: match.index };
  }

  return last;
}
