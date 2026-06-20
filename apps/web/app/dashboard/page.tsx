'use client';

import Link from 'next/link';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Skeleton, Stat } from '@trustroom/ui';
import { AppShell } from '../../components/app-shell';
import { AuthGate } from '../../components/auth-gate';
import { DealCard } from '../../components/deal-card';
import { NotificationPanel } from '../../components/notification-panel';
import { useDeals, useLeaderboard, useReputation } from '../../hooks/use-api';
import { useAuth } from '../../providers/auth-provider';
import { formatAmount } from '../../lib/format';
import { shortAddress } from '../../lib/wallet';

export default function DashboardPage() {
  const { address } = useAuth();
  const deals = useDeals();
  const reputation = useReputation(address);
  const leaderboard = useLeaderboard();

  return (
    <AuthGate>
      <AppShell
        title="Dashboard"
        subtitle="Theo dõi deal đang chạy, trạng thái uy tín và các cảnh báo mới nhất trong phiên demo."
        actions={
          <Link href="/deals/new">
            <Button>Tạo deal mới</Button>
          </Link>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <Stat
                    label="Tổng deal"
                    value={deals.data?.data.length ?? 0}
                    hint="Theo ví hiện tại"
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <Stat
                    label="Score uy tín"
                    value={reputation.data ? Math.round(reputation.data.score * 100) : '—'}
                    hint={reputation.data ? `${reputation.data.successfulDeals} deal thành công` : 'Đang tải'}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <Stat
                    label="Khối lượng"
                    value={reputation.data ? formatAmount(reputation.data.totalVolume) : '—'}
                    hint="Tổng volume tích lũy"
                  />
                </CardContent>
              </Card>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Deals của bạn</h2>
                <Link href="/deals/new">
                  <Button variant="ghost">+ Deal mới</Button>
                </Link>
              </div>

              {deals.isLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Skeleton className="h-64 rounded-3xl" />
                  <Skeleton className="h-64 rounded-3xl" />
                </div>
              ) : deals.isError ? (
                <Alert variant="danger" title="Không tải được danh sách deal">
                  {deals.error instanceof Error ? deals.error.message : 'Lỗi không xác định.'}
                </Alert>
              ) : deals.data && deals.data.data.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {deals.data.data.map((deal) => (
                    <DealCard key={deal.id} deal={deal} />
                  ))}
                </div>
              ) : (
                <Alert title="Chưa có deal nào">
                  Hãy tạo deal đầu tiên để bắt đầu flow escrow, realtime chat và dispute demo.
                </Alert>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <NotificationPanel />

            <Card>
              <CardHeader>
                <CardTitle>Leaderboard demo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {leaderboard.isLoading ? (
                  <>
                    <Skeleton className="h-12 rounded-xl" />
                    <Skeleton className="h-12 rounded-xl" />
                  </>
                ) : leaderboard.data && leaderboard.data.length > 0 ? (
                  leaderboard.data.map((item, index) => (
                    <div
                      key={item.wallet}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                    >
                      <div>
                        <p className="text-sm text-slate-400">#{index + 1}</p>
                        <p className="font-medium text-slate-100">{shortAddress(item.wallet, 6, 6)}</p>
                      </div>
                      <p className="text-lg font-semibold text-emerald-300">
                        {Math.round(item.score * 100)}
                      </p>
                    </div>
                  ))
                ) : (
                  <Alert title="Chưa có dữ liệu">Seed sẽ bổ sung bảng xếp hạng demo.</Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </AppShell>
    </AuthGate>
  );
}
