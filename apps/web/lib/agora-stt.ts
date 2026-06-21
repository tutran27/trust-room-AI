export interface AgoraRealtimeTranscriptChunk {
  chunkId: string;
  speakerUid: string | number | null;
  speakerLabel: string;
  text: string;
  language: string;
  translatedText: string | null;
  targetLanguage: string | null;
  confidence: number | null;
  startTime: number | null;
  endTime: number | null;
  isPartial: boolean;
  isFinal: boolean;
  receivedAt: number;
}

interface AgoraWordLike {
  text?: string;
  word?: string;
}

interface AgoraTranslationLike {
  text?: string;
  content?: string;
  target?: string;
  targetLanguage?: string;
  language?: string;
}

function uint8ArrayToText(data: Uint8Array) {
  return new TextDecoder().decode(data);
}

async function maybeGunzip(data: Uint8Array) {
  if (
    typeof DecompressionStream === 'undefined' ||
    data.length < 2 ||
    data[0] !== 0x1f ||
    data[1] !== 0x8b
  ) {
    return uint8ArrayToText(data);
  }

  const exactBuffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer;
  const stream = new Blob([exactBuffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buffer = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(buffer);
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function buildText(payload: Record<string, unknown>) {
  const direct = firstNonEmptyString(
    payload.text,
    payload.content,
    payload.transcript,
    payload.message,
    payload.data,
  );
  if (direct) {
    return direct;
  }

  const words = Array.isArray(payload.words) ? (payload.words as AgoraWordLike[]) : [];
  const fromWords = words
    .map((word) => firstNonEmptyString(word.text, word.word))
    .filter(Boolean)
    .join(' ')
    .trim();

  return fromWords;
}

function buildTranslation(payload: Record<string, unknown>) {
  const translations = Array.isArray(payload.trans) ? (payload.trans as AgoraTranslationLike[]) : [];
  const firstTranslation = translations.find((item) =>
    Boolean(firstNonEmptyString(item.text, item.content)),
  );

  const translatedText = firstTranslation
    ? firstNonEmptyString(firstTranslation.text, firstTranslation.content)
    : firstNonEmptyString(payload.translation, payload.translatedText);

  const targetLanguage = firstTranslation
    ? firstNonEmptyString(
        firstTranslation.target,
        firstTranslation.targetLanguage,
        firstTranslation.language,
      )
    : firstNonEmptyString(payload.targetLanguage, payload.translationLanguage);

  return {
    translatedText: translatedText || null,
    targetLanguage: targetLanguage || null,
  };
}

function normalizePayload(payload: Record<string, unknown>): AgoraRealtimeTranscriptChunk | null {
  const text = buildText(payload);
  if (!text) {
    return null;
  }

  const translation = buildTranslation(payload);
  const chunkId = firstNonEmptyString(
    payload.sid,
    payload.sentence_id,
    payload.sentenceId,
    payload.id,
  );
  const speakerUid = payload.uid ?? payload.speakerUid ?? payload.speaker_uid ?? null;
  const language = firstNonEmptyString(
    payload.lang,
    payload.language,
    payload.src_language,
    payload.sourceLanguage,
  );
  const isFinal =
    payload.is_final === true ||
    payload.final === true ||
    payload.isFinal === true ||
    payload.end_of_segment === true;

  const startTime = numberOrNull(payload.start_time) ?? numberOrNull(payload.startTime);
  const endTime =
    numberOrNull(payload.end_time) ??
    numberOrNull(payload.endTime) ??
    numberOrNull(payload.duration);

  return {
    chunkId:
      chunkId ||
      `${String(speakerUid ?? 'speaker')}:${startTime ?? 'na'}:${text.slice(0, 24)}`,
    speakerUid:
      typeof speakerUid === 'string' || typeof speakerUid === 'number'
        ? speakerUid
        : null,
    speakerLabel:
      typeof speakerUid === 'string' || typeof speakerUid === 'number'
        ? `uid ${speakerUid}`
        : 'speaker',
    text,
    language: language || 'und',
    translatedText: translation.translatedText,
    targetLanguage: translation.targetLanguage,
    confidence:
      numberOrNull(payload.confidence) ??
      numberOrNull(payload.text_confidence) ??
      numberOrNull(payload.score),
    startTime,
    endTime,
    isPartial: !isFinal,
    isFinal,
    receivedAt: Date.now(),
  };
}

function tryParseNestedJson(value: string) {
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function collectNormalizedChunks(input: unknown): AgoraRealtimeTranscriptChunk[] {
  if (Array.isArray(input)) {
    return input.flatMap((item) => collectNormalizedChunks(item));
  }

  if (!input || typeof input !== 'object') {
    if (typeof input === 'string') {
      const nested = tryParseNestedJson(input);
      return nested ? collectNormalizedChunks(nested) : [];
    }
    return [];
  }

  const payload = input as Record<string, unknown>;
  const direct = normalizePayload(payload);
  if (direct) {
    return [direct];
  }

  const nestedKeys = [
    'data',
    'payload',
    'result',
    'results',
    'streamMessage',
    'stream_message',
    'segment',
    'segments',
    'transcript',
    'transcripts',
    'message',
    'messages',
    'items',
    'content',
  ] as const;

  const collected: AgoraRealtimeTranscriptChunk[] = [];
  for (const key of nestedKeys) {
    if (!(key in payload)) {
      continue;
    }

    collected.push(...collectNormalizedChunks(payload[key]));
  }

  return collected;
}

export async function decodeAgoraSttPayload(payload: Uint8Array) {
  const rawText = await maybeGunzip(payload);
  const parsed = JSON.parse(rawText) as unknown;
  return collectNormalizedChunks(parsed);
}

export function getMeetingSttPusherUidFromState(pusherUid: number | null | undefined) {
  if (!pusherUid || !Number.isFinite(pusherUid)) {
    return null;
  }
  return pusherUid;
}
