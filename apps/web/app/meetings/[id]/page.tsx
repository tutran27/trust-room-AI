'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Skeleton,
  Textarea,
} from '@trustroom/ui';
import { AppShell } from '../../../components/app-shell';
import { AuthGate } from '../../../components/auth-gate';
import { MeetingLobby } from '../../../components/meeting-lobby';
import { MeetingRtcPanel } from '../../../components/meeting-rtc-panel';
import {
  useAddMeetingTranscript,
  useAddMeetingTranslation,
  useAgoraToken,
  useCreateMeetingInvite,
  useJoinMeetingByToken,
  useMeeting,
  useMeetingRiskEvents,
  useMeetingSttState,
  useMeetingTranscripts,
  useStartMeetingStt,
  useStopMeetingStt,
} from '../../../hooks/use-api';
import { type AgoraRealtimeTranscriptChunk } from '../../../lib/agora-stt';
import { GroqSttClient } from '../../../lib/groq-stt';
import { useRealtimeTts, type TtsSpeakerMode } from '../../../hooks/use-realtime-tts';
import { formatRelativeTime } from '../../../lib/format';
import { shortAddress } from '../../../lib/wallet';
import { useAuth } from '../../../providers/auth-provider';
import { useSocket } from '../../../providers/socket-provider';
import { TranslationPanel } from '../../../components/translation-panel';

interface RealtimeEntry {
  id: string;
  speakerLabel: string;
  text: string;
  language: string;
  translatedText: string | null;
  targetLanguage: string | null;
  startTime: number | null;
  endTime: number | null;
  isFinal: boolean;
  updatedAt: number;
  source: 'stream' | 'persisted';
}

const SPEAKER_TURN_SILENCE_WINDOW_SECONDS = 14;

