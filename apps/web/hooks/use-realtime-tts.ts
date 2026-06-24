'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const SAMPLE_RATE = 24000;
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type TtsSpeakerMode = 'all' | 'buyer' | 'seller' | 'ai';

/**
 * useRealtimeTts — auto TTS transcript khi có meeting_transcript.
 *
 * @param socket Socket.IO instance
 * @param meetingId Meeting ID
 * @param participantRole Vai trò của user hiện tại ('buyer' | 'seller' | null)
 */
export function useRealtimeTts(
  socket: any | null,
  meetingId: string | null,
  participantRole: string | null = null,
) {
  const [enabled, setEnabled] = useState(false);
  const [speakerMode, setSpeakerMode] = useState<TtsSpeakerMode>('all');
  const [speaking, setSpeaking] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const scheduleRef = useRef(0);
  const lastSpokenRef = useRef('');

  const ensureAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      const gain = ctx.createGain();
      gain.gain.value = 1.0;
      gain.connect(ctx.destination);
      audioCtxRef.current = ctx;
      gainRef.current = gain;
      scheduleRef.current = ctx.currentTime;
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const playFrame = useCallback((base64: string) => {
    try {
      const ctx = ensureAudio();
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

      const cnt = bytes.length / 2;
      const float32 = new Float32Array(cnt);
      for (let i = 0; i < cnt; i++) {
        const s = (bytes[i * 2]! | (bytes[i * 2 + 1]! << 8)) << 16 >> 16;
        float32[i] = s / 32768;
      }

      const buffer = ctx.createBuffer(1, cnt, SAMPLE_RATE);
      buffer.getChannelData(0).set(float32);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(gainRef.current!);
      const now = ctx.currentTime;
      const start = Math.max(scheduleRef.current, now);
      src.start(start);
      scheduleRef.current = start + cnt / SAMPLE_RATE;
    } catch (e) {
      console.warn('[TTS:playFrame] err', e);
    }
  }, [ensureAudio]);

  /** Queue các text cần nói, tránh overlap */
  const pendingTextRef = useRef<string | null>(null);
  const isSpeakingRef = useRef(false);

  const speakText = useCallback(async (text: string, speakerLabel: string) => {
    if (!meetingId || !text.trim()) return;

    // Nếu đang gọi API, queue lại text mới nhất
    if (isSpeakingRef.current) {
      pendingTextRef.current = text;
      console.log(`[TTS] queued: "${text.slice(0, 40)}..."`);
      return;
    }

    const doSpeak = async (t: string) => {
      isSpeakingRef.current = true;
      const token = window.localStorage.getItem('trustroom_token');
      const url = `${API_BASE}/api/ai-voice/meeting/${meetingId}/speak`;
      console.log(`[TTS] speakText API: text="${t.slice(0, 40)}..."`);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ text: t, speaker: speakerLabel, translate: true }),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          console.warn(`[TTS] API error ${res.status}: ${txt}`);
        }
      } catch (e) {
        console.warn('[TTS] fetch err', e);
      } finally {
        isSpeakingRef.current = false;
        // Nếu có text pending, nói tiếp
        if (pendingTextRef.current) {
          const next = pendingTextRef.current;
          pendingTextRef.current = null;
          doSpeak(next);
        }
      }
    };

    doSpeak(text);
  }, [meetingId]);

  // Listen transcript events → auto TTS
  useEffect(() => {
    if (!socket || !meetingId || !enabled) return;

    const handleTranscript = (payload: {
      meetingId?: string;
      transcript?: {
        speakerLabel?: string;
        content?: string;
        translations?: Array<{ targetLanguage?: string; content?: string }>;
      };
    }) => {
      console.log('[TTS] 🔔 transcript event', JSON.stringify(payload).slice(0, 200));
      if (payload.meetingId !== meetingId) return;
      const t = payload.transcript;
      if (!t?.content) return;

      const text = (t.translations?.[0]?.content || t.content).trim();
      if (text.length < 3) return;

      // Dedup
      const sim = similarity(text, lastSpokenRef.current);
      if (sim > 0.85) return;
      lastSpokenRef.current = text;

      // Speaker filter: dùng participantRole để quyết định
      // Nếu speakerMode là 'buyer'/'seller', so sánh với participantRole
      if (speakerMode !== 'all') {
        if (!participantRole) return; // Không biết role → skip
        if (speakerMode !== participantRole) return; // Role không khớp → skip
      }

      console.log(`[TTS] speaking: "${text.slice(0, 60)}..." (mode=${speakerMode})`);
      setSpeaking(true);
      speakText(text, t.speakerLabel ?? 'ai');
    };

    socket.on('meeting_transcript', handleTranscript);
    return () => {
      socket.off('meeting_transcript', handleTranscript);
    };
  }, [socket, meetingId, enabled, speakerMode, participantRole, speakText]);

  // Listen TTS audio frames → play
  useEffect(() => {
    if (!socket || !meetingId) return;

    const handleAudio = (p: {
      meetingId?: string;
      frame?: { audio?: string; format?: string };
    }) => {
      if (p.meetingId !== meetingId) return;
      if (p.frame?.audio && p.frame.format === 'pcm_int16') {
        console.log(`[TTS] got audio frame ${p.frame.audio.length} bytes`);
        playFrame(p.frame.audio);
      }
    };

    const handleDone = () => {
      console.log('[TTS] playback done');
      setSpeaking(false);
    };

    socket.on('meeting_tts_audio', handleAudio);
    socket.on('meeting_tts_done', handleDone);
    return () => {
      socket.off('meeting_tts_audio', handleAudio);
      socket.off('meeting_tts_done', handleDone);
    };
  }, [socket, meetingId, playFrame]);

  return { enabled, setEnabled, speakerMode, setSpeakerMode, speaking, speakText: speakText };
}

function similarity(a: string, b: string): number {
  const aa = a.toLowerCase().trim();
  const bb = b.toLowerCase().trim();
  if (!aa || !bb) return 0;
  if (aa === bb) return 1;
  const shorter = aa.length < bb.length ? aa : bb;
  const longer = aa.length < bb.length ? bb : aa;
  if (longer.includes(shorter)) return shorter.length / longer.length;
  let same = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] === longer[i]) same++;
  }
  return same / shorter.length;
}
