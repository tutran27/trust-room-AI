'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  FileText,
  AlertTriangle,
  DollarSign,
  Shield,
  Clock,
  CheckCircle2,
  Activity,
  Zap,
  Sparkles,
  Plus,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthGate } from '@/components/auth-gate';
import { useAuth } from '@/providers/auth-provider';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { RiskIndicator } from '@/components/ui/RiskIndicator';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDeals } from '@/hooks/use-api';

interface DashboardStats {
  totalDeals: number;
  activeDeals: number;
  totalVolume: number;
  activeDisputes: number;
  recentDeals: any[];
  riskAlerts: any[];
}

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { status: authStatus } = useAuth();
  const isAuth = authStatus === 'authenticated';

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const { data: dealsRes, isLoading: dealsLoading } = useDeals(undefined, isAuth);

  const deals = dealsRes?.data || [];
  const stats: DashboardStats = {
    totalDeals: deals.length,
    activeDeals: deals.filter((d: any) =>
      ['NEGOTIATING', 'ESCROW_FUNDED', 'IN_MEETING'].includes(d.status)
    ).length,
    totalVolume: deals.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0),
    activeDisputes: 0,
    recentDeals: deals.slice(0, 5),
    riskAlerts: [],
  };
  const loading = dealsLoading;

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <AuthGate>
    <AppLayout>
      <div className="space-y-8">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 p-8 text-white shadow-md">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-white/80" />
                <span className="text-sm font-medium text-white/80">
                  {getGreeting()}
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight mb-1">
                Welcome to TrustRoom
              </h1>
              <p className="text-sm text-white/70 max-w-md">
                Your AI-powered deal platform. Manage escrows and close deals with confidence.
              </p>
              <div className="flex items-center gap-3 mt-5">
                <Link href="/deals/new">
                  <Button
                    className="bg-sky-950/95 text-white shadow-lg shadow-sky-950/35 hover:bg-sky-900 hover:text-white focus:ring-cyan-200/30 focus:ring-offset-0"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    New Deal
                  </Button>
                </Link>
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-2 text-white/50 text-xs">
              <Clock className="w-3.5 h-3.5" />
              {currentTime.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <Skeleton variant="stat" count={4} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard
              label="Total Deals"
              value={stats?.totalDeals || 0}
              icon={FileText}
              iconBg="bg-brand-50"
              iconColor="text-brand-600"
              trend={{ value: '+12%', positive: true }}
            />
            <StatCard
              label="Active Deals"
              value={stats?.activeDeals || 0}
              icon={Activity}
              iconBg="bg-brand-50"
              iconColor="text-brand-600"
            />
            <StatCard
              label="Total Volume"
              value={`$${(stats?.totalVolume || 0).toLocaleString()}`}
              icon={TrendingUp}
              iconBg="bg-success-50"
              iconColor="text-success-600"
              trend={{ value: '+8%', positive: true }}
            />
            <StatCard
              label="Active Disputes"
              value={stats?.activeDisputes || 0}
              icon={AlertTriangle}
              iconBg={stats?.activeDisputes ? 'bg-danger-50' : 'bg-surface-100'}
              iconColor={stats?.activeDisputes ? 'text-danger-600' : 'text-surface-400'}
            />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Deals */}
          <div className="lg:col-span-2">
            <Card>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-brand-600" />
                  </div>
                  <h2 className="text-base font-semibold text-surface-900">Recent Deals</h2>
                </div>
                <Link href="/deals">
                  <Button variant="ghost" size="sm">
                    View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse flex items-center gap-4 p-3">
                      <div className="w-10 h-10 bg-surface-100 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-surface-100 rounded w-1/3" />
                        <div className="h-2.5 bg-surface-100 rounded w-1/2" />
                      </div>
                      <div className="h-5 bg-surface-100 rounded-full w-16" />
                    </div>
                  ))}
                </div>
              ) : stats?.recentDeals?.length ? (
                <div className="space-y-1">
                  {stats.recentDeals.map((deal: any) => (
                    <Link
                      key={deal.id}
                      href={`/deals/${deal.id}`}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-50 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-100 transition-colors">
                        <FileText className="w-4.5 h-4.5 text-brand-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-900 truncate group-hover:text-brand-600 transition-colors">
                          {deal.title}
                        </p>
                        <p className="text-xs text-surface-500 mt-0.5">
                          {deal.amount ? `${Number(deal.amount).toLocaleString()} SOL` : '0 SOL'} · {deal.buyerWallet?.slice(0, 8) || 'Buyer'}
                        </p>
                      </div>
                      <StatusBadge type="deal" status={deal.status} />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-6 h-6 text-surface-400" />
                  </div>
                  <p className="text-sm font-medium text-surface-600">No deals yet</p>
                  <p className="text-xs text-surface-400 mt-1 mb-4">Create your first deal to get started</p>
                  <Link href="/deals/new">
                    <Button size="sm">
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Create Deal
                    </Button>
                  </Link>
                </div>
              )}
            </Card>
          </div>

          {/* Risk Alerts */}
          <div>
            <Card>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-warning-50 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-warning-600" />
                  </div>
                  <h2 className="text-base font-semibold text-surface-900">Risk Alerts</h2>
                </div>
                <Link href="/disputes">
                  <Button variant="ghost" size="sm">
                    View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="animate-pulse p-3 rounded-xl bg-surface-100">
                      <div className="h-3 bg-surface-100 rounded w-2/3 mb-2" />
                      <div className="h-2.5 bg-surface-100 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : stats?.riskAlerts?.length ? (
                <div className="space-y-3">
                  {stats.riskAlerts.map((alert: any) => (
                    <Link
                      key={alert.id}
                      href={`/disputes/${alert.id}`}
                      className="block p-3.5 rounded-xl bg-surface-50 hover:bg-surface-100 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-surface-900 truncate">
                            {alert.title || 'Dispute'}
                          </p>
                          <p className="text-xs text-surface-500 mt-1 line-clamp-2">
                            {alert.reason || alert.description}
                          </p>
                        </div>
                        <AlertTriangle className="w-4 h-4 text-warning-500 flex-shrink-0 mt-0.5" />
                      </div>
                      <div className="mt-2.5">
                        <RiskIndicator
                          level={alert.riskLevel || 'medium'}
                          size="sm"
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="w-14 h-14 rounded-2xl bg-success-50 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-6 h-6 text-success-600" />
                  </div>
                  <p className="text-sm font-medium text-surface-700">All clear!</p>
                  <p className="text-xs text-surface-500 mt-1">No active risk alerts</p>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Bottom */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <Card>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                <Zap className="w-5 h-5 text-brand-600" />
              </div>
              <h2 className="text-base font-semibold text-surface-900">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link href="/deals/new">
                <div className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-surface-200 hover:border-brand-300 hover:bg-brand-50/30 transition-all cursor-pointer group text-center">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center group-hover:bg-brand-100 group-hover:scale-105 transition-all">
                    <FileText className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-900">New Deal</p>
                    <p className="text-xs text-surface-500 mt-0.5">Create a deal</p>
                  </div>
                </div>
              </Link>
              <Link href="/disputes">
                <div className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-surface-200 hover:border-warning-300 hover:bg-warning-50/30 transition-all cursor-pointer group text-center">
                  <div className="w-10 h-10 rounded-xl bg-warning-50 flex items-center justify-center group-hover:bg-warning-100 group-hover:scale-105 transition-all">
                    <AlertTriangle className="w-5 h-5 text-warning-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-900">Dispute</p>
                    <p className="text-xs text-surface-500 mt-0.5">Resolve issues</p>
                  </div>
                </div>
              </Link>
            </div>
          </Card>

          {/* Platform Status */}
          <Card>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-success-50 flex items-center justify-center">
                <Activity className="w-5 h-5 text-success-600" />
              </div>
              <h2 className="text-base font-semibold text-surface-900">Platform Status</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-50">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-success-500" />
                  <span className="text-sm text-surface-700">Solana Network</span>
                </div>
                <span className="text-xs font-medium text-success-700 bg-success-50 px-2.5 py-0.5 rounded-full">Operational</span>
              </div>
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-50">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-success-500" />
                  <span className="text-sm text-surface-700">AI Services</span>
                </div>
                <span className="text-xs font-medium text-success-700 bg-success-50 px-2.5 py-0.5 rounded-full">Operational</span>
              </div>
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-50">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-success-500" />
                  <span className="text-sm text-surface-700">Escrow Contracts</span>
                </div>
                <span className="text-xs font-medium text-success-700 bg-success-50 px-2.5 py-0.5 rounded-full">Operational</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
        </AppLayout>
      </AuthGate>
    );
}