function detectTranscriptLanguage(
  text: string,
  reportedLanguage?: string | null,
): 'vi' | 'en' | 'auto' {
  const normalizedReported = (reportedLanguage ?? '').trim().toLowerCase();
  if (
    normalizedReported.startsWith('en') ||
    normalizedReported === 'english'
  ) {
    return 'en';
  }
  if (
    normalizedReported.startsWith('vi') ||
    normalizedReported === 'vietnamese'
  ) {
    return 'vi';
  }

  const normalizedText = text.trim().toLowerCase();
  if (!normalizedText) {
    return 'auto';
  }

  // Strong Vietnamese signal: has diacritics → definitely vi
  const hasVietnameseDiacritics =
    /[ăâêôơưđáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(
      normalizedText,
    );
  if (hasVietnameseDiacritics) {
    return 'vi';
  }

  // Common English signals (expanded list)
  const englishSignals = [
    'hello', 'hi', 'thanks', 'thank you', 'please', 'okay', 'ok',
    'yes', 'no', 'deal', 'payment', 'contract', 'meeting', 'delivery',
    'price', 'transfer', 'telegram', 'whatsapp', 'buy', 'sell', 'trade',
    'agree', 'accept', 'confirm', 'reject', 'propose', 'offer',
    'percent', 'amount', 'total', 'balance', 'wallet', 'token',
    'address', 'deposit', 'withdraw', 'receive', 'send', 'ship',
    'insurance', 'escrow', 'dispute', 'resolution', 'arbitration',
    'quality', 'inspection', 'guarantee', 'sample', 'order',
    'discount', 'commission', 'fee', 'tax', 'shipping', 'tracking',
    'the', 'this', 'that', 'with', 'from', 'have', 'will', 'would',
    'could', 'should', 'shall', 'about', 'which', 'there', 'their',
    'what', 'when', 'where', 'how', 'are', 'were', 'been', 'been',
    'only', 'just', 'also', 'very', 'good', 'great', 'sure', 'right',
    'time', 'day', 'week', 'month', 'year', 'thing', 'people',
  ];
  const englishHits = englishSignals.filter((token) => {
    const idx = normalizedText.indexOf(token);
    // Must be a whole-word match (not part of another word)
    if (idx === -1) return false;
    const before = idx === 0 ? ' ' : normalizedText[idx - 1];
    const after = idx + token.length >= normalizedText.length ? ' ' : normalizedText[idx + token.length];
    return !/[a-z]/i.test(before) && !/[a-z]/i.test(after);
  }).length;

  const asciiLetters =
    (normalizedText.match(/[a-z]/g) ?? []).length;
  const nonAsciiLetters =
    (normalizedText.match(/[à-ỹ]/gi) ?? []).length;

  // Strong English signal: multiple signal words or high ASCII ratio
  if (englishHits >= 2) {
    return 'en';
  }

  // Ratio-based detection
  const totalChars = normalizedText.replace(/\s/g, '').length;
  if (totalChars > 0) {
    // High ASCII → likely English
    if (asciiLetters / totalChars > 0.6 && nonAsciiLetters / totalChars < 0.05) {
      return 'en';
    }
    // High non-ASCII → likely Vietnamese (but no diacritics still means uncertain)
    if (nonAsciiLetters / totalChars > 0.3) {
      return 'vi';
    }
  }

  // When uncertain, let the backend auto-detect
  return 'auto';
}

function normalizeRealtimeText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function mergeRealtimeText(currentText: string, nextText: string) {
  const left = normalizeRealtimeText(currentText);
  const right = normalizeRealtimeText(nextText);

  if (!left) return right;
  if (!right) return left;
  if (left === right || left.endsWith(right)) {
    return left;
  }
  if (right.startsWith(left)) {
    return right;
  }

  const leftWords = left.split(/\s+/);
  const rightWords = right.split(/\s+/);
  const maxOverlap = Math.min(leftWords.length, rightWords.length, 12);

  for (let overlap = maxOverlap; overlap >= 1; overlap -= 1) {
    const leftSuffix = leftWords.slice(-overlap).join(' ');
    const rightPrefix = rightWords.slice(0, overlap).join(' ');
    if (leftSuffix === rightPrefix) {
      return `${left} ${rightWords.slice(overlap).join(' ')}`.trim();
    }
  }

  return `${left} ${right}`.trim();
}

function isRealtimeTextEquivalent(currentText: string, nextText: string) {
  const left = normalizeRealtimeText(currentText);
  const right = normalizeRealtimeText(nextText);

  if (!left || !right) {
    return false;
  }

  return (
    left === right ||
    left.startsWith(right) ||
    right.startsWith(left) ||
    left.endsWith(right) ||
    right.endsWith(left)
  );
}

function shouldMergeRealtimeEntries(previous: RealtimeEntry | undefined, entry: RealtimeEntry) {
  if (!previous) {
    return false;
  }

  if (
    previous.speakerLabel !== entry.speakerLabel ||
    previous.language !== entry.language ||
    previous.source !== entry.source
  ) {
    return false;
  }

  const previousEnd = previous.endTime ?? previous.startTime;
  const entryStart = entry.startTime ?? entry.endTime;
  const timingGap =
    previousEnd !== null && entryStart !== null ? Math.abs(entryStart - previousEnd) : null;

  return (
    isRealtimeTextEquivalent(previous.text, entry.text) ||
    (timingGap !== null && timingGap <= 4 && (!previous.isFinal || !entry.isFinal))
  );
}

function shouldReplaceOptimisticEntry(entry: RealtimeEntry, transcript: {
  speakerLabel?: string;
  content?: string;
  language?: string;
  startTime?: number;
  endTime?: number | null;
}) {
  if (entry.source !== 'stream') {
    return false;
  }

  const sameSpeaker = entry.speakerLabel === (transcript.speakerLabel ?? 'speaker');
  const sameLanguage = entry.language === (transcript.language ?? 'und');
  const sameText = isRealtimeTextEquivalent(entry.text, transcript.content ?? '');
  const transcriptStart = transcript.startTime ?? null;
  const transcriptEnd = transcript.endTime ?? null;
  const entryTime = entry.startTime ?? entry.endTime;
  const transcriptTime = transcriptStart ?? transcriptEnd;
  const closeTime =
    entryTime !== null && transcriptTime !== null ? Math.abs(entryTime - transcriptTime) <= 4 : true;

  return sameSpeaker && sameLanguage && sameText && closeTime;
}

function shouldBelongToSameSpeakerTurn(
  previous: RealtimeEntry | undefined,
  next: {
    speakerLabel: string;
    language: string;
    text: string;
    startTime: number | null;
    endTime: number | null;
    updatedAt: number;
    isFinal: boolean;
  },
) {
  if (!previous) {
    return false;
  }

  if (
    previous.speakerLabel !== next.speakerLabel ||
    previous.language !== next.language
  ) {
    return false;
  }

  const previousTime = previous.endTime ?? previous.startTime ?? previous.updatedAt / 1000;
  const nextTime = next.endTime ?? next.startTime ?? next.updatedAt / 1000;
  const timeGap = Math.abs(nextTime - previousTime);

  return (
    !previous.isFinal ||
    !next.isFinal ||
    isRealtimeTextEquivalent(previous.text, next.text) ||
    timeGap <= SPEAKER_TURN_SILENCE_WINDOW_SECONDS
  );
}

function groupRealtimeEntries(entries: RealtimeEntry[]) {
  const grouped: RealtimeEntry[] = [];

  for (const entry of [...entries].sort((left, right) => left.updatedAt - right.updatedAt)) {
    const previous = grouped[grouped.length - 1];
    const canMerge =
      shouldMergeRealtimeEntries(previous, entry) ||
      shouldBelongToSameSpeakerTurn(previous, {
        speakerLabel: entry.speakerLabel,
        language: entry.language,
        text: entry.text,
        startTime: entry.startTime,
        endTime: entry.endTime,
        updatedAt: entry.updatedAt,
        isFinal: entry.isFinal,
      });

    if (!canMerge) {
      grouped.push({ ...entry });
      continue;
    }

    const mergedBase = previous as RealtimeEntry;

    grouped[grouped.length - 1] = {
      ...mergedBase,
      id: entry.id,
      text: mergeRealtimeText(mergedBase.text, entry.text),
      translatedText:
        mergedBase.translatedText || entry.translatedText
          ? mergeRealtimeText(mergedBase.translatedText ?? '', entry.translatedText ?? '')
          : null,
      targetLanguage: entry.targetLanguage ?? mergedBase.targetLanguage,
      endTime: entry.endTime ?? mergedBase.endTime,
      isFinal: entry.isFinal,
      updatedAt: entry.updatedAt,
      source: entry.source,
    };
  }

  return grouped;
}

const STT_LANGUAGE_OPTIONS = [
  { label: 'Tiếng Việt', value: 'vi-VN' },
  { label: 'English', value: 'en-US' },
];

const STT_TARGET_LANGUAGE_OPTIONS = [
  { label: 'Không dịch', value: '' },
  { label: 'Dịch sang Tiếng Việt', value: 'vi-VN' },
  { label: 'Dịch sang English', value: 'en-US' },
];

function riskVariant(severity?: string) {
  const normalized = String(severity ?? '').toLowerCase();
  if (normalized === 'critical' || normalized === 'high') return 'danger' as const;
  if (normalized === 'medium' || normalized === 'warning') return 'warning' as const;
  if (normalized === 'low' || normalized === 'info') return 'info' as const;
  return 'muted' as const;
}

function getTranscriptRiskSummary(
  transcriptId: string,
  riskEvents: Array<{ transcriptId: string | null; severity: string; type: string }>,
) {
  const matches = riskEvents.filter((item) => item.transcriptId === transcriptId);
  return {
    count: matches.length,
    labels: matches.slice(0, 3).map((item) => item.type),
    highestSeverity:
      matches.find((item) => ['critical', 'high'].includes(item.severity.toLowerCase()))?.severity ??
      matches[0]?.severity ??
      null,
  };
}

function getRiskEvidenceDetails(evidence: unknown) {
  if (!evidence || typeof evidence !== 'object') {
    return { matchedKeyword: null as string | null, score: null as number | null };
  }

  const record = evidence as { matchedKeyword?: unknown; score?: unknown };
  return {
    matchedKeyword:
      typeof record.matchedKeyword === 'string' && record.matchedKeyword.trim()
        ? record.matchedKeyword.trim()
        : null,
    score: typeof record.score === 'number' && Number.isFinite(record.score) ? record.score : null,
  };
}

function buildRiskFeedMessage(
  event: { description: string; evidence: unknown; transcriptId: string | null },
  transcriptContent: string | null,
) {
  const evidence = getRiskEvidenceDetails(event.evidence);
  const parts: string[] = [event.description];

  if (evidence.matchedKeyword) {
    parts.push(`Từ khóa nghi ngờ: "${evidence.matchedKeyword}".`);
  }

  if (transcriptContent) {
    parts.push(`Đoạn hội thoại: "${transcriptContent}".`);
  }

  if (evidence.score !== null) {
    parts.push(`Điểm rủi ro: ${evidence.score}.`);
  }

  return parts.join(' ');
}

function buildRiskFeedContent(
  event: { description: string; transcriptId: string | null },
  transcriptContent: string | null,
) {
  return {
    transcript: transcriptContent?.trim() || 'Chưa xác định được câu nói nguồn.',
    warning: event.description.trim(),
  };
}

export default function MeetingDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const meetingId = params?.id ?? null;
  const { address, status: authStatus } = useAuth();
  const { socket, joinMeeting, leaveMeeting } = useSocket();

  const meetingQuery = useMeeting(meetingId);
  const transcriptsQuery = useMeetingTranscripts(meetingId);
  const riskQuery = useMeetingRiskEvents(meetingId);
  const sttStateQuery = useMeetingSttState(meetingId);
  const inviteMutation = useCreateMeetingInvite(meetingId ?? '');
  const joinMutation = useJoinMeetingByToken();
  const addTranscriptMutation = useAddMeetingTranscript(meetingId ?? '');
  const addTranslationMutation = useAddMeetingTranslation(meetingId ?? '');
  const startSttMutation = useStartMeetingStt(meetingId ?? '');
  const stopSttMutation = useStopMeetingStt(meetingId ?? '');
  const agoraUidSaltRef = useRef<number | null>(null);

  const [agoraUid, setAgoraUid] = useState(0);

  // Chỉ generate UID trên client (tránh hydration error)
  useEffect(() => {
    const base = address ?? 'guest';
    let hash = 0;
    for (let index = 0; index < base.length; index += 1) {
      hash = (hash * 31 + base.charCodeAt(index)) >>> 0;
    }
    if (agoraUidSaltRef.current === null && typeof window !== 'undefined') {
      const bytes = new Uint32Array(1);
      window.crypto.getRandomValues(bytes);
      agoraUidSaltRef.current = ((bytes[0] ?? 0) % 900_000) + 100_000;
    }
    const meetingHash = meetingId
      ? meetingId.split('').reduce((acc, char) => ((acc * 33) + char.charCodeAt(0)) >>> 0, 0)
      : 0;
    const salt = agoraUidSaltRef.current ?? 0;
    setAgoraUid(((hash + meetingHash + salt) % 900_000) + 1000);
  }, [address, meetingId]);

  const tokenQuery = useAgoraToken(
    meetingId,
    { uid: agoraUid },
    Boolean(meetingId && address && authStatus === 'authenticated'),
  );

  const [inviteWallet, setInviteWallet] = useState('');
  const [inviteRole, setInviteRole] = useState<'buyer' | 'seller' | 'arbiter' | 'guest'>('guest');
  const [inviteUses, setInviteUses] = useState('1');
  const [speakerLabel, setSpeakerLabel] = useState('');
  const [transcriptContent, setTranscriptContent] = useState('');
  const [transcriptLanguage, setTranscriptLanguage] = useState('vi');
  const [sttLanguageInput, setSttLanguageInput] = useState('vi-VN,en-US');
  const [sttTargetLanguageInput, setSttTargetLanguageInput] = useState('');
  const [realtimeEntries, setRealtimeEntries] = useState<RealtimeEntry[]>([]);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(
    () => meetingId && typeof window !== 'undefined'
      && sessionStorage.getItem(`meeting_joined_${meetingId}`) === 'true'
  );
  const [displayName, setDisplayName] = useState('');
  const [realtimeNotice, setRealtimeNotice] = useState('');
  const [riskAlert, setRiskAlert] = useState<{ level: string; count: number } | null>(null);
  const [realtimeTransportState, setRealtimeTransportState] = useState<
    'idle' | 'waiting' | 'receiving' | 'warning'
  >('idle');
  const persistedChunkIdsRef = useRef(new Set<string>());

  const meeting = meetingQuery.data ?? null;
  const transcripts = transcriptsQuery.data ?? [];
  const riskEvents = riskQuery.data ?? [];
  const sttState = sttStateQuery.data ?? null;
  const inviteTokenFromUrl = searchParams?.get('invite') ?? '';
  const currentParticipant = useMemo(
    () => meeting?.participants?.find((participant) => participant.walletAddress === address) ?? null,
    [address, meeting?.participants],
  );
  const activeRealtimeEntries = useMemo(
    () => [...groupRealtimeEntries(realtimeEntries)].sort((left, right) => right.updatedAt - left.updatedAt),
    [realtimeEntries],
  );
  const topRiskEvents = useMemo(
    () =>
      [...riskEvents].sort((left, right) => {
        const score = { critical: 4, high: 3, medium: 2, low: 1 } as Record<string, number>;
        return (score[right.severity.toLowerCase()] ?? 0) - (score[left.severity.toLowerCase()] ?? 0);
      }),
    [riskEvents],
  );
  const transcriptById = useMemo(
    () => new Map(transcripts.map((transcript) => [transcript.id, transcript])),
    [transcripts],
  );
  const lastTranscript = transcripts.length ? transcripts[transcripts.length - 1] : null;
  const sttProvider = (process.env.NEXT_PUBLIC_STT_PROVIDER ?? 'agora') as 'agora' | 'groq';
  const [realtimeOn, setRealtimeOn] = useState(false);
  const [groqSttActive, setGroqSttActive] = useState(false);
  const groqSttRef = useRef<GroqSttClient | null>(null);
  const groqCounterRef = useRef(0);
  const isDemoTranscriptMode = sttProvider === 'agora'
    ? (!sttState || sttState?.mode === 'demo_manual') && !realtimeOn
    : false;
  const transcriptStatusLabel = startSttMutation.isPending ? 'starting' : realtimeOn ? 'on' : 'off';
  const startRealtimeDisabled = startSttMutation.isPending || realtimeOn;
  const tts = useRealtimeTts(socket, meetingId, currentParticipant?.role ?? null);

  useEffect(() => {
    if (!address) return;
    setSpeakerLabel((current) => current || shortAddress(address, 6, 6));
  }, [address]);

  // When user picks a display name in lobby, use it as speakerLabel
  useEffect(() => {
    if (displayName.trim()) {
      setSpeakerLabel(displayName.trim());
    }
  }, [displayName]);

  useEffect(() => {
    if (
      authStatus !== 'authenticated' ||
      !inviteTokenFromUrl ||
      joinMutation.isPending ||
      joinMutation.isSuccess
    ) {
      return;
    }

    void joinMutation.mutateAsync({ token: inviteTokenFromUrl });
  }, [authStatus, inviteTokenFromUrl, joinMutation]);

  useEffect(() => {
    if (sttState?.fallbackReason) {
      setRealtimeNotice(sttState.fallbackReason);
    }
  }, [sttState?.fallbackReason]);

  useEffect(() => {
    if (!meetingId) {
      return;
    }

    joinMeeting(meetingId, address ?? undefined);
    return () => {
      leaveMeeting(meetingId);
    };
  }, [address, joinMeeting, leaveMeeting, meetingId]);

  useEffect(() => {
    if (!socket || !meetingId) {
      return;
    }

    const handleMeetingTranscript = (payload: {
      meetingId?: string;
      transcript?: {
        id?: string;
        speakerLabel?: string;
        content?: string;
        language?: string;
        startTime?: number;
        endTime?: number | null;
        confidence?: number | null;
        translations?: Array<{ targetLanguage?: string; content?: string }>;
      };
    }) => {
      if (payload.meetingId !== meetingId || !payload.transcript?.id) {
        return;
      }

      const transcript = payload.transcript;
      const transcriptId = transcript.id;
      if (!transcriptId) {
        return;
      }
      const translation = transcript.translations?.[0];
      setRealtimeEntries((current) => {
        const sorted = [...current].sort((left, right) => left.updatedAt - right.updatedAt);
        const previous = [...sorted]
          .reverse()
          .find((entry) =>
            shouldBelongToSameSpeakerTurn(entry, {
              speakerLabel: transcript.speakerLabel ?? 'speaker',
              language: transcript.language ?? 'und',
              text: transcript.content ?? '',
              startTime: transcript.startTime ?? null,
              endTime: transcript.endTime ?? null,
              updatedAt: Date.now(),
              isFinal: true,
            }),
          );

        const next = current.filter(
          (entry) =>
            entry.id !== transcriptId &&
            entry.id !== previous?.id &&
            !shouldReplaceOptimisticEntry(entry, transcript),
        );
        next.push({
          id: transcriptId,
          speakerLabel: transcript.speakerLabel ?? 'speaker',
          text: transcript.content ?? '',
          language: transcript.language ?? 'und',
          translatedText: translation?.content ?? null,
          targetLanguage: translation?.targetLanguage ?? null,
          startTime: transcript.startTime ?? null,
          endTime: transcript.endTime ?? null,
          isFinal: true,
          updatedAt: Date.now(),
          source: 'persisted',
        });
        return next.sort((left, right) => left.updatedAt - right.updatedAt).slice(-12);
      });

      if (typeof window !== 'undefined') {
        const sourceEvent = new CustomEvent('translation_source_ready', {
          detail: {
            meetingId,
            transcriptId,
            speakerWallet: transcript.speakerLabel ?? 'speaker',
            text: transcript.content ?? '',
            sourceLang: detectTranscriptLanguage(
              transcript.content ?? '',
              transcript.language,
            ),
            timestamp: new Date().toISOString(),
            isFinal: true,
          },
        });
        window.dispatchEvent(sourceEvent);
      }

      void transcriptsQuery.refetch();
      void riskQuery.refetch();
    };

    const handleMeetingRiskEvent = (payload: { meetingId?: string; severity?: string; type?: string; description?: string }) => {
      if (payload.meetingId !== meetingId) {
        return;
      }
      const sev = (payload.severity ?? '').toLowerCase();
      if (sev === 'critical' || sev === 'high') {
        setRiskAlert((prev) => ({ level: sev, count: (prev?.count ?? 0) + 1 }));
        setTimeout(() => setRiskAlert(null), 8000);
      }
      void riskQuery.refetch();
    };

    const handleTranslatedTranscript = (payload: {
      meetingId?: string;
      transcriptId?: string;
      speaker?: string;
      sourceText?: string;
      translatedText?: string;
      sourceLang?: string;
      targetLang?: string;
      provider?: string;
    }) => {
      if (payload.meetingId !== meetingId) return;
      // Dispatch custom event for TranslationPanel
      const event = new CustomEvent('translated_transcript', {
        detail: { ...payload, meetingId },
      });
      window.dispatchEvent(event);
    };

    const handleTranslationAudioReady = (payload: {
      meetingId?: string;
      jobId?: string;
      audio_base64?: string;
      format?: string;
      sampleRate?: number;
      translatedText?: string;
    }) => {
      if (payload.meetingId !== meetingId) return;
      const event = new CustomEvent('translation_audio_ready', {
        detail: { ...payload, meetingId },
      });
      window.dispatchEvent(event);
    };

    const handleTranslationError = (payload: {
      meetingId?: string;
      error?: string;
    }) => {
      if (payload.meetingId !== meetingId) return;
      const event = new CustomEvent('translation_error', {
        detail: { ...payload, meetingId },
      });
      window.dispatchEvent(event);
    };

    socket.on('meeting_transcript', handleMeetingTranscript);
    socket.on('meeting_risk_event', handleMeetingRiskEvent);
    socket.on('translated_transcript', handleTranslatedTranscript);
    socket.on('translated_audio_ready', handleTranslationAudioReady);
    socket.on('translation_error', handleTranslationError);

    return () => {
      socket.off('meeting_transcript', handleMeetingTranscript);
      socket.off('meeting_risk_event', handleMeetingRiskEvent);
      socket.off('translated_transcript', handleTranslatedTranscript);
      socket.off('translated_audio_ready', handleTranslationAudioReady);
      socket.off('translation_error', handleTranslationError);
    };
  }, [meetingId, riskQuery, socket, transcriptsQuery]);

  function upsertRealtimeEntry(chunk: AgoraRealtimeTranscriptChunk) {
    setRealtimeEntries((current) => {
      const sorted = [...current].sort((left, right) => left.updatedAt - right.updatedAt);
      const previous = [...sorted]
        .reverse()
        .find((entry) =>
          shouldBelongToSameSpeakerTurn(entry, {
            speakerLabel: chunk.speakerLabel,
            language: chunk.language,
            text: chunk.text,
            startTime: chunk.startTime,
            endTime: chunk.endTime,
            updatedAt: chunk.receivedAt,
            isFinal: chunk.isFinal,
          }),
        );
      const next = current.filter((entry) => entry.id !== chunk.chunkId);

      if (previous) {
        const previousId = previous!.id;
        const mergedText = mergeRealtimeText(previous!.text, chunk.text);
        const mergedTranslatedText =
          previous!.translatedText || chunk.translatedText
            ? mergeRealtimeText(previous!.translatedText ?? '', chunk.translatedText ?? '')
            : null;

        return next
          .filter((entry) => entry.id !== previousId)
          .concat({
            ...previous!,
            id: chunk.chunkId,
            text: mergedText,
            translatedText: mergedTranslatedText,
            targetLanguage: chunk.targetLanguage ?? previous!.targetLanguage,
            startTime: previous!.startTime ?? chunk.startTime,
            endTime: chunk.endTime ?? previous!.endTime,
            isFinal: chunk.isFinal,
            updatedAt: chunk.receivedAt,
            source: 'stream' as const,
          })
          .sort((left, right) => left.updatedAt - right.updatedAt);
      }

      next.push({
        id: chunk.chunkId,
        speakerLabel: chunk.speakerLabel,
        text: chunk.text,
        language: chunk.language,
        translatedText: chunk.translatedText,
        targetLanguage: chunk.targetLanguage,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        isFinal: chunk.isFinal,
        updatedAt: chunk.receivedAt,
        source: 'stream',
      });
      return next.sort((left, right) => left.updatedAt - right.updatedAt);
    });
  }

  async function persistRealtimeChunk(chunk: AgoraRealtimeTranscriptChunk) {
    if (!meetingId || !chunk.isFinal || persistedChunkIdsRef.current.has(chunk.chunkId)) {
      return;
    }

    persistedChunkIdsRef.current.add(chunk.chunkId);

    try {
      const createdTranscript = await addTranscriptMutation.mutateAsync({
        participantId: currentParticipant?.id,
        speakerLabel: chunk.speakerLabel,
        content: chunk.text,
        language: chunk.language || 'und',
        startTime: chunk.startTime ?? lastTranscript?.endTime ?? lastTranscript?.startTime ?? 0,
        endTime:
          chunk.endTime ??
          (chunk.startTime ?? lastTranscript?.endTime ?? lastTranscript?.startTime ?? 0) + 2,
        confidence: chunk.confidence ?? undefined,
      });

      if (chunk.translatedText && chunk.targetLanguage) {
        await addTranslationMutation.mutateAsync({
          transcriptId: createdTranscript.id,
          targetLanguage: chunk.targetLanguage,
          content: chunk.translatedText,
          provider: 'agora-stt',
        });
      }

      setRealtimeEntries((current) => current.filter((entry) => entry.id !== chunk.chunkId));
    } catch (error) {
      persistedChunkIdsRef.current.delete(chunk.chunkId);
      setRealtimeNotice(
        error instanceof Error
          ? `Không lưu được transcript realtime: ${error.message}`
          : 'Không lưu được transcript realtime.',
      );
    }
  }

  function handleRealtimeTranscript(chunk: AgoraRealtimeTranscriptChunk) {
    setRealtimeTransportState('receiving');
    setRealtimeNotice((current) =>
      current?.includes('UID dự kiến')
        ? current
        : 'Đang nhận transcript realtime từ cuộc họp.',
    );
    upsertRealtimeEntry(chunk);

    if (typeof window !== 'undefined') {
      const sourceEvent = new CustomEvent('translation_source_ready', {
        detail: {
          meetingId,
          transcriptId: chunk.chunkId,
          speakerWallet: chunk.speakerLabel ?? 'speaker',
          text: chunk.text ?? '',
          sourceLang: detectTranscriptLanguage(chunk.text ?? '', chunk.language),
          timestamp: new Date().toISOString(),
          isFinal: chunk.isFinal,
        },
      });
      window.dispatchEvent(sourceEvent);
    }

    if (chunk.isFinal) {
      void persistRealtimeChunk(chunk);
    }
  }

  /** Check if new text is too similar to the last Groq transcript (dedup) */
  function isGroqDup(newText: string): boolean {
    const entries = realtimeEntries.filter(e => e.id.startsWith('groq:'));
    if (entries.length === 0) return false;
    const last = entries[entries.length - 1];
    if (!last) return false;
    const a = last.text.trim().toLowerCase();
    const b = newText.trim().toLowerCase();
    if (a === b) return true;
    // Tính độ dài overlap
    const shorter = a.length < b.length ? a : b;
    const longer = a.length < b.length ? b : a;
    // Nếu text ngắn nằm trong text dài hoặc overlap > 70%
    if (longer.includes(shorter)) return true;
    const intersection = [...shorter].filter((c, i) => c === longer[i]).length;
    return intersection / shorter.length > 0.7;
  }

  function handleGroqTranscript(sessionId: string, text: string) {
    if (!meetingId || sessionId !== meetingId) return;
    if (isGroqDup(text)) return;
    const speaker = speakerLabel.trim() || shortAddress(address, 6, 6);
    groqCounterRef.current += 1;
    const chunkId = `groq:${groqCounterRef.current}`;
    const now = Date.now();

    setRealtimeEntries((current) => {
      const next = current.filter((entry) => entry.id !== chunkId);
      const detectedLanguage = detectTranscriptLanguage(text, 'auto');
      next.push({
        id: chunkId,
        speakerLabel: speaker,
        text,
        source: 'stream',
        language: detectedLanguage,
        translatedText: null,
        targetLanguage: null,
        startTime: null,
        endTime: null,
        isFinal: true,
        updatedAt: now,
      });
      return next.sort((left, right) => left.updatedAt - right.updatedAt);
    });

    setRealtimeTransportState('receiving');
    setRealtimeNotice('Đang nhận transcript từ Groq Whisper.');

    if (typeof window !== 'undefined') {
      const detectedLanguage = detectTranscriptLanguage(text, 'auto');
      const sourceEvent = new CustomEvent('translation_source_ready', {
        detail: {
          meetingId,
          transcriptId: chunkId,
          speakerWallet: speaker,
          text,
          sourceLang: detectedLanguage,
          timestamp: new Date().toISOString(),
          isFinal: true,
        },
      });
      window.dispatchEvent(sourceEvent);
    }

    const persistText = async () => {
      if (persistedChunkIdsRef.current.has(chunkId)) return;
      persistedChunkIdsRef.current.add(chunkId);
      const lastTs = lastTranscript?.endTime ?? lastTranscript?.startTime ?? 0;
      try {
        const detectedLanguage = detectTranscriptLanguage(text, 'auto');
        await addTranscriptMutation.mutateAsync({
          participantId: currentParticipant?.id,
          speakerLabel: speaker,
          content: text,
          language: detectedLanguage,
          startTime: lastTs,
          endTime: lastTs + 2,
          confidence: 0.95,
        });
      } catch (error) {
        persistedChunkIdsRef.current.delete(chunkId);
        setRealtimeNotice(error instanceof Error ? error.message : 'Lỗi lưu transcript');
      }
    };
    void persistText();

    // Auto TTS: gọi trực tiếp hook (không chờ socket)
    if (tts.enabled) {
      const role = currentParticipant?.role ?? null;
      if (tts.speakerMode === 'all' || tts.speakerMode === role || !role) {
        tts.speakText(text, speaker).catch(() => {});
      }
    }
  }

  async function handleStartGroqStt(): Promise<boolean> {
    if (!meetingId) return false;
    try {
      const client = new GroqSttClient();
      groqSttRef.current = client;
      setGroqSttActive(true);
      setRealtimeTransportState('waiting');
      setRealtimeNotice('Groq Whisper đang khởi động...');

      await client.start({
        meetingId,
        speakerLabel: speakerLabel.trim() || shortAddress(address, 6, 6),
        language: sttLanguageInput.includes('en-US') ? 'en' : 'vi',
        onTranscript: handleGroqTranscript,
        onError: (error) => setRealtimeNotice(`Groq lỗi: ${error.message}`),
      });
      setRealtimeNotice('Groq Whisper đang chạy.');
      return true;
    } catch (error) {
      setGroqSttActive(false);
      setRealtimeNotice(error instanceof Error ? error.message : 'Không bật được Groq');
      return false;
    }
  }

  function handleStopGroqStt() {
    groqSttRef.current?.stop();
    groqSttRef.current = null;
    setGroqSttActive(false);
    setRealtimeEntries([]);
    setRealtimeNotice('Groq STT đã tắt.');
  }

  function handleRealtimeTransportStateChange(state: {
    status: string;
    detail?: string;
  }) {
    setRealtimeTransportState(state.status as 'idle' | 'waiting' | 'receiving' | 'warning');

    if (state.status === 'waiting') {
      setRealtimeNotice('Realtime transcript đã được bật. Hệ thống đang chờ câu thoại đầu tiên.');
      return;
    }

    if (state.status === 'receiving' && state.detail) {
      setRealtimeNotice(state.detail);
      return;
    }

    if (state.status === 'warning' && state.detail) {
      setRealtimeNotice(`Luồng transcript realtime có cảnh báo parse: ${state.detail}`);
    }
  }

  async function handleStartRealtime() {
    if (sttProvider === 'groq') {
      // Groq Whisper path: client-side capture, no backend Agora STT agent
      const ok = await handleStartGroqStt();
      if (ok) {
        setRealtimeOn(true);
      }
      return;
    }

    // Agora cloud STT path (default)
    const languages = sttLanguageInput.split(',').map((item) => item.trim()).filter(Boolean);
    const targetLanguages = sttTargetLanguageInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      setRealtimeTransportState('waiting');
      const detectLanguages = languages.filter(Boolean).slice(0, 4);
      const hasTranslation = targetLanguages.length > 0;
      const result = await startSttMutation.mutateAsync({
        languages: detectLanguages,
        targetLanguages,
        enableTranslation: hasTranslation,
        maxIdleTime: 300,
      });

      setRealtimeOn(true);

      if (result.fallbackReason) {
        setRealtimeNotice(result.fallbackReason);
      } else if (result.mode === 'asr_translate') {
        setRealtimeNotice('Realtime transcript và translation đã được bật.');
      } else if (result.mode === 'asr_only') {
        setRealtimeNotice('Realtime transcript đã được bật ở chế độ ASR-only.');
      } else {
        setRealtimeNotice('Meeting đang ở chế độ demo/manual transcript.');
      }
    } catch (error) {
      setRealtimeNotice(
        error instanceof Error
          ? `Không bật được realtime transcript: ${error.message}`
          : 'Không bật được realtime transcript.',
      );
    }
  }

  async function handleStopRealtime() {
    if (sttProvider === 'groq') {
      handleStopGroqStt();
      setRealtimeOn(false);
      return;
    }

    await stopSttMutation.mutateAsync();
    setRealtimeOn(false);
    setRealtimeEntries([]);
    setRealtimeNotice('Realtime transcript đã được tắt.');
  }

  async function submitTranscript() {
    const trimmed = transcriptContent.trim();
    if (!trimmed || !meetingId) return;

    const startTime = lastTranscript?.endTime ?? lastTranscript?.startTime ?? 0;
    const estimatedDuration = Math.max(2, Math.ceil(trimmed.split(/\s+/).filter(Boolean).length / 2));

    await addTranscriptMutation.mutateAsync({
      participantId: currentParticipant?.id,
      speakerLabel: speakerLabel.trim() || shortAddress(address, 6, 6),
      content: trimmed,
      language: transcriptLanguage.trim() || 'vi',
      startTime,
      endTime: startTime + estimatedDuration,
      confidence: 0.98,
    });

    setTranscriptContent('');
  }

  function handleLeaveRoom() {
    if (meetingId) {
      sessionStorage.removeItem(`meeting_joined_${meetingId}`);
    }
    setHasJoinedRoom(false);
  }

  return (
    <AuthGate>
      <AppShell
        title={meeting?.title ?? 'Meeting room'}
        contentClassName="max-w-[1920px] px-3 md:px-5 2xl:px-8"
        actions={
          <>
            {meeting?.dealId ? (
              <Link href={`/deals/${meeting.dealId}`}>
                <Button variant="ghost">Về deal</Button>
              </Link>
            ) : null}
            <Link href="/dashboard">
              <Button variant="secondary">Dashboard</Button>
            </Link>
          </>
        }
      >
        {meetingQuery.isLoading ? (
          <div className="grid gap-6">
            <Skeleton className="h-[760px]" />
          </div>
        ) : meetingQuery.isError || !meeting ? (
          <Alert variant="danger" title="Không tải được meeting">
            {meetingQuery.error instanceof Error ? meetingQuery.error.message : 'Meeting không tồn tại.'}
          </Alert>
        ) : !hasJoinedRoom ? (
          <MeetingLobby
            meetingTitle={meeting.title}
            displayName={displayName}
            onDisplayNameChange={setDisplayName}
            onJoin={() => {
              if (meetingId) sessionStorage.setItem(`meeting_joined_${meetingId}`, 'true');
              setHasJoinedRoom(true);
            }}
            joinDisabled={!displayName.trim()}
            joinLoading={tokenQuery.isLoading}
            error={tokenQuery.error instanceof Error ? tokenQuery.error.message : null}
          />
        ) : (
          <div className={`relative transition-all duration-500 ${
              riskAlert ? 'ring-2 ring-danger-500 ring-offset-2 ring-offset-red-50' : ''
            }`}>
            {riskAlert && (
              <div className="fixed inset-0 z-30 pointer-events-none animate-pulse bg-danger-500/5" />
            )}
            <div className="grid gap-6 2xl:grid-cols-[2.2fr_0.8fr]">
            <div className="space-y-6">
              {/* Risk Alert Banner */}
              {riskAlert && (
                <div className="rounded-2xl border-2 border-danger-400 bg-danger-50 p-5 shadow-lg shadow-danger-500/20 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-danger-500 animate-pulse" />
                    <div>
                      <p className="text-sm font-bold text-danger-800 uppercase tracking-wider">
                        ⚠ Scam Alert — {riskAlert.count} risk event{riskAlert.count > 1 ? 's' : ''} detected
                      </p>
                      <p className="text-xs text-danger-600 mt-0.5">
                        Unusual behavior detected in conversation. Review terms carefully before releasing funds.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {/* Call Room Card */}
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-slate-200 pb-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={meeting.status === 'Active' ? 'success' : 'muted'}>
                          {meeting.status}
                        </Badge>
                        <Badge
                          variant={
                            ['running', 'fallback_asr_only'].includes(sttState?.status ?? '')
                              ? 'success'
                              : 'muted'
                          }
                        >
                          {sttState?.status ?? 'loading'}
                        </Badge>
                        <Badge variant="muted">{meeting.participants?.length ?? 0} participants</Badge>
                        <Badge variant="muted">{transcripts.length} transcripts</Badge>
                      </div>
                      <div>
                        <CardTitle className="text-lg">Call room</CardTitle>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <MeetingRtcPanel
                    meetingId={meeting.id}
                    title={meeting.title}
                    appId={process.env.NEXT_PUBLIC_AGORA_APP_ID}
                    token={tokenQuery.data?.token}
                    tokenLoading={tokenQuery.isLoading || tokenQuery.isFetching}
                    tokenError={tokenQuery.error instanceof Error ? tokenQuery.error.message : null}
                    uid={agoraUid}
                    walletAddress={address}
                    sttPusherUid={sttState?.pusherUid ?? null}
                    onRealtimeTranscript={handleRealtimeTranscript}
                    onRealtimeTransportStateChange={handleRealtimeTransportStateChange}
                    onLeave={handleLeaveRoom}
                  />
                </CardContent>
              </Card>

              {/* Transcript Card */}
              <Card>
                <CardHeader className="border-b border-slate-200 pb-5">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <CardTitle className="text-lg">Transcript</CardTitle>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            transcriptStatusLabel === 'on'
                              ? 'success'
                              : transcriptStatusLabel === 'starting'
                                ? 'info'
                                : 'muted'
                          }
                        >
                          {transcriptStatusLabel === 'on'
                            ? 'on'
                            : transcriptStatusLabel === 'starting'
                              ? 'starting'
                              : 'off'}
                        </Badge>
                        {realtimeNotice ? (
                          <Badge
                            variant={
                              realtimeTransportState === 'warning'
                                ? 'warning'
                                : realtimeTransportState === 'receiving'
                                  ? 'success'
                                  : 'muted'
                            }
                          >
                            {realtimeTransportState === 'warning'
                              ? 'cảnh báo'
                              : realtimeTransportState === 'receiving'
                                ? 'đang nhận'
                                : realtimeTransportState === 'waiting'
                                  ? 'đang chờ'
                                  : 'sẵn sàng'}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {sttProvider === 'agora' ? (
                        <>
                          <div className="min-w-[180px]">
                            <Select
                              value={sttLanguageInput}
                              onChange={(event) => setSttLanguageInput(event.target.value)}
                              options={STT_LANGUAGE_OPTIONS}
                            />
                          </div>
                          <div className="min-w-[200px]">
                            <Select
                              value={sttTargetLanguageInput}
                              onChange={(event) => setSttTargetLanguageInput(event.target.value)}
                              options={STT_TARGET_LANGUAGE_OPTIONS}
                            />
                          </div>
                        </>
                      ) : null}
                      <Button
                        onClick={() => void handleStartRealtime()}
                        disabled={startRealtimeDisabled}
                      >
                        Bật realtime
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => void handleStopRealtime()}
                        disabled={
                          sttProvider === 'groq'
                            ? !groqSttActive
                            : stopSttMutation.isPending ||
                              !meetingId ||
                              !['running', 'fallback_asr_only'].includes(sttState?.status ?? '')
                        }
                      >
                        Tắt
                      </Button>
                    </div>
                    {/* ── AI Voice (TTS) toggle ── */}
                    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 mt-3">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider mr-2">
                        AI Voice:
                      </span>
                      <Button
                        variant={tts.enabled ? 'primary' : 'ghost'}
                        onClick={() => tts.setEnabled(!tts.enabled)}
                      >
                        {tts.enabled ? '🔊 Đang đọc' : '🔇 TTS tắt'}
                      </Button>
                      {tts.enabled && (
                        <>
                          <div className="min-w-[120px]">
                            <Select
                              value={tts.speakerMode}
                              onChange={(e) => tts.setSpeakerMode(e.target.value as TtsSpeakerMode)}
                              options={[
                                { label: 'All speakers', value: 'all' },
                                { label: 'Buyer only', value: 'buyer' },
                                { label: 'Seller only', value: 'seller' },
                                { label: 'AI only', value: 'ai' },
                              ]}
                            />
                          </div>
                          <Badge variant={tts.speaking ? 'success' : 'muted'}>
                            {tts.speaking ? 'speaking' : 'idle'}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
                    {/* Live Transcript */}
                    <div className="min-h-[680px] rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-indigo-700">Live</p>
                        <Badge variant={activeRealtimeEntries.length ? 'info' : 'muted'}>
                          {activeRealtimeEntries.length} live
                        </Badge>
                      </div>

                      {activeRealtimeEntries.length ? (
                        <div className="space-y-3">
                          {activeRealtimeEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className="rounded-xl border border-slate-200 bg-white p-3"
                            >
                              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="muted">{entry.speakerLabel}</Badge>
                                  <Badge variant="info">{entry.language}</Badge>
                                </div>
                                <span>{formatRelativeTime(new Date(entry.updatedAt).toISOString())}</span>
                              </div>
                              <p className="text-sm leading-relaxed text-slate-900">{entry.text}</p>
                              {entry.translatedText && entry.targetLanguage ? (
                                <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
                                  <p className="text-[11px] uppercase tracking-wider text-indigo-600/80">
                                    Translation {entry.targetLanguage}
                                  </p>
                                  <p className="mt-1 text-sm text-indigo-700">
                                    {entry.translatedText}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex min-h-[500px] items-center justify-center rounded-xl border border-dashed border-indigo-200 bg-white/60 p-8 text-center">
                          <div className="max-w-md space-y-2">
                            <p className="text-base font-medium text-slate-700">Chưa có script realtime</p>
                            <p className="text-sm leading-relaxed text-slate-400">
                              Khi STT nhận được lời nói từ cuộc họp, transcript sẽ chạy trực tiếp ở khu vực này.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Saved Timeline */}
                    <div className="min-h-[680px] rounded-xl border border-slate-200 bg-white p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-900">Timeline đã lưu</p>
                        <Badge variant="muted">{transcripts.length} dòng</Badge>
                      </div>

                      {transcriptsQuery.isLoading ? (
                        <div className="space-y-3">
                          <Skeleton className="h-20" />
                          <Skeleton className="h-20" />
                        </div>
                      ) : transcripts.filter((item) => getTranscriptRiskSummary(item.id, riskEvents).count > 0).length ? (
                        <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                          {[...transcripts]
                            .reverse()
                            .filter((item) => getTranscriptRiskSummary(item.id, riskEvents).count > 0)
                            .map((item) => {
                            const riskSummary = getTranscriptRiskSummary(item.id, riskEvents);
                            return (
                              <div
                                key={item.id}
                                className="rounded-xl border border-slate-200 bg-white p-3"
                              >
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="muted">{item.speakerLabel}</Badge>
                                    <Badge variant="info">{item.language}</Badge>
                                    {riskSummary.count > 0 ? (
                                      <Badge variant={riskVariant(riskSummary.highestSeverity ?? 'medium')}>
                                        {riskSummary.count} risk
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <span>{item.startTime.toFixed(2)}s</span>
                                </div>
                                <p className="text-sm leading-relaxed text-slate-700">{item.content}</p>
                                {item.translations?.length ? (
                                  <div className="mt-2 space-y-1">
                                    {item.translations.map((translation) => (
                                      <div
                                        key={translation.id}
                                        className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700"
                                      >
                                        <span className="mr-2 text-[10px] uppercase tracking-wider text-indigo-500/70">
                                          {translation.targetLanguage}
                                        </span>
                                        {translation.content}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                                {riskSummary.labels.length ? (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {riskSummary.labels.map((label) => (
                                      <Badge key={`${item.id}-${label}`} variant="warning">
                                        {label}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <Alert title="Chưa có transcript">
                          Transcript realtime sẽ hiển thị ở đây sau khi được lưu từ luồng meeting.
                        </Alert>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {/* Translation Panel */}
              <TranslationPanel meetingId={meeting.id} />

              {/* Risk Feed */}
              {riskQuery.isLoading || topRiskEvents.length ? (
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle>Risk feed</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {riskQuery.isLoading ? (
                      <>
                        <Skeleton className="h-20" />
                        <Skeleton className="h-20" />
                      </>
                    ) : topRiskEvents.length ? (
                      topRiskEvents.slice(0, 6).map((event) => {
                        const linkedTranscript = event.transcriptId
                          ? transcriptById.get(event.transcriptId)
                          : null;
                        const riskContent = buildRiskFeedContent(
                          event,
                          linkedTranscript?.content ?? null,
                        );

                        return (
                          <div
                            key={event.id}
                            className="rounded-xl border border-red-200 bg-red-50 p-3"
                          >
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <Badge variant={riskVariant(event.severity)}>{event.severity}</Badge>
                            </div>
                            <p className="text-sm font-semibold leading-relaxed text-slate-900">
                              {riskContent.transcript}
                            </p>
                            <p className="mt-2 text-sm leading-relaxed text-slate-700">
                              {riskContent.warning}
                            </p>
                          </div>
                        );
                      })
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}

              {/* Invite Card */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle>Invite</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    value={inviteWallet}
                    onChange={(event) => setInviteWallet(event.target.value)}
                    placeholder="Wallet được mời, để trống nếu muốn link mở"
                  />
                  <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.7fr]">
                    <Input
                      value={inviteRole}
                      onChange={(event) =>
                        setInviteRole(
                          event.target.value as 'buyer' | 'seller' | 'arbiter' | 'guest',
                        )
                      }
                      placeholder="guest"
                    />
                    <Input
                      value={inviteUses}
                      onChange={(event) => setInviteUses(event.target.value)}
                      placeholder="Số lần dùng"
                    />
                  </div>
                  <Button
                    onClick={() =>
                      inviteMutation.mutate({
                        walletAddress: inviteWallet || undefined,
                        role: inviteRole,
                        maxUses: Number(inviteUses) || 1,
                        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                      })
                    }
                    disabled={inviteMutation.isPending}
                  >
                    Tạo invite
                  </Button>

                  {meeting.invites?.length ? (
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                      {meeting.invites.slice(0, 3).map((invite) => {
                        const link = `${
                          typeof window !== 'undefined' ? window.location.origin : ''
                        }/meetings/${meeting.id}?invite=${invite.token}`;

                        return (
                          <div key={invite.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                            <div className="mb-1.5 flex flex-wrap items-center gap-2">
                              <Badge variant="muted">{invite.role}</Badge>
                              <Badge variant={invite.status === 'Accepted' ? 'success' : 'info'}>
                                {invite.status}
                              </Badge>
                              <span className="text-[11px] text-slate-400">
                                {invite.usedCount}/{invite.maxUses}
                              </span>
                            </div>
                            <p className="break-all text-[11px] text-slate-500">{link}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Manual Transcript */}
              {isDemoTranscriptMode ? (
                <Card className="border-t-2 border-t-amber-300">
                  <CardHeader className="pb-4">
                    <CardTitle>Manual transcript</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        value={speakerLabel}
                        onChange={(event) => setSpeakerLabel(event.target.value)}
                        placeholder="Nhãn người nói"
                      />
                      <Input
                        value={transcriptLanguage}
                        onChange={(event) => setTranscriptLanguage(event.target.value)}
                        placeholder="vi"
                      />
                    </div>
                    <Textarea
                      rows={5}
                      value={transcriptContent}
                      onChange={(event) => setTranscriptContent(event.target.value)}
                      placeholder="Dán transcript vào đây để lưu xuống timeline và kích hoạt kiểm tra rủi ro."
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => void submitTranscript()}
                        disabled={!transcriptContent.trim() || addTranscriptMutation.isPending}
                      >
                        Gửi transcript
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setTranscriptContent('Please release first and continue on telegram.')}
                      >
                        Nạp sample risk
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
          </div>
        )}
      </AppShell>
    </AuthGate>
  );
}
