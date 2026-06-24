/**
 * Text normalisation — runs BEFORE any TTS synthesis.
 *
 * Cleans text, normalises URLs, emails, punctuation, and expands
 * Vietnamese place names so TTS voices pronounce them naturally.
 */

/** Normalise text before TTS synthesis */
export function normalizeText(text: string): string {
  if (!text) return '';

  let s = text;

  // Strip emotion/metadata tags that LLMs sometimes inject
  s = s.replace(/\[emotion:[^\]]*\]/gi, '');
  s = s.replace(/\[laughs?\]|\[chuckles?\]|\[sighs?\]/gi, '');
  s = s.replace(/\(laughs?\)|\(chuckles?\)|\(sighs?\)/gi, '');

  // Normalise Vietnamese place names
  const PLACE_ALIASES: Array<{ pattern: RegExp; replacement: string }> = [
    { pattern: /\bTP\.?\s*HCM\b/gi, replacement: 'Thành phố Hồ Chí Minh' },
    { pattern: /\bTP\.?\s*Hà Nội\b/gi, replacement: 'Thành phố Hà Nội' },
    { pattern: /\bTP\.?\s*Đà Nẵng\b/gi, replacement: 'Thành phố Đà Nẵng' },
    { pattern: /\bTP\.?\s*Cần Thơ\b/gi, replacement: 'Thành phố Cần Thơ' },
    { pattern: /\bHCM\b(?!\s*[A-Z])/g, replacement: 'Hồ Chí Minh' },
  ];
  for (const { pattern, replacement } of PLACE_ALIASES) {
    s = s.replace(pattern, replacement);
  }

  // URLs → spoken cue
  s = s.replace(/\bhttps?:\/\/[^\s,.;:!?)]+/gi, 'đường dẫn website');
  s = s.replace(/\bwww\.[a-zA-Z0-9.-]+\.[a-z]{2,}/gi, 'đường dẫn website');

  // Emails → spoken cue
  s = s.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi, 'địa chỉ email');

  // Long ellipsis → single ellipsis character
  s = s.replace(/\.{3,}/g, '…');

  // Deduplicate repeated punctuation
  s = s.replace(/!{2,}/g, '!');
  s = s.replace(/\?{2,}/g, '?');
  s = s.replace(/,{2,}/g, ',');

  // Space after punctuation if missing
  s = s.replace(/([.!?;:,])([A-Za-z0-9À-ỹ])/g, '$1 $2');

  // Collapse multi-space
  s = s.replace(/[ \t]{2,}/g, ' ');

  // Trim
  s = s.trim();

  return s;
}

/**
 * Strip SSML‑hostile characters that can break Google TTS parsing.
 */
export function sanitizeSsmlText(text: string): string {
  return text
    .replace(/&/g, 'and')
    .replace(/</g, ' ')
    .replace(/>/g, ' ')
    .replace(/"/g, '')
    .replace(/'/g, '');
}
