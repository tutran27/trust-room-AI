'use client';

import { Modal, Button } from '@trustroom/ui';
import type { RiskEventLive } from '../lib/api-types';

/**
 * AI Guardian intervention modal. Shown when a high/critical risk event fires.
 * Deliberately NOT a full-screen lock: the dismiss action ("Tôi hiểu, vẫn tiếp tục")
 * is always visible so a false-positive can never trap the user mid-demo. Dangerous
 * action buttons (Release/Refund/Fund) are gated by the caller via `riskLocked`
 * until the user acknowledges here.
 */
export function GuardianModal({
  event,
  open,
  onAcknowledge,
  onLogEvidence,
  evidenceLogged = false,
}: {
  event: RiskEventLive | null;
  open: boolean;
  onAcknowledge: () => void;
  onLogEvidence: () => void;
  evidenceLogged?: boolean;
}) {
  if (!event) return null;

  return (
    <Modal open={open} onClose={onAcknowledge} className="max-w-md border-red-500/60">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 text-2xl">
            ⚠️
          </span>
          <div>
            <h2 className="text-lg font-bold text-red-300">AI Guardian: Cảnh báo lừa đảo</h2>
            <p className="text-xs uppercase tracking-wide text-red-400/80">
              Mức {event.level} · điểm rủi ro {event.score}/100
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm text-slate-100">{event.reasons.join(' • ')}</p>
          {event.intents?.length ? (
            <p className="mt-2 text-xs text-red-300/90">
              Ý đồ phát hiện: {event.intents.join(', ')}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-slate-400">Câu kích hoạt: “{event.triggerText}”</p>
        </div>

        <p className="text-sm text-slate-300">
          Các nút Release / Refund / Fund đã bị tạm khóa để bảo vệ bạn. Chỉ tiếp tục nếu bạn chắc
          chắn giao dịch này an toàn.
        </p>

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={onLogEvidence} disabled={evidenceLogged}>
            {evidenceLogged ? '✓ Đã ghi Evidence Vault' : 'Ghi vào Evidence Vault'}
          </Button>
          <Button onClick={onAcknowledge}>Tôi hiểu, vẫn tiếp tục</Button>
        </div>
      </div>
    </Modal>
  );
}
