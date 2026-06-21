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

const QUICK_ACTIONS = [
  {
    label: 'Tạo deal mới',
    href: '/deals/new',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
  {
    label: 'Xem disputes',
    href: '/disputes',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
    ),
  },
];

export default function DashboardPage() {
  const { address, status } = useAuth();
  const isAuthed = status === 'authenticated';
  const deals = useDeals(undefined, isAuthed);
  const reputation = useReputation(address);
  const leaderboard = useLeaderboard();

  const dealCount = deals.data?.data.length ?? 0;
  const score = reputation.data ? Math.round(reputation.data.score * 100) : null;
  const volume = reputation.data ? formatAmount(reputation.data.totalVolume) : null;

  return (
    <AuthGate>
      <AppShell title="Dashboard">
        <div className="space-y-8">
          {/* Welcome + Stats Row */}
          <section>
            <div className="mb-6">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                Tổng quan
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <Stat
                      label="Tổng deal"
                      value={dealCount}
                      hint="Theo ví hiện tại"
                    />
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <Stat
                      label="Score uy tín"
                      value={score !== null ? score : '—'}
                      hint={reputation.data ? `${reputation.data.successfulDeals} deal thành công` : 'Đang tải'}
                    />
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-500/40 to-transparent" />
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <Stat
                      label="Khối lượng"
                      value={volume ?? '—'}
                      hint="Tổng volume tích lũy"
                    />
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Quick Actions */}
          <section>
            <div className="flex gap-3">
              {QUICK_ACTIONS.map((action) => (
                <Link key={action.href} href={action.href}>
                  <div className="group flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm font-medium text-zinc-300 transition-all duration-150 hover:bg-white/[0.05] hover:border-white/[0.1] hover:text-zinc-100">
                    <span className="text-zinc-500 transition-colors group-hover:text-emerald-400">
                      {action.icon}
                    </span>
                    {action.label}
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Main Content */}
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-6">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold tracking-tight text-zinc-100">Deals của bạn</h2>
                  <Link href="/deals/new">
                    <Button variant="ghost" className="text-zinc-400 text-xs">
                      Xem tất cả →
                    </Button>
                  </Link>
                </div>

                {deals.isLoading ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-52" />
                    <Skeleton className="h-52" />
                  </div>
                ) : deals.isError ? (
                  <Alert variant="danger" title="Không tải được danh sách deal">
                    {deals.error instanceof Error ? deals.error.message : 'Lỗi không xác định.'}
                  </Alert>
                ) : deals.data && deals.data.data.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {deals.data.data.slice(0, 6).map((deal) => (
                      <DealCard key={deal.id} deal={deal} />
                    ))}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-zinc-200">Chưa có deal nào</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Tạo deal đầu tiên để bắt đầu escrow, realtime chat và dispute demo.
                      </p>
                      <Link href="/deals/new" className="mt-4">
                        <Button>Tạo deal mới</Button>
                      </Link>
                    </CardContent>
                  </Card>
                )}
              </section>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              <NotificationPanel />

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-amber-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0 1 16.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 0 1-3.52 1.108m3.52-1.108a6.003 6.003 0 0 0 3.52-1.108" />
                      </svg>
                    </span>
                    Leaderboard
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {leaderboard.isLoading ? (
                    <>
                      <Skeleton className="h-11 rounded-xl" />
                      <Skeleton className="h-11 rounded-xl" />
                      <Skeleton className="h-11 rounded-xl" />
                    </>
                  ) : leaderboard.data && leaderboard.data.length > 0 ? (
                    leaderboard.data.map((item, index) => (
                      <div
                        key={item.wallet}
                        className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-colors hover:bg-white/[0.04]"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold ${
                            index === 0 ? 'bg-amber-500/15 text-amber-400' :
                            index === 1 ? 'bg-zinc-300/10 text-zinc-300' :
                            index === 2 ? 'bg-amber-700/15 text-amber-600' :
                            'bg-white/[0.04] text-zinc-500'
                          }`}>
                            {index + 1}
                          </span>
                          <span className="font-mono text-xs text-zinc-300">{shortAddress(item.wallet, 6, 6)}</span>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-emerald-400">
                          {Math.round(item.score * 100)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-4 text-center">
                      <p className="text-sm text-zinc-500">Chưa có dữ liệu leaderboard.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AppShell>
    </AuthGate>
  );
}
