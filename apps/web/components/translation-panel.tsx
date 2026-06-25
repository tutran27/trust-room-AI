'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { apiFetch } from '@/lib/api-client';
import {
  useTranslationCaptions,
  useTranslationAudioPlayback,
  useTranslationSettings,
  type TranslationLang,
  type TTSProvider,
} from '@/hooks/use-translation';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface TranslationPanelProps {
  meetingId: string;
  onTargetLangChange?: (lang: TranslationLang) => void;
}

interface TranslationJobLog {
  transcriptId: string;
  text: string;
  status: 'queued' | 'translating' | 'done' | 'error' | 'skipped';
  message: string;
  timestamp: string;
}

/* ------------------------------------------------------------------ */
/*  Simple Select Component                                            */
/* ------------------------------------------------------------------ */

function SimpleSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-300/40"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/*  Select Options                                                     */
/* ------------------------------------------------------------------ */

const TARGET_LANG_OPTIONS: { label: string; value: TranslationLang }[] = [
  { label: 'Tiếng Việt', value: 'vi' },
  { label: 'English', value: 'en' },
];

const TTS_PROVIDER_OPTIONS: { label: string; value: TTSProvider }[] = [
  { label: 'Google TTS', value: 'google' },
  { label: 'Edge TTS (fallback)', value: 'edge' },
];

/* ------------------------------------------------------------------ */
/*  Translation Panel Component                                        */
/* ------------------------------------------------------------------ */

