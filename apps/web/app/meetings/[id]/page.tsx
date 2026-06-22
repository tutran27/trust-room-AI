'use client';

<<<<<<< Updated upstream
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
  useUpdateMeetingStatus,
} from '../../../hooks/use-api';
import { type AgoraRealtimeTranscriptChunk } from '../../../lib/agora-stt';
import { formatRelativeTime } from '../../../lib/format';
import { shortAddress } from '../../../lib/wallet';
import { useAuth } from '../../../providers/auth-provider';
import { useSocket } from '../../../providers/socket-provider';
=======
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { AuthGate } from '@/components/auth-gate';
import { useMeeting, useMeetingTranscripts, useMeetingRiskEvents } from '@/hooks/use-api';
import { formatDateTime } from '@/lib/format';
import { shortAddress } from '@/lib/wallet';
>>>>>>> Stashed changes

export default function MeetingRoomPage() {
  const params = useParams<{ id: string }>();
  const meetingId = params?.id ?? null;
<<<<<<< Updated upstream
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
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [realtimeNotice, setRealtimeNotice] = useState('');
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
  const realtimeNoticeLower = (realtimeNotice ?? '').toLowerCase();
  const startSttErrorMessage =
    startSttMutation.error instanceof Error
      ? startSttMutation.error.message
      : 'Lỗi không xác định.';
  const startRealtimeDisabled =
    startSttMutation.isPending || !meetingId || isRealtimeRunning;
  const startRealtimeDisabledReason = startSttMutation.isPending
    ? 'Hệ thống đang gửi yêu cầu bật realtime transcript.'
    : !meetingId
      ? 'Meeting chưa sẵn sàng nên chưa thể bật realtime.'
      : isRealtimeRunning
        ? 'Realtime transcript đang ở trạng thái chạy. Hãy tắt trước nếu bạn muốn bật lại.'
        : null;
=======
  const meeting = useMeeting(meetingId);
  const transcript = useMeetingTranscripts(meetingId);
  const riskAlerts = useMeetingRiskEvents(meetingId);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'transcript' | 'alerts' | 'ai'>('transcript');
>>>>>>> Stashed changes

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript.data]);

