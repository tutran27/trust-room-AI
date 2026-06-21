'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@trustroom/ui';
import type { RiskEventLive } from '../lib/api-types';
import { formatRelativeTime } from '../lib/format';
import { shortAddress } from '../lib/wallet';

const LEVEL_COLOR: Record<RiskEventLive['level'], string> = {
  low: '#16c79a',
  medium: '#e0a325',
  high: '#e8743b',
  critical: '#d6453d',
};

const LEVEL_LABEL: Record<RiskEventLive['level'], string> = {
  low: 'An toàn',
  medium: 'Cảnh giác',
  high: 'Nguy hiểm',
  critical: 'Nghiêm trọng',
};

/** 0–100 → arc color, threshold 24/49/79 (per technical brief §5.7). */
function scoreColor(score: number): string {
  if (score >= 80) return LEVEL_COLOR.critical;
  if (score >= 50) return LEVEL_COLOR.high;
  if (score >= 25) return LEVEL_COLOR.medium;
  return LEVEL_COLOR.low;
}

function Gauge({ score, level }: { score: number; level: RiskEventLive['level'] }) {
  const radius = 52;
  const circumference = Math.PI * radius; // semicircle
  const clamped = Math.max(0, Math.min(100, score));
  const dash = (clamped / 100) * circumference;
  const color = scoreColor(clamped);

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="84" viewBox="0 0 140 84" role="img" aria-label={`Risk score ${clamped}`}>
        <path
          d="M 14 76 A 56 56 0 0 1 126 76"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 14 76 A 56 56 0 0 1 126 76"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: 'stroke-dasharray 500ms ease, stroke 300ms ease' }}
        />
        <text x="70" y="64" textAnchor="middle" fontSize="30" fontWeight="700" fill={color}>
          {clamped}
        </text>
      </svg>
      <span
        className="mt-1 rounded-full px-3 py-0.5 text-xs font-semibold"
        style={{ background: `${color}22`, color }}
      >
        {LEVEL_LABEL[level]} · {level.toUpperCase()}
      </span>
    </div>
  );
}

function BreakdownBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span className="tabular-nums text-slate-300">+{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: scoreColor(pct), transition: 'width 400ms ease' }}
        />
      </div>
    </div>
  );
}

/**
 * Live Risk Dashboard. Renders the most recent risk assessment as a gauge plus a
 * breakdown of the components that actually carry data (conversation risk +
 * repetition penalty). Wallet/escrow/evidence components are intentionally hidden
 * because the realtime gateway only populates those two today — showing always-zero
 * bars would misrepresent the engine.
 */
export function RiskDashboard({ events }: { events: RiskEventLive[] }) {
  const latest = events[0] ?? null;

  // De-duplicate the intent timeline across events, newest first, keeping trigger text.
  const intentTimeline = useMemo(() => {
    const seen = new Set<string>();
    const rows: { intent: string; trigger: string; level: RiskEventLive['level']; ts: string }[] = [];
    for (const ev of events) {
      for (const intent of ev.intents ?? []) {
        const key = `${intent}:${ev.triggerText}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ intent, trigger: ev.triggerText, level: ev.level, ts: ev.timestamp });
      }
    }
    return rows.slice(0, 8);
  }, [events]);

  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardHeader>
        <CardTitle>AI Risk Monitor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {latest ? (
          <>
            <Gauge score={latest.score} level={latest.level} />

            <div className="space-y-2">
              <BreakdownBar label="Rủi ro hội thoại" value={latest.components?.conversationRisk ?? latest.score} />
              {(latest.components?.repetitionPenalty ?? 0) > 0 ? (
                <BreakdownBar label="Phạt lặp lại chiêu trò" value={latest.components!.repetitionPenalty} />
              ) : null}
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Lý do mới nhất
              </p>
              <p className="text-sm text-slate-200">{latest.reasons.join(' • ')}</p>
              <p className="mt-1 text-xs text-slate-500">
                Trigger: “{latest.triggerText}” · {shortAddress(latest.speaker, 4, 4)}
              </p>
            </div>

            {intentTimeline.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Dòng thời gian ý đồ phát hiện
                </p>
                <ul className="space-y-2">
                  {intentTimeline.map((row, i) => (
                    <li
                      key={`${row.intent}-${i}`}
                      className="flex items-start gap-2 rounded-lg border border-white/10 bg-slate-950/40 p-2"
                    >
                      <span
                        className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                        style={{ background: LEVEL_COLOR[row.level] }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-100">{row.intent}</p>
                        <p className="truncate text-xs text-slate-400">“{row.trigger}”</p>
                      </div>
                      <span className="ml-auto shrink-0 text-[10px] text-slate-500">
                        {formatRelativeTime(row.ts)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Gauge score={0} level="low" />
            <p className="text-sm text-slate-400">
              Realtime Scam Guard đang theo dõi. Gửi/nói nội dung đàm phán để bắt đầu chấm rủi ro.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
