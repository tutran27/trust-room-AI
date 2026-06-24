'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook: phát PCM int16 audio từ WebSocket TTS events.
 *
 * Nhận `meeting_tts_sentence`, `meeting_tts_audio`, `meeting_tts_done`
 * events từ socket và phát qua AudioContext.
 */

const SAMPLE_RATE = 24000;

interface TtsAudioFrame {
  seq: number;
  audio: string; // base64 PCM int16
  sampleRate: number;
  channels: number;
  format: string;
}

export function useTtsPlayer(socket: any | null, meetingId: string | null) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const isPlayingRef = useRef(false);
  const scheduleRef = useRef(0); // next scheduled time in AudioContext time
  const [status, setStatus] = useState<'idle' | 'playing' | 'done'>('idle');
  const [currentSentence, setCurrentSentence] = useState<string | null>(null);

  // Ensure AudioContext is created (lazy, after user gesture)
  const ensureAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      const gain = ctx.createGain();
      gain.gain.value = 1.0;
      gain.connect(ctx.destination);
      audioCtxRef.current = ctx;
      gainNodeRef.current = gain;
      scheduleRef.current = ctx.currentTime;
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Play a single PCM frame
  const playFrame = useCallback((base64: string) => {
    try {
      const ctx = ensureAudio();
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      // Convert 2 bytes -> int16
      const sampleCount = bytes.length / 2;
      const float32 = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        const sample = (bytes[i * 2]! | (bytes[i * 2 + 1]! << 8)) << 16 >> 16;
        float32[i] = sample / 32768;
      }

      const buffer = ctx.createBuffer(1, sampleCount, SAMPLE_RATE);
      buffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNodeRef.current!);

      // Schedule at the right time to avoid gaps
      const now = ctx.currentTime;
      const startTime = Math.max(scheduleRef.current, now);
      source.start(startTime);
      scheduleRef.current = startTime + sampleCount / SAMPLE_RATE;
    } catch (err) {
      console.warn('[TTS] Frame play error:', err);
    }
  }, [ensureAudio]);

  // Reset schedule (for new TTS utterance)
  const resetSchedule = useCallback(() => {
    if (audioCtxRef.current) {
      scheduleRef.current = audioCtxRef.current.currentTime;
    }
  }, []);

  // Attach WebSocket listeners
  useEffect(() => {
    if (!socket || !meetingId) return;

    const handleSentence = (payload: { meetingId?: string; sentence?: { content?: string } }) => {
      if (payload.meetingId !== meetingId) return;
      const text = payload.sentence?.content;
      if (text) {
        setCurrentSentence(text);
      }
    };

    const handleAudio = (payload: { meetingId?: string; frame?: TtsAudioFrame }) => {
      if (payload.meetingId !== meetingId) return;
      const frame = payload.frame;
      if (frame?.audio && frame.format === 'pcm_int16') {
        setStatus('playing');
        isPlayingRef.current = true;
        playFrame(frame.audio);
      }
    };

    const handleDone = (payload: { meetingId?: string }) => {
      if (payload.meetingId !== meetingId) return;
      setStatus('done');
      isPlayingRef.current = false;
      setCurrentSentence(null);
    };

    socket.on('meeting_tts_sentence', handleSentence);
    socket.on('meeting_tts_audio', handleAudio);
    socket.on('meeting_tts_done', handleDone);

    return () => {
      socket.off('meeting_tts_sentence', handleSentence);
      socket.off('meeting_tts_audio', handleAudio);
      socket.off('meeting_tts_done', handleDone);
    };
  }, [socket, meetingId, playFrame]);

  // Speak text via REST API
  const speak = useCallback(async (text: string, demoMode = false) => {
    if (!text.trim() || !meetingId) return;
    const token = window.localStorage.getItem('trustroom_token');
    try {
      resetSchedule();
      setCurrentSentence(text);
      setStatus('playing');

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/ai-voice/meeting/${meetingId}/speak`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            text,
            speaker: 'ai',
            demoMode,
          }),
        },
      );
      if (!res.ok) {
        console.warn('[TTS] Speak failed:', await res.text().catch(() => ''));
      }
    } catch (err) {
      console.warn('[TTS] Speak error:', err);
    }
  }, [meetingId, resetSchedule]);

  return {
    status,
    currentSentence,
    speak,
    resetSchedule,
    ensureAudio,
  };
}