export function TranslationPanel({
  meetingId,
  onTargetLangChange,
}: TranslationPanelProps) {
  const { settings, setSettings } = useTranslationSettings(meetingId);
  const { captions, latestCaption, error } = useTranslationCaptions(
    settings.enabled ? meetingId : null,
  );
  const [translateStatus, setTranslateStatus] = useState<'idle' | 'waiting' | 'translating' | 'done' | 'error'>('idle');
  const [translateLog, setTranslateLog] = useState('Chưa có transcript để dịch.');
  const [jobLogs, setJobLogs] = useState<TranslationJobLog[]>([]);
  const translatedTranscriptIdsRef = useRef(new Set<string>());
  // Audio control state (we handle playback via window events forwarded from use-deal-room)
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [playbackEnabled, setPlaybackEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Listen for audio ready events dispatched from the meeting page
  useEffect(() => {
    if (!settings.enabled || !playbackEnabled) return;

    const handleAudioReady = (event: CustomEvent) => {
      const data = event.detail;
      if (data.meetingId !== meetingId) return;

      setIsPlaying(true);
      try {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`);
        audio.volume = volume;
        audioRef.current = audio;
        audio.onended = () => setIsPlaying(false);
        audio.onerror = () => setIsPlaying(false);
        void audio.play().catch(() => setIsPlaying(false));
      } catch {
        setIsPlaying(false);
      }
    };

    window.addEventListener(
      'translation_audio_ready',
      handleAudioReady as EventListener,
    );
    return () => {
      window.removeEventListener(
        'translation_audio_ready',
        handleAudioReady as EventListener,
      );
    };
  }, [meetingId, settings.enabled, playbackEnabled, volume]);

  function handleToggle(enabled: boolean) {
    setSettings((prev) => ({ ...prev, enabled }));
    setTranslateStatus(enabled ? 'waiting' : 'idle');
    setTranslateLog(
      enabled
        ? 'Đang chờ transcript mới để gửi sang translation service...'
        : 'Translation đang tắt.',
    );
  }

  function handleTargetLangChange(lang: TranslationLang) {
    setSettings((prev) => ({ ...prev, targetLang: lang }));
    onTargetLangChange?.(lang);
    setTranslateLog(`Target language đã đổi sang ${lang || 'mặc định'}.`);
  }

  function handleTTSProviderChange(provider: TTSProvider) {
    setSettings((prev) => ({ ...prev, ttsProvider: provider }));
  }

  const lastCaption = captions.length > 0 ? captions[captions.length - 1] : null;

  const pushJobLog = useCallback((entry: TranslationJobLog) => {
    setJobLogs((prev) => {
      const next = [entry, ...prev.filter((item) => item.transcriptId !== entry.transcriptId)];
      return next.slice(0, 8);
    });
  }, []);

  useEffect(() => {
    if (!settings.enabled) return;

    const handleTranslationSource = async (event: Event) => {
      const payload = (event as CustomEvent).detail as {
        meetingId?: string;
        transcriptId?: string;
        speakerWallet?: string;
        text?: string;
        sourceLang?: TranslationLang;
      };

      if (
        payload.meetingId !== meetingId ||
        !payload.transcriptId ||
        !payload.text?.trim() ||
        translatedTranscriptIdsRef.current.has(payload.transcriptId)
      ) {
        if (
          payload.meetingId === meetingId &&
          payload.transcriptId &&
          translatedTranscriptIdsRef.current.has(payload.transcriptId)
        ) {
          pushJobLog({
            transcriptId: payload.transcriptId,
            text: payload.text?.trim() ?? '',
            status: 'skipped',
            message: 'Bỏ qua vì transcript này đã được gửi dịch trước đó.',
            timestamp: new Date().toISOString(),
          });
        }
        return;
      }

      translatedTranscriptIdsRef.current.add(payload.transcriptId);
      setTranslateStatus('translating');
      setTranslateLog(`Đang dịch transcript ${payload.transcriptId.slice(0, 8)}...`);
      pushJobLog({
        transcriptId: payload.transcriptId,
        text: payload.text.trim(),
        status: 'translating',
        message: 'Đã gửi sang translation service.',
        timestamp: new Date().toISOString(),
      });

      try {
        await apiFetch('/translation/speech-translate', {
          method: 'POST',
          body: {
            text: payload.text,
            source_lang: payload.sourceLang === 'en' ? 'en' : 'vi',
            target_lang: settings.targetLang || 'en',
            meetingId,
            transcriptId: payload.transcriptId,
            speakerWallet: payload.speakerWallet,
            tts: playbackEnabled,
          },
        });
        pushJobLog({
          transcriptId: payload.transcriptId,
          text: payload.text.trim(),
          status: 'queued',
          message: 'API đã nhận request, đang chờ kết quả translated transcript.',
          timestamp: new Date().toISOString(),
        });
      } catch (translateError) {
        translatedTranscriptIdsRef.current.delete(payload.transcriptId);
        setTranslateStatus('error');
        setTranslateLog(
          translateError instanceof Error
            ? `Dịch thất bại: ${translateError.message}`
            : 'Dịch thất bại.',
        );
        pushJobLog({
          transcriptId: payload.transcriptId,
          text: payload.text.trim(),
          status: 'error',
          message:
            translateError instanceof Error
              ? translateError.message
              : 'Không gọi được translation service.',
          timestamp: new Date().toISOString(),
        });
      }
    };

    window.addEventListener('translation_source_ready', handleTranslationSource as EventListener);
    return () => {
      window.removeEventListener('translation_source_ready', handleTranslationSource as EventListener);
    };
  }, [meetingId, playbackEnabled, pushJobLog, settings.enabled, settings.targetLang]);

  useEffect(() => {
    if (!settings.enabled || !lastCaption) return;
    setTranslateStatus('done');
    setTranslateLog(`Đã nhận bản dịch ${lastCaption.sourceLang ?? ''} -> ${lastCaption.targetLang ?? ''}.`);
    if (lastCaption.transcriptId) {
      pushJobLog({
        transcriptId: lastCaption.transcriptId,
        text: lastCaption.originalText ?? '',
        status: 'done',
        message: `Đã nhận bản dịch: ${lastCaption.translatedText}`,
        timestamp: lastCaption.timestamp,
      });
    }
  }, [lastCaption, pushJobLog, settings.enabled]);

  useEffect(() => {
    if (!settings.enabled || !error) return;
    setTranslateStatus('error');
    setTranslateLog(`Translation error: ${error.error}`);
    pushJobLog({
      transcriptId: error.transcriptId ?? `error-${error.timestamp}`,
      text: '',
      status: 'error',
      message: error.error,
      timestamp: error.timestamp,
    });
  }, [error, pushJobLog, settings.enabled]);

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-violet-700">
            🌐 Speech Translation
          </p>
          <Badge variant={settings.enabled ? 'success' : 'default'}>
            {settings.enabled ? 'ON' : 'OFF'}
          </Badge>
          {settings.enabled ? (
            <Badge
              variant={
                translateStatus === 'error'
                  ? 'danger'
                  : translateStatus === 'done'
                    ? 'success'
                    : translateStatus === 'translating'
                      ? 'info'
                      : 'default'
              }
            >
              {translateStatus}
            </Badge>
          ) : null}
          {error && <Badge variant="danger">error</Badge>}
        </div>
        <Button
          variant={settings.enabled ? 'outline' : 'primary'}
          onClick={() => handleToggle(!settings.enabled)}
        >
          {settings.enabled ? 'Tắt' : 'Bật'}
        </Button>
      </div>

      {/* Settings */}
      {settings.enabled && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[150px]">
            <label className="mb-1 block text-[11px] font-medium text-violet-600/80 uppercase tracking-wider">
              Target Language
            </label>
            <SimpleSelect
              value={settings.targetLang}
              onChange={handleTargetLangChange}
              options={TARGET_LANG_OPTIONS}
            />
          </div>
          <div className="min-w-[140px]">
            <label className="mb-1 block text-[11px] font-medium text-violet-600/80 uppercase tracking-wider">
              TTS Provider
            </label>
            <SimpleSelect
              value={settings.ttsProvider}
              onChange={handleTTSProviderChange}
              options={TTS_PROVIDER_OPTIONS}
            />
          </div>
          <div className="min-w-[120px]">
            <label className="mb-1 block text-[11px] font-medium text-violet-600/80 uppercase tracking-wider">
              Volume ({Math.round(volume * 100)}%)
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="mt-2 w-full accent-violet-600"
            />
          </div>
          <div className="flex items-center gap-2 pt-4">
            <label className="flex items-center gap-1.5 text-xs text-violet-600">
              <input
                type="checkbox"
                checked={playbackEnabled}
                onChange={(e) => setPlaybackEnabled(e.target.checked)}
                className="accent-violet-600"
              />
              Audio playback
            </label>
            {isPlaying && (
              <Badge variant="success">
                playing
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Latest Translation Caption */}
      {settings.enabled && lastCaption && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5">
          {lastCaption.originalText && (
            <p className="text-xs text-slate-500">
              <span className="font-medium">Original:</span>{' '}
              {lastCaption.originalText}
            </p>
          )}
          <p className="text-sm font-medium text-violet-800">
            {lastCaption.translatedText}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span>{lastCaption.sourceLang} → {lastCaption.targetLang}</span>
            {lastCaption.provider && <Badge variant="outline">{lastCaption.provider}</Badge>}
          </div>
        </div>
      )}

      {/* Error */}
      {settings.enabled && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          ⚠ Translation error: {error.error}
        </div>
      )}

      {settings.enabled && (
        <div className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs text-slate-600">
          {translateLog}
        </div>
      )}

      {settings.enabled && jobLogs.length > 0 ? (
        <div className="rounded-xl border border-violet-200 bg-white p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-violet-600/80">
            Translation logs
          </p>
          <div className="space-y-2">
            {jobLogs.map((item) => (
              <div key={`${item.transcriptId}-${item.timestamp}`} className="rounded-lg border border-slate-200 px-3 py-2">
                <div className="mb-1 flex items-center gap-2">
                  <Badge
                    variant={
                      item.status === 'done'
                        ? 'success'
                        : item.status === 'error'
                          ? 'danger'
                          : item.status === 'translating'
                            ? 'info'
                            : 'default'
                    }
                  >
                    {item.status}
                  </Badge>
                  <span className="text-[10px] text-slate-400">{item.transcriptId.slice(0, 8)}</span>
                </div>
                {item.text ? (
                  <p className="text-xs font-medium text-slate-700">{item.text}</p>
                ) : null}
                <p className="mt-1 text-xs text-slate-500">{item.message}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* No captions placeholder */}
      {settings.enabled && !lastCaption && !error && (
        <p className="text-xs text-violet-500/60 italic">
          Waiting for translated transcripts...
        </p>
      )}
    </div>
  );
}
