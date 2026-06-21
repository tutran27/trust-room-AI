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
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
  Textarea,
} from '@trustroom/ui';
import { AppShell } from '../../../components/app-shell';
import { AuthGate } from '../../../components/auth-gate';
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
  useUpdateMeetingStatus,
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
  const statusMutation = useUpdateMeetingStatus(meetingId ?? '');
  const inviteMutation = useCreateMeetingInvite(meetingId ?? '');
  const joinMutation = useJoinMeetingByToken();
  const addTranscriptMutation = useAddMeetingTranscript(meetingId ?? '');
  const addTranslationMutation = useAddMeetingTranslation(meetingId ?? '');
  const startSttMutation = useStartMeetingStt(meetingId ?? '');
  const stopSttMutation = useStopMeetingStt(meetingId ?? '');

  const agoraUid = useMemo(() => {
    // Use a random UID per session to avoid collisions when multiple users
    // share the same demo wallet address.
    const base = address ?? 'guest';
    let hash = 0;
    for (let index = 0; index < base.length; index += 1) {
      hash = (hash * 31 + base.charCodeAt(index)) >>> 0;
    }
    // Mix in a random component so each browser tab gets a unique UID
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
  const [sttTargetLanguageInput, setSttTargetLanguageInput] = useState('en-US');
  const [translationEnabled, setTranslationEnabled] = useState(true);
  const [realtimeEntries, setRealtimeEntries] = useState<RealtimeEntry[]>([]);
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);
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
    () => [...realtimeEntries].sort((left, right) => right.updatedAt - left.updatedAt),
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
  const lastTranscript = transcripts.length ? transcripts[transcripts.length - 1] : null;
  const isDemoTranscriptMode = sttState?.mode === 'demo_manual' || !sttState;
  const isRealtimeRunning = ['running', 'fallback_asr_only'].includes(sttState?.status ?? '');
  const startRealtimeDisabled =
    startSttMutation.isPending || !meetingId || isRealtimeRunning;
  const startRealtimeDisabledReason = startSttMutation.isPending
    ? 'Hệ thống đang gửi yêu cầu bật realtime transcript.'
    : !meetingId
      ? 'Meeting chưa sẵn sàng nên chưa thể bật realtime.'
      : isRealtimeRunning
        ? 'Realtime transcript đang ở trạng thái chạy. Hãy tắt trước nếu bạn muốn bật lại.'
        : null;

  useEffect(() => {
    if (!address) return;
    setSpeakerLabel((current) => current || shortAddress(address, 6, 6));
  }, [address]);

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

      const translation = payload.transcript.translations?.[0];
      setRealtimeEntries((current) => {
        const next = current.filter((entry) => entry.id !== payload.transcript?.id);
        next.push({
          id: payload.transcript.id,
          speakerLabel: payload.transcript.speakerLabel ?? 'speaker',
          text: payload.transcript.content ?? '',
          language: payload.transcript.language ?? 'und',
          translatedText: translation?.content ?? null,
          targetLanguage: translation?.targetLanguage ?? null,
          startTime: payload.transcript.startTime ?? null,
          endTime: payload.transcript.endTime ?? null,
          isFinal: true,
          updatedAt: Date.now(),
        });
        return next.sort((left, right) => left.updatedAt - right.updatedAt).slice(-12);
      });

      void transcriptsQuery.refetch();
      void riskQuery.refetch();
    };

    const handleMeetingRiskEvent = (payload: { meetingId?: string }) => {
      if (payload.meetingId !== meetingId) {
        return;
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
    upsertRealtimeEntry(chunk);
    if (chunk.isFinal) {
      void persistRealtimeChunk(chunk);
    }
  }

  async function handleStartRealtime() {
    const languages = sttLanguageInput.split(',').map((item) => item.trim()).filter(Boolean);
    const targetLanguages = sttTargetLanguageInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      const result = await startSttMutation.mutateAsync({
        languages,
        targetLanguages,
        enableTranslation: translationEnabled,
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

  return (
    <AuthGate>
      <AppShell
        title={meeting?.title ?? 'Meeting room'}
        subtitle="Phòng đàm phán trực tiếp với video lớn, transcript realtime và cảnh báo rủi ro ngay trong cùng một màn hình."
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
            <Skeleton className="h-[760px] rounded-[32px]" />
          </div>
        ) : meetingQuery.isError || !meeting ? (
          <Alert variant="danger" title="Không tải được meeting">
            {meetingQuery.error instanceof Error ? meetingQuery.error.message : 'Meeting không tồn tại.'}
          </Alert>
        ) : (
          <div className="grid gap-6 2xl:grid-cols-[2.05fr_0.72fr]">
            <div className="space-y-6">
              <Card className="overflow-hidden border-cyan-500/15 bg-[linear-gradient(180deg,rgba(8,15,32,0.95),rgba(5,10,20,0.98))]">
                <CardHeader className="border-b border-white/10 pb-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={meeting.status === 'Active' ? 'success' : 'muted'}>
                          {meeting.status}
                        </Badge>
                        <Badge variant={sttState?.mode === 'asr_translate' ? 'info' : 'muted'}>
                          {sttState?.mode ?? 'loading'}
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
                        <CardTitle className="text-2xl">Call room</CardTitle>
                        <CardDescription>
                          Video được ưu tiên diện tích lớn hơn, các khối phụ được dồn sang cột phải để màn họp thoáng và dễ nhìn.
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="secondary"
                        onClick={() => statusMutation.mutate({ status: 'Active' })}
                        disabled={meeting.status === 'Active' || statusMutation.isPending}
                      >
                        Mark active
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => statusMutation.mutate({ status: 'Ended' })}
                        disabled={meeting.status === 'Ended' || statusMutation.isPending}
                      >
                        End meeting
                      </Button>
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
                  />
                </CardContent>
              </Card>

              <Card className="border-cyan-500/15 bg-slate-950/85">
                <CardHeader className="border-b border-white/10 pb-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <CardTitle className="text-xl">Transcript realtime</CardTitle>
                      <CardDescription>
                        Khung riêng cho script đang chạy trực tiếp, bản dịch và timeline đã lưu.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        value={sttLanguageInput}
                        onChange={(event) => setSttLanguageInput(event.target.value)}
                        placeholder="vi-VN,en-US"
                        className="min-w-[220px]"
                      />
                      <Input
                        value={sttTargetLanguageInput}
                        onChange={(event) => setSttTargetLanguageInput(event.target.value)}
                        placeholder="en-US"
                        className="min-w-[180px]"
                      />
                      <Button
                        onClick={() => void handleStartRealtime()}
                        disabled={startRealtimeDisabled}
                      >
                        {startSttMutation.isPending
                          ? 'Đang bật...'
                          : isRealtimeRunning
                            ? 'Realtime đang chạy'
                            : 'Bật realtime'}
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
                      <Button
                        variant={translationEnabled ? 'secondary' : 'ghost'}
                        onClick={() => setTranslationEnabled((current) => !current)}
                      >
                        {translationEnabled ? 'Translation on' : 'Translation off'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {realtimeNotice ? (
                    <Alert
                      variant={
                        realtimeNotice.toLowerCase().includes('không') ||
                        realtimeNotice.toLowerCase().includes('demo')
                          ? 'warning'
                          : 'success'
                      }
                      title="Transcript status"
                    >
                      {realtimeNotice}
                    </Alert>
                  ) : null}

                  {startRealtimeDisabledReason ? (
                    <Alert title="Trạng thái nút bật realtime">
                      {startRealtimeDisabledReason}
                    </Alert>
                  ) : null}

                  {startSttMutation.error ? (
                    <Alert variant="danger" title="Không bật được realtime transcript">
                      {startSttMutation.error instanceof Error
                        ? startSttMutation.error.message
                        : 'Lỗi không xác định.'}
                    </Alert>
                  ) : null}

                  <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                    <div className="min-h-[600px] rounded-[30px] border border-cyan-500/20 bg-[radial-gradient(circle_at_top,rgba(8,145,178,0.14),transparent_35%),rgba(4,8,18,0.92)] p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-cyan-200">Luồng live</p>
                          <p className="text-xs text-slate-400">Những câu vừa phát ra sẽ nổi ở đây trước khi được lưu.</p>
                        </div>
                        <Badge variant={activeRealtimeEntries.length ? 'info' : 'muted'}>
                          {activeRealtimeEntries.length} live
                        </Badge>
                      </div>

                      {activeRealtimeEntries.length ? (
                        <div className="space-y-3">
                          {activeRealtimeEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className="rounded-[24px] border border-cyan-400/20 bg-slate-950/55 p-4"
                            >
                              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="muted">{entry.speakerLabel}</Badge>
                                  <Badge variant="info">{entry.language}</Badge>
                                  <Badge variant={entry.isFinal ? 'success' : 'warning'}>
                                    {entry.isFinal ? 'final' : 'partial'}
                                  </Badge>
                                </div>
                                <span>{formatRelativeTime(new Date(entry.updatedAt).toISOString())}</span>
                              </div>
                              <p className="text-base leading-7 text-slate-50">{entry.text}</p>
                              {entry.translatedText && entry.targetLanguage ? (
                                <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-300/80">
                                    Translation {entry.targetLanguage}
                                  </p>
                                  <p className="mt-1 text-sm leading-6 text-emerald-100">
                                    {entry.translatedText}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex min-h-[500px] items-center justify-center rounded-[24px] border border-dashed border-cyan-500/20 bg-slate-950/40 p-8 text-center">
                          <div className="max-w-md space-y-2">
                            <p className="text-lg font-medium text-slate-100">Chưa có script realtime</p>
                            <p className="text-sm leading-6 text-slate-400">
                              Khi STT nhận được lời nói từ cuộc họp, transcript sẽ chạy trực tiếp ở khu vực này.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="min-h-[600px] rounded-[30px] border border-white/10 bg-white/[0.03] p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-100">Timeline đã lưu</p>
                          <p className="text-xs text-slate-400">Transcript được lưu để phục vụ evidence và dispute.</p>
                        </div>
                        <Badge variant="muted">{transcripts.length} dòng</Badge>
                      </div>

                      {transcriptsQuery.isLoading ? (
                        <div className="space-y-3">
                          <Skeleton className="h-20 rounded-2xl" />
                          <Skeleton className="h-20 rounded-2xl" />
                        </div>
                      ) : transcripts.length ? (
                        <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                          {[...transcripts].reverse().map((item) => {
                            const riskSummary = getTranscriptRiskSummary(item.id, riskEvents);
                            return (
                              <div
                                key={item.id}
                                className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4"
                              >
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
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
                                <p className="text-sm leading-6 text-slate-100">{item.content}</p>
                                {item.translations?.length ? (
                                  <div className="mt-3 space-y-2">
                                    {item.translations.map((translation) => (
                                      <div
                                        key={translation.id}
                                        className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-100"
                                      >
                                        <span className="mr-2 text-xs uppercase tracking-[0.16em] text-emerald-300/80">
                                          {translation.targetLanguage}
                                        </span>
                                        {translation.content}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                                {riskSummary.labels.length ? (
                                  <div className="mt-3 flex flex-wrap gap-2">
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
              <Card className="border-white/10 bg-slate-950/70">
                <CardHeader className="pb-4">
                  <CardTitle>Risk feed</CardTitle>
                  <CardDescription>Chỉ giữ các cảnh báo nghi ngờ và thông tin cần phản ứng ngay.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {riskQuery.isLoading ? (
                    <>
                      <Skeleton className="h-24 rounded-2xl" />
                      <Skeleton className="h-24 rounded-2xl" />
                    </>
                  ) : topRiskEvents.length ? (
                    topRiskEvents.slice(0, 6).map((event) => (
                      <div
                        key={event.id}
                        className="rounded-[24px] border border-red-500/15 bg-[linear-gradient(180deg,rgba(68,10,12,0.35),rgba(15,6,8,0.7))] p-4"
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant={riskVariant(event.severity)}>{event.severity}</Badge>
                          <Badge variant="muted">{event.type}</Badge>
                        </div>
                        <p className="text-sm leading-6 text-slate-100">{event.description}</p>
                        <p className="mt-2 text-xs text-slate-500">{formatRelativeTime(event.createdAt)}</p>
                      </div>
                    ))
                  ) : (
                    <Alert title="Chưa có nghi ngờ">
                      Khi transcript kích hoạt rule đáng ngờ, thẻ rủi ro sẽ xuất hiện tại đây.
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-slate-950/70">
                <CardHeader className="pb-4">
                  <CardTitle>Participants</CardTitle>
                  <CardDescription>Danh sách gọn để biết ai đang hiện diện trong phiên.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {meeting.participants?.length ? (
                    meeting.participants.map((participant) => (
                      <div
                        key={participant.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-medium text-slate-100">
                              {shortAddress(participant.walletAddress, 6, 6)}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="muted">{participant.role}</Badge>
                              <span className="text-xs text-slate-400">
                                joined {formatRelativeTime(participant.joinedAt)}
                              </span>
                            </div>
                          </div>
                          <Badge variant={participant.isActive ? 'success' : 'muted'}>
                            {participant.isActive ? 'active' : 'left'}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">Chưa có participant.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-slate-950/70">
                <CardHeader className="pb-4">
                  <CardTitle>Invite</CardTitle>
                  <CardDescription>Khối gọn để mời thêm người vào room khi cần.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    value={inviteWallet}
                    onChange={(event) => setInviteWallet(event.target.value)}
                    placeholder="Wallet được mời, để trống nếu muốn link mở"
                  />
                  <div className="grid gap-3 md:grid-cols-2">
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
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      {meeting.invites.slice(0, 3).map((invite) => {
                        const link = `${
                          typeof window !== 'undefined' ? window.location.origin : ''
                        }/meetings/${meeting.id}?invite=${invite.token}`;

                        return (
                          <div key={invite.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <Badge variant="muted">{invite.role}</Badge>
                              <Badge variant={invite.status === 'Accepted' ? 'success' : 'info'}>
                                {invite.status}
                              </Badge>
                              <span className="text-xs text-slate-400">
                                used {invite.usedCount}/{invite.maxUses}
                              </span>
                            </div>
                            <p className="break-all text-xs text-slate-400">{link}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {isDemoTranscriptMode ? (
                <Card className="border-amber-500/20 bg-amber-500/5">
                  <CardHeader className="pb-4">
                    <CardTitle>Manual transcript fallback</CardTitle>
                    <CardDescription>Dùng khi cần test nhanh hoặc STT thật chưa đẩy dữ liệu vào.</CardDescription>
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
                    <div className="flex flex-wrap gap-3">
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
        )}
      </AppShell>
    </AuthGate>
  );
}
