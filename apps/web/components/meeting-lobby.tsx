'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Input } from '@trustroom/ui';

interface MeetingLobbyProps {
  meetingTitle: string;
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  onJoin: () => void;
  joinDisabled?: boolean;
  joinLoading?: boolean;
  error?: string | null;
}

export function MeetingLobby({
  meetingTitle,
  displayName,
  onDisplayNameChange,
  onJoin,
  joinDisabled = false,
  joinLoading = false,
  error = null,
}: MeetingLobbyProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [isPreviewReady, setIsPreviewReady] = useState(false);

  // Start camera preview on mount
  useEffect(() => {
    let active = true;

    async function startPreview() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setIsPreviewReady(true);
      } catch (err) {
        if (!active) return;
        setDeviceError(
          err instanceof Error
            ? `Không thể truy cập camera/microphone: ${err.message}`
            : 'Không thể truy cập camera/microphone.',
        );
        setIsPreviewReady(false);
      }
    }

    void startPreview();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Toggle mic
  useEffect(() => {
    if (!streamRef.current) return;
    streamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = micEnabled;
    });
  }, [micEnabled]);

  // Toggle camera
  useEffect(() => {
    if (!streamRef.current) return;
    streamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = camEnabled;
    });
  }, [camEnabled]);

  // Stop preview when joining
  function handleJoin() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    onJoin();
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-lg space-y-6">
        {/* Title */}
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            Lobby
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-100">
            {meetingTitle}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Kiểm tra thiết bị trước khi vào phòng
          </p>
        </div>

        {/* Camera preview */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#09090b]">
          <video
            ref={videoRef}
            muted
            playsInline
            className={`aspect-[16/9] w-full object-cover ${camEnabled ? '' : 'hidden'}`}
          />

          {!camEnabled && (
            <div className="flex aspect-[16/9] w-full items-center justify-center bg-[#09090b]">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06] text-2xl">
                  📷
                </div>
                <p className="text-sm text-zinc-500">Camera đã tắt</p>
              </div>
            </div>
          )}

          {/* Mic/Cam overlay badges */}
          <div className="absolute bottom-4 left-4 flex gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              micEnabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
            }`}>
              {micEnabled ? '🎤 Mic on' : '🎤 Mic off'}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              camEnabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
            }`}>
              {camEnabled ? '📷 Cam on' : '📷 Cam off'}
            </span>
          </div>
        </div>

        {/* Device error */}
        {deviceError ? (
          <Alert variant="warning" title="Thiết bị chưa sẵn sàng">
            {deviceError}
          </Alert>
        ) : null}

        {/* Join error */}
        {error ? (
          <Alert variant="danger" title="Lỗi khi vào phòng">
            {error}
          </Alert>
        ) : null}

        {/* Name input */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-300">Tên hiển thị</label>
          <Input
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            placeholder="Nhập tên hiển thị trong meeting"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && displayName.trim() && !joinDisabled) {
                handleJoin();
              }
            }}
          />
        </div>

        {/* Toggle buttons + Join */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setMicEnabled((prev) => !prev)}
              className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-150 ${
                micEnabled
                  ? 'border-white/[0.06] bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08]'
                  : 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/15'
              }`}
              title={micEnabled ? 'Tắt mic' : 'Bật mic'}
            >
              {micEnabled ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M6 11a6 6 0 0 0 12 0" />
                  <path d="M12 17v4" />
                  <path d="M8 21h8" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M6 11a6 6 0 0 0 8.2 5.74" />
                  <path d="M12 17v4" />
                  <path d="M8 21h8" />
                  <path d="M4 4l16 16" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={() => setCamEnabled((prev) => !prev)}
              className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-150 ${
                camEnabled
                  ? 'border-white/[0.06] bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08]'
                  : 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/15'
              }`}
              title={camEnabled ? 'Tắt camera' : 'Bật camera'}
            >
              {camEnabled ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <rect x="3" y="7" width="13" height="10" rx="2" />
                  <path d="m16 10 5-3v10l-5-3z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <rect x="3" y="7" width="13" height="10" rx="2" />
                  <path d="m16 10 5-3v10l-5-3z" />
                  <path d="M4 4l16 16" />
                </svg>
              )}
            </button>
          </div>

          <Button
            onClick={handleJoin}
            disabled={!displayName.trim() || joinDisabled || joinLoading}
            className="w-full"
          >
            {joinLoading ? 'Đang kết nối...' : 'Vào phòng'}
          </Button>
        </div>
      </div>
    </div>
  );
}
