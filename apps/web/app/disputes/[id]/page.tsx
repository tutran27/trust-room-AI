'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Textarea } from '@trustroom/ui';
import { AppShell } from '../../../components/app-shell';
import { AuthGate } from '../../../components/auth-gate';
import { StatusBadge } from '../../../components/status-badge';
import { useAddEvidence, useDispute, useResolveDispute } from '../../../hooks/use-api';
import { formatDateTime } from '../../../lib/format';
import { shortAddress } from '../../../lib/wallet';

export default function DisputeDetailPage() {
  const params = useParams<{ id: string }>();
  const disputeId = params?.id ?? null;
  const dispute = useDispute(disputeId);
  const resolveDispute = useResolveDispute(disputeId ?? '');
  const addEvidence = useAddEvidence(disputeId ?? '');
  const [resolution, setResolution] = useState<'ReleaseToSeller' | 'RefundToBuyer' | 'SplitPayment'>('RefundToBuyer');
  const [evidenceText, setEvidenceText] = useState('Bổ sung transcript hoặc mô tả screenshot.');

  return (
    <AuthGate>
      <AppShell
        title={dispute.data?.reason ?? 'Dispute detail'}
        subtitle="Workspace xem evidence, trạng thái xử lý và chạy resolution flow demo."
        actions={
          <>
            <Link href="/disputes">
              <Button variant="ghost">Danh sách disputes</Button>
            </Link>
            {dispute.data?.dealId ? (
              <Link href={`/deals/${dispute.data.dealId}`}>
                <Button variant="secondary">Mở deal room</Button>
              </Link>
            ) : null}
          </>
        }
      >
        {dispute.isError || !dispute.data ? (
          <Alert variant="danger" title="Không tải được dispute">
            {dispute.error instanceof Error ? dispute.error.message : 'Dispute không tồn tại.'}
          </Alert>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Chi tiết tranh chấp</CardTitle>
                  <StatusBadge value={dispute.data.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-zinc-400">{dispute.data.aiSummary ?? 'Chưa có AI summary riêng.'}</p>
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Raised by</p>
                    <p className="mt-1 font-mono text-zinc-300">{shortAddress(dispute.data.raisedBy, 5, 5)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Deal ID</p>
                    <p className="mt-1 font-mono text-zinc-300">{dispute.data.dealId}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Created</p>
                    <p className="mt-1 text-zinc-300">{formatDateTime(dispute.data.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Resolved</p>
                    <p className="mt-1 text-zinc-300">{formatDateTime(dispute.data.resolvedAt)}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-zinc-100">Evidence</h3>
                  {dispute.data.evidence?.length ? (
                    dispute.data.evidence.map((evidence) => (
                      <div key={evidence.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-zinc-100">{evidence.type}</p>
                          <p className="text-[11px] text-zinc-500">{formatDateTime(evidence.createdAt)}</p>
                        </div>
                        <p className="mt-2 text-sm text-zinc-400">{evidence.content}</p>
                        {evidence.url ? (
                          <a className="mt-2 inline-block text-xs text-emerald-400 hover:underline" href={evidence.url} target="_blank" rel="noreferrer">
                            {evidence.url}
                          </a>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <Alert title="Chưa có evidence">Bạn có thể thêm evidence text ngay bên phải.</Alert>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Thêm evidence</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    rows={5}
                    value={evidenceText}
                    onChange={(event) => setEvidenceText(event.target.value)}
                    placeholder="Dán transcript, mô tả proof, hoặc note điều tra…"
                  />
                  <Button
                    onClick={() => addEvidence.mutate({ type: 'text', content: evidenceText })}
                    disabled={addEvidence.isPending || !evidenceText.trim()}
                  >
                    Thêm evidence
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Resolution demo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input value={resolution} onChange={(event) => setResolution(event.target.value as typeof resolution)} />
                  <Button onClick={() => resolveDispute.mutate({ resolution })} disabled={resolveDispute.isPending}>
                    Resolve dispute
                  </Button>
                  {(resolveDispute.error || addEvidence.error) ? (
                    <Alert variant="danger" title="Action failed">
                      {(resolveDispute.error instanceof Error && resolveDispute.error.message) ||
                        (addEvidence.error instanceof Error && addEvidence.error.message) ||
                        'Lỗi không xác định.'}
                    </Alert>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </AppShell>
    </AuthGate>
  );
}
