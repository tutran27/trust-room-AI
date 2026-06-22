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
import { formatRelativeTime } from '../../../lib/format';
import { shortAddress } from '../../../lib/wallet';
import { useAuth } from '../../../providers/auth-provider';
import { useSocket } from '../../../providers/socket-provider';

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
}

function mergeRealtimeText(currentText: string, nextText: string) {
  const left = currentText.trim();
  const right = nextText.trim();

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

function groupRealtimeEntries(entries: RealtimeEntry[]) {
  const grouped: RealtimeEntry[] = [];

  for (const entry of [...entries].sort((left, right) => left.updatedAt - right.updatedAt)) {
    const previous = grouped[grouped.length - 1];
    const canMerge =
      previous &&
      previous.speakerLabel === entry.speakerLabel &&
      previous.language === entry.language;

    if (!canMerge) {
      grouped.push({ ...entry });
      continue;
    }

    grouped[grouped.length - 1] = {
      ...previous,
      id: entry.id,
      text: mergeRealtimeText(previous.text, entry.text),
      translatedText:
        previous.translatedText || entry.translatedText
          ? mergeRealtimeText(previous.translatedText ?? '', entry.translatedText ?? '')
          : null,
      targetLanguage: entry.targetLanguage ?? previous.targetLanguage,
      endTime: entry.endTime ?? previous.endTime,
      isFinal: entry.isFinal,
      updatedAt: entry.updatedAt,
    };
  }

  return grouped;
}

const STT_LANGUAGE_OPTIONS = [
  { label: 'Tiếng Việt', value: 'vi-VN' },
  { label: 'English', value: 'en-US' },
  { label: '中文', value: 'zh-CN' },
  { label: '日本語', value: 'ja-JP' },
  { label: '한국어', value: 'ko-KR' },
];

const STT_TARGET_LANGUAGE_OPTIONS = [
  { label: 'Không dịch', value: '' },
  { label: 'Dịch sang Tiếng Việt', value: 'vi-VN' },
  { label: 'Dịch sang English', value: 'en-US' },
  { label: 'Dịch sang 中文', value: 'zh-CN' },
  { label: 'Dịch sang 日本語', value: 'ja-JP' },
  { label: 'Dịch sang 한국어', value: 'ko-KR' },
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

  const agoraUid = useMemo(() => {
    const base = address ?? 'guest';
    let hash = 0;
    for (let index = 0; index < base.length; index += 1) {
      hash = (hash * 31 + base.charCodeAt(index)) >>> 0;
    }
    const salt = typeof window !== 'undefined'
      ? parseInt(sessionStorage.getItem('agora_uid_salt') ?? '0', 10) || (() => {
          const s = Math.floor(Math.random() * 900_000) + 100_000;
          sessionStorage.setItem('agora_uid_salt', String(s));
          return s;
        })()
      : 0;
    return ((hash + salt) % 900_000) + 1000;
  }, [address]);

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
  const [sttLanguageInput, setSttLanguageInput] = useState('vi-VN');
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
  const isDemoTranscriptMode = sttState?.mode === 'demo_manual' || !sttState;
  const isRealtimeRunning = ['running', 'fallback_asr_only'].includes(sttState?.status ?? '');
  const transcriptStatusLabel = startSttMutation.isPending
    ? 'starting'
    : isRealtimeRunning
      ? 'on'
      : 'off';
  const startRealtimeDisabled =
    startSttMutation.isPending || !meetingId || isRealtimeRunning;

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
        const next = current.filter((entry) => entry.id !== transcriptId);
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
        });
        return next.sort((left, right) => left.updatedAt - right.updatedAt).slice(-12);
      });

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

    socket.on('meeting_transcript', handleMeetingTranscript);
    socket.on('meeting_risk_event', handleMeetingRiskEvent);

    return () => {
      socket.off('meeting_transcript', handleMeetingTranscript);
      socket.off('meeting_risk_event', handleMeetingRiskEvent);
    };
  }, [meetingId, riskQuery, socket, transcriptsQuery]);

  function upsertRealtimeEntry(chunk: AgoraRealtimeTranscriptChunk) {
    setRealtimeEntries((current) => {
      const next = current.filter((entry) => entry.id !== chunk.chunkId);
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
    if (chunk.isFinal) {
      void persistRealtimeChunk(chunk);
    }
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
    const languages = sttLanguageInput.split(',').map((item) => item.trim()).filter(Boolean);
    const targetLanguages = sttTargetLanguageInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      setRealtimeTransportState('waiting');
      const result = await startSttMutation.mutateAsync({
        languages,
        targetLanguages,
        enableTranslation: targetLanguages.length > 0,
        maxIdleTime: 300,
      });

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
    await stopSttMutation.mutateAsync();
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
                          stopSttMutation.isPending ||
                          !meetingId ||
                          !['running', 'fallback_asr_only'].includes(sttState?.status ?? '')
                        }
                      >
                        Tắt
                      </Button>
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
                        const riskMessage = buildRiskFeedMessage(
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
                            <p className="text-sm leading-relaxed text-slate-700">{riskMessage}</p>
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
