'use client';

import Link from 'next/link';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@trustroom/ui';
import { AppShell } from '../../components/app-shell';
import { AuthGate } from '../../components/auth-gate';
import { StatusBadge } from '../../components/status-badge';
import { useDisputes } from '../../hooks/use-api';
import { formatDateTime } from '../../lib/format';
import { shortAddress } from '../../lib/wallet';

export default function DisputesPage() {
  const disputes = useDisputes();

  return (
    <AuthGate>
      <AppShell
        title="Disputes"
        subtitle="Tổng hợp tất cả tranh chấp mà ví hiện tại có liên quan, cùng link vào workspace chi tiết."
        actions={
          <Link href="/dashboard">
            <Button variant="ghost">Dashboard</Button>
          </Link>
        }
      >
        {disputes.isLoading ? (
          <div className="grid gap-4">
            <Skeleton className="h-28 rounded-3xl" />
            <Skeleton className="h-28 rounded-3xl" />
          </div>
        ) : disputes.isError ? (
          <Alert variant="danger" title="Không tải được disputes">
            {disputes.error instanceof Error ? disputes.error.message : 'Lỗi không xác định.'}
          </Alert>
        ) : disputes.data && disputes.data.length > 0 ? (
          <div className="grid gap-4">
            {disputes.data.map((dispute) => (
              <Link key={dispute.id} href={`/disputes/${dispute.id}`}>
                <Card className="transition hover:border-emerald-400/40 hover:bg-white/[0.04]">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle>{dispute.reason}</CardTitle>
                      <StatusBadge value={dispute.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm text-slate-300 md:grid-cols-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Deal</p>
                      <p className="mt-1 font-medium text-slate-100">{dispute.deal?.title ?? dispute.dealId}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Raised by</p>
                      <p className="mt-1">{shortAddress(dispute.raisedBy, 5, 5)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Evidence</p>
                      <p className="mt-1">{dispute.evidence?.length ?? 0} item(s)</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Created</p>
                      <p className="mt-1">{formatDateTime(dispute.createdAt)}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Alert title="Chưa có dispute nào">Bạn có thể mở dispute trực tiếp từ deal room.</Alert>
        )}
      </AppShell>
    </AuthGate>
  );
}
