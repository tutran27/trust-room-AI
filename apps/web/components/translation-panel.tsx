'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const translatedTranscriptTextRef = useRef(new Map<string, string>());
  const translatedScript = useMemo(
    () =>
      captions
        .slice()
        .sort(
          (left, right) =>
            new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
        ),
    [captions],
  );
  
  // Audio control state via hook
  const { enqueueAudio, isPlaying, volume, setVolume, enabled: playbackEnabled, setEnabled: setPlaybackEnabled } = useTranslationAudioPlayback();

  // Listen for audio ready events dispatched from the meeting page
  useEffect(() => {
    if (!settings.enabled || !playbackEnabled) return;

    const handleAudioReady = (event: CustomEvent) => {
      const data = event.detail;
      if (data.meetingId !== meetingId || !data.audio_base64) return;

      enqueueAudio({
        audioBase64: data.audio_base64,
        translatedText: data.translatedText || '',
        provider: data.provider,
        timestamp: data.timestamp || new Date().toISOString(),
      });
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
  }, [meetingId, settings.enabled, playbackEnabled, enqueueAudio]);

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

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTranslateTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!settings.enabled) return;

    const handleTranslationSource = (event: Event) => {
      const payload = (event as CustomEvent).detail as {
        meetingId?: string;
        transcriptId?: string;
        speakerWallet?: string;
        text?: string;
        sourceLang?: TranslationLang;
        isFinal?: boolean;
      };

      if (
        payload.meetingId !== meetingId ||
        !payload.transcriptId ||
        !payload.text?.trim()
      ) {
        return;
      }

      const transcriptId = payload.transcriptId;
      const text = payload.text.trim();
      const lastTranslatedText = translatedTranscriptTextRef.current.get(transcriptId);
      if (lastTranslatedText === text) {
        return;
      }

      translatedTranscriptTextRef.current.set(transcriptId, text);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      const doTranslate = async () => {
        lastTranslateTimeRef.current = Date.now();
        setTranslateStatus('translating');
        setTranslateLog(`Đang dịch transcript ${transcriptId.slice(0, 8)}...`);
        pushJobLog({
          transcriptId,
          text,
          status: 'translating',
          message: 'Đã gửi sang translation service.',
          timestamp: new Date().toISOString(),
        });

        try {
          await apiFetch('/translation/speech-translate', {
            method: 'POST',
            body: {
              text,
              source_lang: payload.sourceLang === 'en' ? 'en' : 'vi',
              target_lang: settings.targetLang || 'en',
              meetingId,
              transcriptId,
              speakerWallet: payload.speakerWallet,
              tts: playbackEnabled && (payload.isFinal !== false),
            },
          });
          pushJobLog({
            transcriptId,
            text,
            status: 'queued',
            message: 'API đã nhận request, đang chờ kết quả translated transcript.',
            timestamp: new Date().toISOString(),
          });
        } catch (translateError) {
          translatedTranscriptTextRef.current.delete(transcriptId);
          setTranslateStatus('error');
          setTranslateLog(
            translateError instanceof Error
              ? `Dịch thất bại: ${translateError.message}`
              : 'Dịch thất bại.',
          );
          pushJobLog({
            transcriptId,
            text,
            status: 'error',
            message:
              translateError instanceof Error
                ? translateError.message
                : 'Không gọi được translation service.',
            timestamp: new Date().toISOString(),
          });
        }
      };

      const timeSinceLast = Date.now() - lastTranslateTimeRef.current;
      if (timeSinceLast >= 1500) {
        // Force translation if user has been speaking continuously for 1.5s
        void doTranslate();
      } else {
        // Otherwise wait for a short pause
        debounceTimerRef.current = setTimeout(doTranslate, 600);
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

      {settings.enabled ? (
        <div className="rounded-xl border border-violet-200 bg-white p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-600/80">
              Realtime translated script
            </p>
            <Badge variant={translatedScript.length ? 'info' : 'default'}>
              {translatedScript.length} lines
            </Badge>
          </div>

          {translatedScript.length ? (
            <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
              {translatedScript.map((caption) => (
                <div
                  key={`${caption.transcriptId ?? caption.timestamp}-${caption.timestamp}`}
                  className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                    {caption.speakerWallet ? <Badge variant="default">{caption.speakerWallet}</Badge> : null}
                    <span>
                      {caption.sourceLang ?? '?'} → {caption.targetLang ?? '?'}
                    </span>
                    {caption.provider ? <Badge variant="outline">{caption.provider}</Badge> : null}
                  </div>
                  <p className="text-sm leading-relaxed text-slate-800">
                    {caption.translatedText}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-violet-500/60 italic">
              Chưa có bản dịch realtime.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
