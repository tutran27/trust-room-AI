'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@trustroom/ui';
import { decodeAgoraSttPayload, type AgoraRealtimeTranscriptChunk } from '../lib/agora-stt';
import { shortAddress } from '../lib/wallet';

interface MeetingRtcPanelProps {
  meetingId: string;
  title: string;
  appId?: string;
  token?: string;
  tokenLoading?: boolean;
  tokenError?: string | null;
  uid: number;
  walletAddress: string | null;
  sttPusherUid?: number | null;
  onRealtimeTranscript?: (chunk: AgoraRealtimeTranscriptChunk) => void;
}

interface RemoteParticipant {
  uid: string;
  hasAudio: boolean;
  hasVideo: boolean;
}

interface LocalDeviceState {
  hasMicrophone: boolean;
  hasCamera: boolean;
}

interface AudioActivity {
  level: number;
  updatedAt: number;
}

export function MeetingRtcPanel({
  meetingId,
  title,
  appId,
  token,
  tokenLoading = false,
  tokenError = null,
  uid,
  walletAddress,
  sttPusherUid,
  onRealtimeTranscript,
}: MeetingRtcPanelProps) {
  const localVideoRef = useRef<HTMLDivElement | null>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const clientRef = useRef<any>(null);
  const localAudioTrackRef = useRef<any>(null);
  const localVideoTrackRef = useRef<any>(null);
  const remoteUsersRef = useRef<Map<string, any>>(new Map());
  const mountedRef = useRef(true);
  const transcriptCallbackRef = useRef(onRealtimeTranscript);
  const sttPusherUidRef = useRef(sttPusherUid);

  const [status, setStatus] = useState<
    'idle' | 'connecting' | 'connected' | 'error' | 'unsupported'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const [deviceWarning, setDeviceWarning] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [deviceState, setDeviceState] = useState<LocalDeviceState>({
    hasMicrophone: true,
    hasCamera: true,
  });
  const [localAudioActivity, setLocalAudioActivity] = useState<AudioActivity>({
    level: 0,
    updatedAt: 0,
  });
  const [remoteAudioActivity, setRemoteAudioActivity] = useState<Record<string, AudioActivity>>({});

  const readyForRtc = Boolean(appId && walletAddress);
  const hasJoinToken = Boolean(token && token.trim().length > 0);
  const canToggleMic = Boolean(localAudioTrackRef.current);
  const canToggleCam = Boolean(localVideoTrackRef.current);

  useEffect(() => {
    transcriptCallbackRef.current = onRealtimeTranscript;
  }, [onRealtimeTranscript]);

  useEffect(() => {
    sttPusherUidRef.current = sttPusherUid;
  }, [sttPusherUid]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!readyForRtc) {
      setStatus(appId ? 'idle' : 'unsupported');
      setError(null);
      return;
    }

    if (tokenLoading) {
      setStatus('connecting');
      setError(null);
      return;
    }

    if (tokenError) {
      setStatus('error');
      setError(tokenError);
      return;
    }

    if (!hasJoinToken) {
      setStatus('error');
      setError('Meeting room chưa nhận được Agora token hợp lệ từ backend.');
      return;
    }

    let cancelled = false;
    let effectClient: any = null;
    let joinedChannel = false;

    async function joinRtc() {
      try {
        setStatus('connecting');
        setError(null);
        setDeviceWarning(null);
        setMicEnabled(true);
        setCamEnabled(true);
        setLocalAudioActivity({ level: 0, updatedAt: 0 });
        setRemoteAudioActivity({});

        await wait(150);
        if (cancelled) {
          return;
        }

        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        if (cancelled) {
          return;
        }

        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        effectClient = client;
        clientRef.current = client;

        client.on('volume-indicator', (volumes: Array<{ uid: string | number; level: number }>) => {
          const now = Date.now();
          let localEntry: AudioActivity = { level: 0, updatedAt: now };
          const nextRemoteActivity: Record<string, AudioActivity> = {};

          for (const volume of volumes) {
            const normalizedLevel = clampAudioLevel(volume.level);
            const entry = {
              level: normalizedLevel,
              updatedAt: now,
            };

            if (Number(volume.uid) === Number(uid)) {
              localEntry = entry;
            } else {
              nextRemoteActivity[String(volume.uid)] = entry;
            }
          }

          if (!mountedRef.current) {
            return;
          }

          setLocalAudioActivity(localEntry);
          setRemoteAudioActivity((current) => {
            const merged: Record<string, AudioActivity> = {};
            const allKeys = new Set([...Object.keys(current), ...Object.keys(nextRemoteActivity)]);

            for (const key of allKeys) {
              merged[key] = nextRemoteActivity[key] ?? { level: 0, updatedAt: now };
            }

            return merged;
          });
        });

        client.on('user-published', async (user: any, mediaType: 'audio' | 'video') => {
          await client.subscribe(user, mediaType);
          const key = String(user.uid);
          remoteUsersRef.current.set(key, user);

          if (mediaType === 'audio' && user.audioTrack) {
            user.audioTrack.play();
          }

          if (mediaType === 'video' && user.videoTrack) {
            const container = remoteVideoRefs.current[key];
            if (container) {
              user.videoTrack.play(container);
            }
          }

          if (!mountedRef.current) {
            return;
          }

          setRemoteParticipants((current) => {
            const next = current.filter((item) => item.uid !== key);
            next.push({
              uid: key,
              hasAudio: Boolean(user.hasAudio),
              hasVideo: Boolean(user.hasVideo),
            });
            return next;
          });
        });

        client.on('user-unpublished', (user: any, mediaType: 'audio' | 'video') => {
          const key = String(user.uid);
          if (mediaType === 'video') {
            user.videoTrack?.stop();
          }

          if (!mountedRef.current) {
            return;
          }

          setRemoteParticipants((current) =>
            current.map((item) =>
              item.uid === key
                ? {
                    ...item,
                    hasAudio: mediaType === 'audio' ? false : item.hasAudio,
                    hasVideo: mediaType === 'video' ? false : item.hasVideo,
                  }
                : item,
            ),
          );
        });

        client.on('user-left', (user: any) => {
          const key = String(user.uid);
          remoteUsersRef.current.delete(key);
          if (!mountedRef.current) {
            return;
          }
          setRemoteParticipants((current) => current.filter((item) => item.uid !== key));
          setRemoteAudioActivity((current) => {
            if (!(key in current)) {
              return current;
            }
            const next = { ...current };
            delete next[key];
            return next;
          });
        });

        client.on('stream-message', async (remoteUid: string | number, payload: Uint8Array) => {
          if (!transcriptCallbackRef.current) {
            return;
          }
          const normalizedRemoteUid =
            typeof remoteUid === 'number' ? remoteUid : Number(remoteUid);
          if (
            sttPusherUidRef.current &&
            Number.isFinite(normalizedRemoteUid) &&
            normalizedRemoteUid !== Number(sttPusherUidRef.current)
          ) {
            return;
          }

          try {
            const chunks = await decodeAgoraSttPayload(payload);
            for (const chunk of chunks) {
              transcriptCallbackRef.current?.(chunk);
            }
          } catch (decodeError) {
            if (mountedRef.current) {
              setDeviceWarning(
                `Đã kết nối call room nhưng không parse được gói transcript realtime: ${
                  decodeError instanceof Error ? decodeError.message : String(decodeError)
                }`,
              );
            }
          }
        });

        await client.join(appId!, meetingId, token!, uid);
        joinedChannel = true;
        client.enableAudioVolumeIndicator();

        const localDevices = await detectLocalMediaDevices();
        const warnings: string[] = [];
        let microphoneTrack: any = null;
        let cameraTrack: any = null;

        setDeviceState(localDevices);

        if (localDevices.hasMicrophone) {
          try {
            microphoneTrack = await AgoraRTC.createMicrophoneAudioTrack();
          } catch (trackError) {
            setMicEnabled(false);
            warnings.push(describeDeviceError(trackError, 'microphone'));
          }
        } else {
          setMicEnabled(false);
          warnings.push(
            'Không tìm thấy microphone trên máy này, nên bạn vẫn vào room nhưng không phát mic.',
          );
        }

        if (localDevices.hasCamera) {
          try {
            cameraTrack = await AgoraRTC.createCameraVideoTrack();
          } catch (trackError) {
            setCamEnabled(false);
            warnings.push(describeDeviceError(trackError, 'camera'));
          }
        } else {
          setCamEnabled(false);
          warnings.push(
            'Không tìm thấy camera trên máy này, nên bạn vẫn vào room nhưng không phát camera.',
          );
        }

        localAudioTrackRef.current = microphoneTrack;
        localVideoTrackRef.current = cameraTrack;

        if (cameraTrack && localVideoRef.current) {
          cameraTrack.play(localVideoRef.current);
        }

        const tracksToPublish = [microphoneTrack, cameraTrack].filter(Boolean);
        if (tracksToPublish.length > 0) {
          await client.publish(tracksToPublish);
        }

        if (warnings.length > 0 && mountedRef.current) {
          setDeviceWarning(warnings.join(' '));
        }

        if (!cancelled && mountedRef.current) {
          setStatus('connected');
        }
      } catch (joinError) {
        if (!cancelled && mountedRef.current) {
          setStatus('error');
          setError(
            joinError instanceof Error ? joinError.message : 'Không thể tham gia Agora RTC.',
          );
        }
      }
    }

    void joinRtc();

    return () => {
      cancelled = true;
      const cleanup = async () => {
        try {
          localAudioTrackRef.current?.stop();
          localAudioTrackRef.current?.close();
          localVideoTrackRef.current?.stop();
          localVideoTrackRef.current?.close();
          if (effectClient && joinedChannel) {
            await effectClient.leave();
          }
        } catch {
          // ignore cleanup failures
        } finally {
          if (clientRef.current === effectClient) {
            clientRef.current = null;
          }
          localAudioTrackRef.current = null;
          localVideoTrackRef.current = null;
          remoteUsersRef.current.clear();
          if (mountedRef.current) {
            setRemoteParticipants([]);
            setLocalAudioActivity({ level: 0, updatedAt: 0 });
            setRemoteAudioActivity({});
          }
        }
      };

      void cleanup();
    };
  }, [
    appId,
    hasJoinToken,
    meetingId,
    readyForRtc,
    token,
    tokenError,
    tokenLoading,
    uid,
    walletAddress,
  ]);

  useEffect(() => {
    for (const participant of remoteParticipants) {
      const user = remoteUsersRef.current.get(participant.uid);
      const container = remoteVideoRefs.current[participant.uid];
      if (user?.videoTrack && container) {
        user.videoTrack.play(container);
      }
    }
  }, [remoteParticipants]);

  async function toggleMic() {
    if (!localAudioTrackRef.current) {
      return;
    }
    const next = !micEnabled;
    await localAudioTrackRef.current.setEnabled(next);
    setMicEnabled(next);
    if (!next) {
      setLocalAudioActivity({ level: 0, updatedAt: Date.now() });
    }
  }

  async function toggleCam() {
    if (!localVideoTrackRef.current) {
      return;
    }
    const next = !camEnabled;
    await localVideoTrackRef.current.setEnabled(next);
    setCamEnabled(next);
  }

  return (
    <Card className="rounded-none border-0 bg-transparent shadow-none">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <p className="mt-1 text-sm text-slate-400">
              Ưu tiên hiển thị call room lớn để dễ quan sát ngữ cảnh trong lúc transcript đang chạy.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={status === 'connected' ? 'success' : status === 'error' ? 'danger' : 'muted'}>
              {status}
            </Badge>
            <Badge variant={micEnabled ? 'info' : 'muted'}>
              {micEnabled ? 'mic on' : 'mic off'}
            </Badge>
            <Badge variant={camEnabled ? 'info' : 'muted'}>
              {camEnabled ? 'cam on' : 'cam off'}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {status === 'connecting' ? <Skeleton className="h-[520px] rounded-[28px]" /> : null}

        {status === 'connected' && !deviceWarning ? (
          <Alert variant="success" title="Call room đã kết nối">
            RTC đang hoạt động ổn định.
          </Alert>
        ) : null}

        {status === 'error' ? (
          <Alert variant="danger" title="Không thể mở call room">
            {error ?? 'Agora RTC failed.'}
          </Alert>
        ) : null}

        {deviceWarning ? (
          <Alert variant="warning" title="Thiết bị cục bộ chưa sẵn sàng">
            {deviceWarning}
          </Alert>
        ) : null}

        {status === 'unsupported' ? (
          <Alert title="RTC chưa sẵn sàng">
            Hãy cấu hình `NEXT_PUBLIC_AGORA_APP_ID` và `AGORA_APP_CERTIFICATE` để bật meeting room thật.
          </Alert>
        ) : null}

        {(status === 'connected' || status === 'idle') && readyForRtc ? (
          <>
            <div className="grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
              <div
                className="overflow-hidden rounded-[30px] border border-cyan-500/20 bg-[linear-gradient(180deg,rgba(5,10,20,0.55),rgba(2,6,16,0.9))] transition-all duration-300"
                style={buildSpeakingGlowStyle(localAudioActivity.level, micEnabled)}
              >
                <div ref={localVideoRef} className="aspect-[16/9] min-h-[520px] w-full bg-slate-950" />
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <MicActivityBadge level={localAudioActivity.level} enabled={micEnabled} />
                    <div>
                      <p className="text-sm font-medium text-slate-100">
                        {shortAddress(walletAddress, 6, 6)}
                      </p>
                      <p className="text-xs text-slate-400">Local participant</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <MicLevelBars level={localAudioActivity.level} enabled={micEnabled} />
                    <p className="text-sm font-medium text-slate-100">
                      {describeSpeakingState(localAudioActivity.level, micEnabled)}
                    </p>
                    {!deviceState.hasMicrophone ? <Badge variant="warning">thiếu mic</Badge> : null}
                    {!deviceState.hasCamera ? <Badge variant="warning">thiếu cam</Badge> : null}
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-slate-950/50 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-100">Người khác trong room</p>
                    <p className="text-xs text-slate-400">Video và audio remote sẽ đổ vào đây.</p>
                  </div>
                  <Badge variant={remoteParticipants.length ? 'info' : 'muted'}>
                    {remoteParticipants.length} remote
                  </Badge>
                </div>

                {remoteParticipants.length > 0 ? (
                  <div className="space-y-3">
                    {remoteParticipants.map((participant) => (
                      <div
                        key={participant.uid}
                        className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-900/70 transition-all duration-300"
                        style={buildSpeakingGlowStyle(
                          remoteAudioActivity[participant.uid]?.level ?? 0,
                          participant.hasAudio,
                        )}
                      >
                        <div
                          ref={(node) => {
                            remoteVideoRefs.current[participant.uid] = node;
                          }}
                          className="aspect-video w-full bg-slate-950"
                        />
                        <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-slate-400">
                          <span className="flex items-center gap-2">
                            <MicActivityBadge
                              level={remoteAudioActivity[participant.uid]?.level ?? 0}
                              enabled={participant.hasAudio}
                              compact
                            />
                            uid {participant.uid}
                          </span>
                          <span className="flex items-center gap-2">
                            <MicLevelBars
                              level={remoteAudioActivity[participant.uid]?.level ?? 0}
                              enabled={participant.hasAudio}
                              compact
                            />
                            <span>
                              {describeSpeakingState(
                                remoteAudioActivity[participant.uid]?.level ?? 0,
                                participant.hasAudio,
                              )}{' '}
                              • {participant.hasVideo ? 'video' : 'no video'}
                            </span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-slate-950/40 p-6 text-center">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-100">Chưa có ai khác trong room</p>
                      <p className="text-xs leading-5 text-slate-400">
                        Khi participant khác join, khung video remote sẽ hiện tại đây.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => void toggleMic()}
                variant={micEnabled ? 'secondary' : 'ghost'}
                disabled={!canToggleMic}
              >
                <span className="flex items-center gap-2">
                  {micEnabled ? <MicOnIcon /> : <MicOffIcon />}
                  {canToggleMic ? (micEnabled ? 'Tắt mic' : 'Bật mic') : 'Không có mic'}
                </span>
              </Button>
              <Button
                onClick={() => void toggleCam()}
                variant={camEnabled ? 'secondary' : 'ghost'}
                disabled={!canToggleCam}
              >
                <span className="flex items-center gap-2">
                  {camEnabled ? <CameraOnIcon /> : <CameraOffIcon />}
                  {canToggleCam ? (camEnabled ? 'Tắt cam' : 'Bật cam') : 'Không có cam'}
                </span>
              </Button>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function clampAudioLevel(level: number) {
  if (!Number.isFinite(level)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(level)));
}

function buildSpeakingGlowStyle(level: number, enabled: boolean) {
  if (!enabled || level <= 6) {
    return undefined;
  }

  const alpha = Math.min(0.45, 0.08 + level / 240);
  const blur = 10 + level / 2.8;
  const spread = 1 + level / 20;

  return {
    boxShadow: `0 0 ${blur}px rgba(34,211,238,${alpha}), 0 0 ${spread}px rgba(56,189,248,${
      alpha / 1.5
    }) inset`,
    borderColor: `rgba(34,211,238,${Math.min(0.4, 0.14 + level / 220)})`,
  };
}

function describeSpeakingState(level: number, enabled: boolean) {
  if (!enabled) {
    return 'mic off';
  }
  if (level >= 65) {
    return 'đang nói rõ';
  }
  if (level >= 30) {
    return 'đang thu tiếng';
  }
  return 'đang chờ tiếng nói';
}

function describeDeviceError(error: unknown, device: 'microphone' | 'camera') {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const lowered = message.toLowerCase();

  if (lowered.includes('device_not_found') || lowered.includes('notfounderror')) {
    return device === 'microphone'
      ? 'Không tìm thấy microphone trên máy này, nên bạn vẫn vào room nhưng không phát mic.'
      : 'Không tìm thấy camera trên máy này, nên bạn vẫn vào room nhưng không phát camera.';
  }

  if (lowered.includes('notallowederror') || lowered.includes('permission')) {
    return device === 'microphone'
      ? 'Trình duyệt chưa được cấp quyền microphone, nên bạn vẫn vào room nhưng không phát mic.'
      : 'Trình duyệt chưa được cấp quyền camera, nên bạn vẫn vào room nhưng không phát camera.';
  }

  return device === 'microphone'
    ? 'Không khởi tạo được microphone cục bộ, nhưng bạn vẫn có thể nghe và tham gia room.'
    : 'Không khởi tạo được camera cục bộ, nhưng bạn vẫn có thể nghe và tham gia room.';
}

async function detectLocalMediaDevices(): Promise<LocalDeviceState> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return { hasMicrophone: true, hasCamera: true };
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      hasMicrophone: devices.some((device) => device.kind === 'audioinput'),
      hasCamera: devices.some((device) => device.kind === 'videoinput'),
    };
  } catch {
    return { hasMicrophone: true, hasCamera: true };
  }
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function MicOnIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0" />
      <path d="M12 17v4" />
      <path d="M8 21h8" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 8.2 5.74" />
      <path d="M12 17v4" />
      <path d="M8 21h8" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

function CameraOnIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
      <rect x="3" y="7" width="13" height="10" rx="2" />
      <path d="m16 10 5-3v10l-5-3z" />
    </svg>
  );
}

function CameraOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
      <rect x="3" y="7" width="13" height="10" rx="2" />
      <path d="m16 10 5-3v10l-5-3z" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

function MicActivityBadge({
  level,
  enabled,
  compact = false,
}: {
  level: number;
  enabled: boolean;
  compact?: boolean;
}) {
  const sizeClass = compact ? 'h-8 w-8' : 'h-10 w-10';
  const iconClass = compact ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]';
  const isSpeaking = enabled && level > 12;

  return (
    <div className="relative flex items-center justify-center">
      {isSpeaking ? (
        <>
          <span
            className={`absolute rounded-full bg-cyan-400/20 ${sizeClass} animate-ping`}
            style={{
              transform: `scale(${1 + Math.min(level, 100) / 120})`,
              animationDuration: `${Math.max(0.8, 1.8 - Math.min(level, 100) / 90)}s`,
            }}
          />
          <span
            className={`absolute rounded-full border border-cyan-300/40 ${sizeClass}`}
            style={{
              transform: `scale(${1 + Math.min(level, 100) / 220})`,
            }}
          />
        </>
      ) : null}
      <span
        className={`relative flex ${sizeClass} items-center justify-center rounded-full border transition-all duration-300 ${
          enabled
            ? isSpeaking
              ? 'border-cyan-300/50 bg-cyan-400/15 text-cyan-100'
              : 'border-white/10 bg-slate-900/80 text-slate-200'
            : 'border-white/10 bg-slate-950/80 text-slate-500'
        }`}
      >
        {enabled ? (
          <svg viewBox="0 0 24 24" aria-hidden="true" className={`${iconClass} fill-none stroke-current stroke-2`}>
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M6 11a6 6 0 0 0 12 0" />
            <path d="M12 17v4" />
            <path d="M8 21h8" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" className={`${iconClass} fill-none stroke-current stroke-2`}>
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M6 11a6 6 0 0 0 8.2 5.74" />
            <path d="M12 17v4" />
            <path d="M8 21h8" />
            <path d="M4 4l16 16" />
          </svg>
        )}
      </span>
    </div>
  );
}

function MicLevelBars({
  level,
  enabled,
  compact = false,
}: {
  level: number;
  enabled: boolean;
  compact?: boolean;
}) {
  const barWidth = compact ? 'w-1' : 'w-1.5';
  const barHeights = enabled
    ? [
        Math.max(6, level * 0.22),
        Math.max(8, level * 0.32),
        Math.max(10, level * 0.42),
        Math.max(8, level * 0.3),
      ]
    : [6, 6, 6, 6];

  return (
    <div className="flex items-end gap-1 rounded-full border border-white/10 bg-slate-950/70 px-2 py-1">
      {barHeights.map((height, index) => (
        <span
          key={index}
          className={`${barWidth} rounded-full transition-all duration-200 ${
            enabled ? 'bg-cyan-300' : 'bg-slate-600'
          }`}
          style={{ height }}
        />
      ))}
    </div>
  );
}
