'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '../providers/socket-provider';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface TranslationCaption {
  meetingId: string;
  transcriptId?: string;
  speakerWallet?: string;
  originalText?: string;
  translatedText: string;
  sourceLang?: string;
  targetLang?: string;
  provider?: string;
  timestamp: string;
}

export interface TranslationAudioEvent {
  meetingId: string;
  audioBase64: string;
  translatedText: string;
  provider?: string;
  timestamp: string;
}

export interface TranslationError {
  meetingId: string;
  transcriptId?: string;
  speakerWallet?: string;
  error: string;
  timestamp: string;
}

/* ------------------------------------------------------------------ */
/*  Translation Captions Hook                                          */
/* ------------------------------------------------------------------ */

export function useTranslationCaptions(meetingId: string | null) {
  const { socket } = useSocket();
  const [captions, setCaptions] = useState<TranslationCaption[]>([]);
  const [latestCaption, setLatestCaption] = useState<TranslationCaption | null>(null);
  const [error, setError] = useState<TranslationError | null>(null);

  useEffect(() => {
    if (!socket || !meetingId) return;

    const handleTranslatedTranscript = (payload: Record<string, unknown>) => {
      if (payload.meetingId !== meetingId) return;

      const caption: TranslationCaption = {
        meetingId: payload.meetingId as string,
        transcriptId: payload.transcriptId as string | undefined,
        speakerWallet: payload.speakerWallet as string | undefined,
        originalText: payload.original_text as string | undefined,
        translatedText: (payload.translated_text as string) ?? '',
        sourceLang: payload.source_lang as string | undefined,
        targetLang: payload.target_lang as string | undefined,
        provider: payload.provider as string | undefined,
        timestamp: (payload.timestamp as string) ?? new Date().toISOString(),
      };

      setLatestCaption(caption);
      setCaptions((prev) => {
        const next = [...prev, caption];
        // Keep last 50 captions
        return next.slice(-50);
      });
    };

    const handleTranslationError = (payload: Record<string, unknown>) => {
      if (payload.meetingId !== meetingId) return;

      setError({
        meetingId: payload.meetingId as string,
        transcriptId: payload.transcriptId as string | undefined,
        speakerWallet: payload.speakerWallet as string | undefined,
        error: (payload.error as string) ?? 'Unknown translation error',
        timestamp: (payload.timestamp as string) ?? new Date().toISOString(),
      });

      // Auto-clear error after 5s
      setTimeout(() => setError(null), 5000);
    };

    socket.on('translated_transcript', handleTranslatedTranscript);
    socket.on('translation_error', handleTranslationError);

    return () => {
      socket.off('translated_transcript', handleTranslatedTranscript);
      socket.off('translation_error', handleTranslationError);
    };
  }, [meetingId, socket]);

  return { captions, latestCaption, error };
}

/* ------------------------------------------------------------------ */
/*  Translation Audio Playback Hook                                    */
/* ------------------------------------------------------------------ */

interface AudioQueueItem {
  audioBase64: string;
  translatedText: string;
  provider?: string;
  timestamp: string;
}

export function useTranslationAudioPlayback() {
  const [queue, setQueue] = useState<AudioQueueItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [enabled, setEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<AudioQueueItem[]>([]);

  // Keep ref in sync
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const playNext = useCallback(() => {
    const next = queueRef.current[0];
    if (!next) {
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);

    // Drop if audio is too old (>10s)
    const age = Date.now() - new Date(next.timestamp).getTime();
    if (age > 10_000) {
      setQueue((prev) => prev.slice(1));
      // Try next immediately
      requestAnimationFrame(() => playNext());
      return;
    }

    try {
      const audio = new Audio(`data:audio/mp3;base64,${next.audioBase64}`);
      audio.volume = volume;
      audioRef.current = audio;

      audio.onended = () => {
        setQueue((prev) => prev.slice(1));
        // Small gap between audio clips (80ms)
        setTimeout(() => playNext(), 80);
      };

      audio.onerror = () => {
        // Skip failed audio, play next
        setQueue((prev) => prev.slice(1));
        setTimeout(() => playNext(), 40);
      };

      void audio.play().catch(() => {
        setQueue((prev) => prev.slice(1));
        setIsPlaying(false);
      });
    } catch {
      setQueue((prev) => prev.slice(1));
      setIsPlaying(false);
    }
  }, [volume]);

  const enqueueAudio = useCallback(
    (item: AudioQueueItem) => {
      if (!enabled) return;

      // Don't enqueue too many (max 5 pending)
      setQueue((prev) => {
        if (prev.length >= 5) return prev;
        return [...prev, item];
      });

      if (!isPlaying) {
        // Start playing after state updates
        setTimeout(() => playNext(), 10);
      }
    },
    [enabled, isPlaying, playNext],
  );

  const clearQueue = useCallback(() => {
    setQueue([]);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // Update volume on current playing audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  return {
    enqueueAudio,
    clearQueue,
    isPlaying,
    queueLength: queue.length,
    volume,
    setVolume,
    enabled,
    setEnabled,
  };
}

/* ------------------------------------------------------------------ */
/*  Translation Settings Hook                                          */
/* ------------------------------------------------------------------ */

export type TranslationLang = 'vi' | 'en' | '';
export type TTSProvider = 'google' | 'edge';

export interface TranslationSettings {
  enabled: boolean;
  sourceLang: TranslationLang;
  targetLang: TranslationLang;
  ttsProvider: TTSProvider;
  volume: number;
}

export function useTranslationSettings(meetingId: string | null) {
  const storageKey = meetingId ? `translation_settings_${meetingId}` : '';

  const [settings, setSettings] = useState<TranslationSettings>(() => {
    if (typeof window === 'undefined' || !storageKey) {
      return {
        enabled: false,
        sourceLang: '',
        targetLang: 'vi',
        ttsProvider: 'google',
        volume: 0.8,
      };
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) return JSON.parse(stored) as TranslationSettings;
    } catch {
      // ignore
    }

    return {
      enabled: false,
      sourceLang: '',
      targetLang: 'vi',
      ttsProvider: 'google',
      volume: 0.8,
    };
  });

  // Persist to localStorage
  useEffect(() => {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(settings));
      } catch {
        // ignore
      }
    }
  }, [settings, storageKey]);

  return { settings, setSettings };
}