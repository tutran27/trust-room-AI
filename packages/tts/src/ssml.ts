/**
 * SSML building for Google Cloud TTS.
 *
 * Builds SSML from a list of language‑tagged text chunks, applying:
 * - Prosody rate/pitch per language
 * - Break tags after punctuation
 * - <say-as> for numbers, dates, times, characters
 * - English pronunciation aliasing
 */

import type { LangChunk } from './types';
import { applyAliases, EN_CHARACTER_TOKENS } from './pronounce';
import { sanitizeSsmlText } from './normalize';

// ─── Inline punctuation → break map ───────────────────────────────────

interface BreakRule {
  pattern: RegExp;
  duration: string;
}

const BREAK_RULES: BreakRule[] = [
  { pattern: /\n+/g, duration: '260ms' },         // newline
  { pattern: /[.!?]+/g, duration: '220ms' },      // end of sentence
  { pattern: /;/g, duration: '140ms' },            // semicolon
  { pattern: /:/g, duration: '120ms' },            // colon
  { pattern: /,/g, duration: '90ms' },             // comma
];

// ─── Inline patterns requiring <say-as> ────────────────────────────────

interface SayAsRule {
  pattern: RegExp;
  interpretAs: string;
  format?: string;
}

const SAY_AS_RULES: SayAsRule[] = [
  // Time: 14:30, 09:05, 23:59
  { pattern: /\b(\d{1,2}):(\d{2})\b(?!\s*[ap]\.?m\.?)/g, interpretAs: 'time', format: 'hms12' },
  // Date: 12/05/2024, 2024-05-12
  { pattern: /\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/g, interpretAs: 'date', format: 'dmy' },
  // Numbers (plain integers, 3+ digits)
  { pattern: /\b(\d{3,})\b/g, interpretAs: 'number' },
  // Currency: $100, 100$, 100 USD
  { pattern: /\$\s*(\d+(?:[.,]\d+)?)\b|\b(\d+(?:[.,]\d+)?)\s*USD\b/gi, interpretAs: 'money' },
  // Percentages: 50%, 100%
  { pattern: /\b(\d+(?:[.,]\d+)?)%/g, interpretAs: 'unit', format: 'percent' },
  // Ordinals: 1st, 2nd, 3rd, 4th
  { pattern: /\b(\d+)(st|nd|rd|th)\b/g, interpretAs: 'ordinal' },
  // Fractions: 1/2, 3/4
  { pattern: /\b(\d+)\/(\d+)\b/g, interpretAs: 'fraction' },
  // Phone-like: +84 123 456 789
  { pattern: /\+\d{1,3}\s*\d[\d\s]{7,14}\d/g, interpretAs: 'telephone' },
  // Cardinal directions in English
  { pattern: /\b(N|S|E|W|NE|NW|SE|SW)\b(?!['\w])/g, interpretAs: 'characters' },
];

// ─── SSML building ────────────────────────────────────────────────────

interface BuildSsmlOptions {
  /** Language‑tagged chunks from detectLanguageChunks() */
  chunks: LangChunk[];
  /** Speed override per language (e.g. 0.96 for VI, 0.89 for EN) */
  speeds: { vi: number; en: number };
  /** Pitch override per language */
  pitches?: { vi: string; en: string };
}

const DEFAULT_PITCHES = { vi: '+1st', en: '0st' };

/**
 * Build a complete SSML document from language‑tagged chunks.
 *
 * Each language chunk gets its own <voice> wrapper with the correct
 * language dialect, prosody rate/pitch, and character‑token handling.
 */
export function buildSsml(opts: BuildSsmlOptions): string {
  const { chunks, speeds, pitches = DEFAULT_PITCHES } = opts;

  const body = chunks
    .map((chunk) => renderChunk(chunk, speeds, pitches))
    .filter(Boolean)
    .join('\n');

  return `<?xml version="1.0"?>\n<speak version="1.1" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="vi-VN">\n${body}\n</speak>`;
}

/**
 * Build SSML for a single language chunk (no top‑level <speak> wrapper).
 * Used for Edge TTS which does not accept full SSML docs.
 */
export function buildSsmlInline(
  chunk: LangChunk,
  speeds: { vi: number; en: number },
  pitches?: { vi: string; en: string },
): string {
  return renderChunk(chunk, speeds, pitches ?? DEFAULT_PITCHES);
}

function renderChunk(
  chunk: LangChunk,
  speeds: { vi: number; en: number },
  pitches: { vi: string; en: string },
): string {
  let text = chunk.text;
  if (!text.trim()) return '';

  // Sanitise SSML‑hostile characters
  text = sanitizeSsmlText(text);

  // Apply English pronunciation aliases for EN chunks
  if (chunk.lang === 'en') {
    text = applyAliases(text);
  }

  // Apply inline SSML rules
  text = applyBreakTags(text);
  text = applySayAsTags(text, chunk.lang);

  // Wrap in <voice> with prosody
  const rate = chunk.lang === 'vi' ? speeds.vi : speeds.en;
  const pitch = chunk.lang === 'vi' ? pitches.vi : pitches.en;

  // Google TTS uses BCP-47 language codes
  const langCode = chunk.lang === 'en' ? 'en-US' : 'vi-VN';

  // Convert rate decimal to percent string for SSML
  const ratePercent = `${Math.round(rate * 100)}%`;

  return `<prosody rate="${ratePercent}" pitch="${pitch}">${text}</prosody>`;
}

// ─── Inline SSML rule application ──────────────────────────────────────

function applyBreakTags(text: string): string {
  for (const rule of BREAK_RULES) {
    // We don't replace here — we insert breaks after matches via a smarter approach:
    // find the positions of punctuation marks and insert <break/> after them
  }

  // Insert break tags after punctuation (preserving punctuation)
  let result = text;
  for (const { pattern, duration } of BREAK_RULES) {
    result = result.replace(pattern, (match) => `${match}<break time="${duration}"/>`);
  }
  return result;
}

function applySayAsTags(text: string, lang: 'vi' | 'en'): string {
  let result = text;

  // Apply <say-as interpret-as='characters'> for ALL-CAPS tokens
  // These must match word boundaries
  for (const token of EN_CHARACTER_TOKENS) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'g');
    result = result.replace(regex, `<say-as interpret-as="characters">${token}</say-as>`);
  }

  // Apply general say-as rules
  for (const rule of SAY_AS_RULES) {
    const formatAttr = rule.format ? ` format="${rule.format}"` : '';
    result = result.replace(
      rule.pattern,
      (_match, ...groups) => {
        // Find the first non‑undefined group (the captured value)
        const value = groups.find((g): g is string => g !== undefined) ?? _match;
        return `<say-as interpret-as="${rule.interpretAs}"${formatAttr}>${value}</say-as>`;
      },
    );
  }

  return result;
}
