'use client';

import { useEffect, useRef } from 'react';
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
import { useAgoraMeeting } from '../hooks/use-agora-meeting';
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
  onRealtimeTranscript?: (chunk: any) => void;
  onRealtimeTransportStateChange?: (state: {
    status: string;
    detail?: string;
  }) => void;
  /** Called when user clicks Leave — parent should navigate away */
  onLeave?: () => void;
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
  onRealtimeTransportStateChange,
  onLeave,
}: MeetingRtcPanelProps) {
  const {
    meetingId: activeMeetingId,
    status,
    error,
    micEnabled,
    camEnabled,
    join,
    leave,
    toggleMic,
    toggleCam,
    getLocalAudioTrack,
    getLocalVideoTrack,
    playRemoteVideo,
    getRemoteParticipants,
  } = useAgoraMeeting();

  const localVideoRef = useRef<HTMLDivElement | null>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = activeMeetingId === meetingId;
  const canToggleMic = Boolean(getLocalAudioTrack());
  const canToggleCam = Boolean(getLocalVideoTrack());
  const remoteParticipants = getRemoteParticipants();

  // Auto-join when props are ready
  const readyForRtc = Boolean(appId && walletAddress && token && token.trim().length > 0 && !tokenLoading);

  useEffect(() => {
    if (readyForRtc && !isActive && status !== 'connecting') {
      join({
        meetingId,
        appId: appId!,
        token: token!,
        uid,
        sttPusherUid,
        onTranscript: onRealtimeTranscript,
        onTransportState: onRealtimeTransportStateChange,
      });
    }
  }, [readyForRtc, isActive, status, meetingId, appId, token, uid, sttPusherUid, join, onRealtimeTranscript, onRealtimeTransportStateChange]);

  // Play local video when connected
  useEffect(() => {
    if (!isActive || status !== 'connected') return;
    const track = getLocalVideoTrack();
    if (track && localVideoRef.current) {
      track.play(localVideoRef.current);
    }
  }, [isActive, status, getLocalVideoTrack]);

  // Play remote videos whenever participants change
  useEffect(() => {
    if (!isActive) return;
    for (const p of remoteParticipants) {
      const container = remoteVideoRefs.current[p.uid];
      if (container) {
        playRemoteVideo(p.uid, container);
      }
    }
  }, [isActive, remoteParticipants, playRemoteVideo]);

  const showConnecting = status === 'connecting' || (tokenLoading && !isActive);
  const showError = (status === 'error' || tokenError) && !isActive;
  const showVideo = (status === 'connected' || isActive) && readyForRtc;

  return (
    <Card className="rounded-none border-0 bg-transparent shadow-none">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isActive && status === 'connected' ? 'success' : status === 'error' ? 'danger' : 'muted'}>
              {isActive ? status : 'not joined'}
            </Badge>
            {isActive ? (
              <Badge variant={micEnabled ? 'info' : 'muted'}>
                {micEnabled ? 'mic on' : 'mic off'}
              </Badge>
            ) : null}
            {isActive ? (
              <Badge variant={camEnabled ? 'info' : 'muted'}>
                {camEnabled ? 'cam on' : 'cam off'}
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {showConnecting ? <Skeleton className="h-[420px]" /> : null}

        {showError ? (
          <Alert variant="danger" title="Không thể mở call room">
            {error ?? tokenError ?? 'Agora RTC failed.'}
          </Alert>
        ) : null}

        {!readyForRtc && !showConnecting && !showError ? (
          <Alert title="RTC chưa sẵn sàng">
            Đang chờ token từ backend hoặc cấu hình Agora.
          </Alert>
        ) : null}

        {showVideo ? (
          <>
            <div className="grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
              {/* Local video */}
              <div className="overflow-hidden rounded-2xl border border-surface-300 bg-white shadow-sm">
                <div ref={localVideoRef} className="aspect-[16/9] h-[420px] w-full bg-surface-100" />
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-200 bg-surface-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-surface-800">
                      {shortAddress(walletAddress, 6, 6)}
                    </p>
                    <p className="text-[11px] text-surface-500">Local participant</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!micEnabled ? <Badge variant="warning">mic off</Badge> : null}
                    {!camEnabled ? <Badge variant="warning">cam off</Badge> : null}
                  </div>
                </div>
              </div>

              {/* Remote participants */}
              <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-surface-700">Remote</p>
                  <Badge variant={remoteParticipants.length ? 'info' : 'muted'}>
                    {remoteParticipants.length} remote
                  </Badge>
                </div>

                {remoteParticipants.length > 0 ? (
                  <div className="space-y-3">
                    {remoteParticipants.map((participant) => (
                      <div
                        key={participant.uid}
                        className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-sm"
                      >
                        <div
                          ref={(node) => {
                            remoteVideoRefs.current[participant.uid] = node;
                          }}
                          className="aspect-video w-full bg-surface-100"
                        />
                        <div className="flex items-center justify-between border-t border-surface-100 bg-surface-50 px-3 py-2 text-[11px] text-surface-600">
                          <span>uid {participant.uid}</span>
                          <span>
                            {participant.hasAudio ? '🎤' : '🔇'} • {participant.hasVideo ? '📷' : '📷 off'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-surface-300 bg-surface-50 p-6 text-center">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-surface-600">Chưa có ai khác trong room</p>
                      <p className="text-[11px] text-surface-500">
                        Khi participant khác join, khung video remote sẽ hiện tại đây.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void toggleMic()}
                variant={micEnabled ? 'secondary' : 'ghost'}
                disabled={!canToggleMic}
              >
                {micEnabled ? '🎤 Tắt mic' : '🎤 Bật mic'}
              </Button>
              <Button
                onClick={() => void toggleCam()}
                variant={camEnabled ? 'secondary' : 'ghost'}
                disabled={!canToggleCam}
              >
                {camEnabled ? '📷 Tắt cam' : '📷 Bật cam'}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  void leave();
                  onLeave?.();
                }}
              >
                Rời phòng
              </Button>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