<<<<<<< Updated upstream
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
            onJoin={() => setHasJoinedRoom(true)}
            joinDisabled={!displayName.trim()}
            joinLoading={tokenQuery.isLoading}
            error={tokenQuery.error instanceof Error ? tokenQuery.error.message : null}
          />
        ) : (
          <div className="grid gap-6 2xl:grid-cols-[2.2fr_0.8fr]">
            <div className="space-y-6">
              {/* Call Room Card */}
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-white/[0.06] pb-5">
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
=======
  const meetingData = meeting.data as any;
  const transcriptData = transcript.data as any;
  const riskAlertsData = riskAlerts.data as any;

  return (
    <AuthGate>
      <AppLayout>
        <div className="space-y-6">
          {/* Header */}
          {meeting.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-64 rounded-xl" />
              <Skeleton className="h-4 w-96 rounded-lg" />
            </div>
          ) : meeting.isError || !meetingData ? (
            <Card padding="lg">
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <p className="text-red-600 font-medium">Failed to load meeting</p>
                <p className="text-sm text-surface-500 mt-1">
                  {meeting.error instanceof Error ? meeting.error.message : 'Meeting not found.'}
                </p>
              </div>
            </Card>
          ) : (
            <>
              {/* Meeting Header */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-surface-900">Meeting Room</h1>
<Badge variant={meetingData.status === 'Active' ? 'success' : meetingData.status === 'Scheduled' ? 'info' : 'default'} dot>
                      {meetingData.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-surface-500">
                    {meetingData.deal?.title ?? meetingData.dealId} · {formatDateTime(meetingData.scheduledAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {meetingData.agoraChannel ? (
                    <Button variant="primary" size="sm">
                      <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                      </svg>
                      Join Call
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* Main Content Grid */}
              <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
                {/* Left: Transcript / Alerts */}
                <div className="space-y-6">
                  {/* Tab Bar */}
                  <div className="flex items-center gap-1 rounded-xl bg-surface-100 p-1">
                    {([
                      { key: 'transcript' as const, label: 'Transcript', count: transcriptData?.length },
                      { key: 'alerts' as const, label: 'Risk Alerts', count: riskAlertsData?.length },
                    ]).map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all flex-1 justify-center ${
                          activeTab === tab.key
                            ? 'bg-white text-surface-900 shadow-sm'
                            : 'text-surface-500 hover:text-surface-700'
                        }`}
                      >
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 ? (
                          <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                            activeTab === tab.key ? 'bg-primary-100 text-primary-700' : 'bg-surface-200 text-surface-500'
                          }`}>
                            {tab.count}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>

                  {/* Transcript Panel */}
                  {activeTab === 'transcript' && (
                    <Card padding="none">
                      <div className="border-b border-surface-200 px-5 py-3.5">
                        <h3 className="text-sm font-semibold text-surface-900">Live Transcript</h3>
                      </div>
                      <div className="h-[480px] overflow-y-auto">
                        {transcript.isLoading ? (
                          <div className="space-y-4 p-5">
                            {Array.from({ length: 6 }).map((_, i) => (
                              <div key={i} className="flex gap-3">
                                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                                <div className="flex-1 space-y-2">
                                  <Skeleton className="h-3 w-24 rounded-lg" />
                                  <Skeleton className="h-4 w-full rounded-lg" />
                                  <Skeleton className="h-4 w-3/4 rounded-lg" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : transcriptData && transcriptData.length > 0 ? (
                          <div className="divide-y divide-surface-100">
                            {transcriptData.map((entry: any) => (
                              <div key={entry.id} className="px-5 py-4 hover:bg-surface-50/50 transition-colors">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-bold">
                                    {(entry.speaker ?? 'U').charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-xs font-semibold text-surface-700">{entry.speaker ?? 'Unknown'}</span>
                                  <span className="text-xs text-surface-400">{formatDateTime(entry.timestamp)}</span>
                                </div>
                                <p className="text-sm text-surface-600 leading-relaxed pl-8">{entry.text}</p>
                              </div>
                            ))}
                            <div ref={transcriptEndRef} />
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-16 px-5">
                            <div className="w-12 h-12 rounded-full bg-surface-100 flex items-center justify-center mb-3">
                              <svg className="w-6 h-6 text-surface-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                            </div>
                            <p className="text-sm font-medium text-surface-600">No transcript yet</p>
                            <p className="text-xs text-surface-400 mt-1">Transcript will appear here once the meeting starts.</p>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}

                  {/* Risk Alerts Panel */}
                  {activeTab === 'alerts' && (
                    <Card padding="none">
                      <div className="border-b border-surface-200 px-5 py-3.5">
                        <h3 className="text-sm font-semibold text-surface-900">Risk Alerts</h3>
                      </div>
                      <div className="h-[480px] overflow-y-auto">
                        {riskAlerts.isLoading ? (
                          <div className="space-y-3 p-5">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <Skeleton key={i} className="h-24 rounded-xl" />
                            ))}
                          </div>
                        ) : riskAlertsData && riskAlertsData.length > 0 ? (
                          <div className="divide-y divide-surface-100">
                            {riskAlertsData.map((alert: any) => (
                              <div key={alert.id} className="px-5 py-4 hover:bg-surface-50/50 transition-colors">
                                <div className="flex items-start gap-3">
                                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                    alert.severity === 'high' ? 'bg-red-100 text-red-600' :
                                    alert.severity === 'medium' ? 'bg-amber-100 text-amber-600' :
                                    'bg-surface-100 text-surface-500'
                                  }`}>
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                    </svg>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant={alert.severity === 'high' ? 'danger' : alert.severity === 'medium' ? 'warning' : 'default'} size="sm">
                                        {alert.severity}
                                      </Badge>
                                      <span className="text-xs text-surface-400">{formatDateTime(alert.timestamp)}</span>
                                    </div>
                                    <p className="text-sm text-surface-700 leading-relaxed">{alert.message}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-16 px-5">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                              <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <p className="text-sm font-medium text-surface-600">No risk alerts</p>
                            <p className="text-xs text-surface-400 mt-1">All clear — no risks detected in this meeting.</p>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
                </div>

                {/* Right Sidebar: AI Panel + Participants */}
                <div className="space-y-6">
                  {/* AI Assistant Panel */}
                  <Card>
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 shadow-sm">
                        <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
>>>>>>> Stashed changes
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-surface-900">AI Assistant</h3>
                        <p className="text-xs text-surface-400">Real-time analysis</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* AI Summary */}
                      <div className="rounded-xl bg-gradient-to-br from-primary-50 to-primary-100/50 p-4 border border-primary-200/50">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="h-3.5 w-3.5 text-primary-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                          </svg>
                          <span className="text-xs font-semibold text-primary-700 uppercase tracking-wider">Live Summary</span>
                        </div>
                        <p className="text-sm text-primary-800 leading-relaxed">
                          {meetingData.aiSummary ?? 'AI summary will appear as the meeting progresses.'}
                        </p>
                      </div>

                      {/* Key Terms */}
                      {meetingData.keyTerms && meetingData.keyTerms.length > 0 ? (
                        <div>
                          <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-2.5">Key Terms Detected</p>
                          <div className="flex flex-wrap gap-1.5">
                            {meetingData.keyTerms.map((term: string, i: number) => (
                              <span key={i} className="inline-flex items-center rounded-lg bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-600">
                                {term}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {/* Action Items */}
                      {meetingData.actionItems && meetingData.actionItems.length > 0 ? (
                        <div>
                          <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-2.5">Action Items</p>
                          <div className="space-y-2">
                            {meetingData.actionItems.map((item: string, i: number) => (
                              <div key={i} className="flex items-start gap-2.5 rounded-lg bg-surface-50 p-3">
                                <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-surface-300">
                                </div>
                                <span className="text-sm text-surface-600 leading-relaxed">{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </Card>

                  {/* Participants */}
                  <Card>
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-sm font-semibold text-surface-900">Participants</h3>
                      <Badge variant="default">{meetingData.participants?.length ?? 0}</Badge>
                    </div>
                    {meetingData.participants?.length ? (
                      <div className="space-y-2">
                        {meetingData.participants.map((p: any) => (
                          <div key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-50 transition-colors">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-bold">
                              {(p.wallet ?? '0x').slice(2, 4).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-surface-800 truncate">{shortAddress(p.wallet, 5, 4)}</p>
                              <p className="text-xs text-surface-400 capitalize">{p.role}</p>
                            </div>
                            <div className={`h-2 w-2 rounded-full ${p.joined ? 'bg-emerald-500' : 'bg-surface-300'}`} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-surface-400 text-center py-4">No participants yet</p>
                    )}
                  </Card>

                  {/* Meeting Info */}
                  <Card>
                    <h3 className="text-sm font-semibold text-surface-900 mb-4">Meeting Info</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-surface-500">Scheduled</span>
                        <span className="text-sm font-medium text-surface-700">{formatDateTime(meetingData.scheduledAt)}</span>
                      </div>
                      {meetingData.startedAt ? (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-surface-500">Started</span>
                          <span className="text-sm font-medium text-surface-700">{formatDateTime(meetingData.startedAt)}</span>
                        </div>
                      ) : null}
                      {meetingData.endedAt ? (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-surface-500">Ended</span>
                          <span className="text-sm font-medium text-surface-700">{formatDateTime(meetingData.endedAt)}</span>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-surface-500">Channel</span>
                        <span className="text-sm font-mono font-medium text-surface-700">{meetingData.agoraChannel ?? '—'}</span>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      </AppLayout>
    </AuthGate>
  );
}