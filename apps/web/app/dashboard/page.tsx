'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  ArrowRight,
  FileText,
  AlertTriangle,
  DollarSign,
  Shield,
  Clock,
  CheckCircle2,
  Users,
  Activity,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Plus,
  Video,
  RefreshCw,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { RiskIndicator } from '@/components/ui/RiskIndicator';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiFetch } from '@/lib/api';

interface DashboardStats {
  totalDeals: number;
  activeDeals: number;
  totalVolume: number;
  activeDisputes: number;
  recentDeals: any[];
  riskAlerts: any[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function fetchDashboard() {
      try {
      const [dealsRes, disputesRes] = await Promise.all([
          apiFetch<{ deals: any[]; total: number }>('/deals?limit=5'),
          apiFetch<{ disputes: any[] }>('/disputes?status=OPEN&limit=3'),
        ]);

        const deals = dealsRes?.deals || [];
        const disputes = disputesRes?.disputes || [];

        setStats({
          totalDeals: dealsRes?.total || deals.length,
          activeDeals: deals.filter((d: any) =>
            ['NEGOTIATING', 'ESCROW_FUNDED', 'IN_MEETING'].includes(d.status)
          ).length,
          totalVolume: deals.reduce((sum: number, d: any) => sum + (d.amount || 0), 0),
          activeDisputes: disputes.length,
          recentDeals: deals.slice(0, 5),
          riskAlerts: disputes.slice(0, 3),
        });
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-500 to-accent-500 p-8 text-white">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-white/5 rounded-full" />

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
                Your AI-powered deal platform. Manage escrows, conduct secure meetings, and close deals with confidence.
              </p>
              <div className="flex items-center gap-3 mt-5">
                <Link href="/deals">
                  <Button className="bg-white text-primary-600 hover:bg-white/90 border-0 shadow-lg shadow-primary-700/20">
                    <Plus className="w-4 h-4 mr-1.5" />
                    New Deal
                  </Button>
                </Link>
                <Link href="/meetings/demo">
                  <Button variant="ghost" className="text-white border border-white/20 hover:bg-white/10">
                    <Video className="w-4 h-4 mr-1.5" />
                    Start Meeting
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
              iconBg="bg-primary-500/10"
              iconColor="text-primary-400"
              trend={{ value: '+12%', positive: true }}
            />
            <StatCard
              label="Active Deals"
              value={stats?.activeDeals || 0}
              icon={Activity}
              iconBg="bg-accent-500/10"
              iconColor="text-accent-400"
            />
            <StatCard
              label="Total Volume"
              value={`$${(stats?.totalVolume || 0).toLocaleString()}`}
              icon={DollarSign}
              iconBg="bg-success-500/10"
              iconColor="text-success-400"
              trend={{ value: '+8%', positive: true }}
            />
            <StatCard
              label="Active Disputes"
              value={stats?.activeDisputes || 0}
              icon={AlertTriangle}
              iconBg={stats?.activeDisputes ? 'bg-danger-500/10' : 'bg-surface-200'}
              iconColor={stats?.activeDisputes ? 'text-danger-400' : 'text-surface-500'}
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
                  <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-primary-400" />
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
                      <div className="w-10 h-10 bg-surface-200 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-surface-200 rounded w-1/3" />
                        <div className="h-2.5 bg-surface-200 rounded w-1/2" />
                      </div>
                      <div className="h-5 bg-surface-200 rounded-full w-16" />
                    </div>
                  ))}
                </div>
              ) : stats?.recentDeals?.length ? (
                <div className="space-y-1">
                  {stats.recentDeals.map((deal: any, index: number) => (
                    <Link
                      key={deal.id}
                      href={`/deals/${deal.id}`}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-100 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-500/20 transition-colors">
                        <FileText className="w-4.5 h-4.5 text-primary-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-900 truncate group-hover:text-primary-400 transition-colors">
                          {deal.title}
                        </p>
                        <p className="text-xs text-surface-600 mt-0.5">
                          ${deal.amount?.toLocaleString() || '0'} · {deal.buyer?.name || 'Buyer'}
                        </p>
                      </div>
                      <StatusBadge type="deal" status={deal.status} />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-14 h-14 rounded-2xl bg-surface-200 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-6 h-6 text-surface-500" />
                  </div>
                  <p className="text-sm font-medium text-surface-600">No deals yet</p>
                  <p className="text-xs text-surface-500 mt-1 mb-4">Create your first deal to get started</p>
                  <Link href="/deals">
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
                  <div className="w-8 h-8 rounded-lg bg-warning-500/10 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-warning-400" />
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
                      <div className="h-3 bg-surface-200 rounded w-2/3 mb-2" />
                      <div className="h-2.5 bg-surface-200 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : stats?.riskAlerts?.length ? (
                <div className="space-y-3">
                  {stats.riskAlerts.map((alert: any) => (
                    <Link
                      key={alert.id}
                      href={`/disputes/${alert.id}`}
                      className="block p-3.5 rounded-xl bg-surface-100 hover:bg-surface-200 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-surface-900 truncate">
                            {alert.title || 'Dispute'}
                          </p>
                          <p className="text-xs text-surface-600 mt-1 line-clamp-2">
                            {alert.reason || alert.description}
                          </p>
                        </div>
                        <AlertTriangle className="w-4 h-4 text-warning-400 flex-shrink-0 mt-0.5" />
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
                  <div className="w-14 h-14 rounded-2xl bg-success-500/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-6 h-6 text-success-400" />
                  </div>
                  <p className="text-sm font-medium text-surface-600">All clear!</p>
                  <p className="text-xs text-surface-500 mt-1">No active risk alerts</p>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Quick Actions & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <Card>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-accent-500/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-accent-400" />
              </div>
              <h2 className="text-base font-semibold text-surface-900">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link href="/deals">
                <div className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-surface-200 hover:border-primary-400 hover:bg-primary-500/5 transition-all cursor-pointer group text-center">
                  <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center group-hover:bg-primary-500/20 group-hover:scale-105 transition-all">
                    <FileText className="w-5 h-5 text-primary-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-900">New Deal</p>
                    <p className="text-xs text-surface-600 mt-0.5">Create a deal</p>
                  </div>
                </div>
              </Link>
              <Link href="/meetings/demo">
                <div className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-surface-200 hover:border-accent-400 hover:bg-accent-500/5 transition-all cursor-pointer group text-center">
                  <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center group-hover:bg-accent-500/20 group-hover:scale-105 transition-all">
                    <Users className="w-5 h-5 text-accent-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-900">Meeting</p>
                    <p className="text-xs text-surface-600 mt-0.5">Start video call</p>
                  </div>
                </div>
              </Link>
              <Link href="/disputes">
                <div className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-surface-200 hover:border-warning-400 hover:bg-warning-500/5 transition-all cursor-pointer group text-center">
                  <div className="w-10 h-10 rounded-xl bg-warning-500/10 flex items-center justify-center group-hover:bg-warning-500/20 group-hover:scale-105 transition-all">
                    <AlertTriangle className="w-5 h-5 text-warning-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-900">Dispute</p>
                    <p className="text-xs text-surface-600 mt-0.5">Resolve issues</p>
                  </div>
                </div>
              </Link>
            </div>
          </Card>

          {/* Platform Status */}
          <Card>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-success-500/10 flex items-center justify-center">
                <Activity className="w-4 h-4 text-success-400" />
              </div>
              <h2 className="text-base font-semibold text-surface-900">Platform Status</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-100">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-success-400 animate-pulse" />
                  <span className="text-sm text-surface-700">Solana Network</span>
                </div>
                <span className="text-xs font-medium text-success-400 bg-success-500/10 px-2 py-0.5 rounded-full">Operational</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-100">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-success-400 animate-pulse" />
                  <span className="text-sm text-surface-700">AI Services</span>
                </div>
                <span className="text-xs font-medium text-success-400 bg-success-500/10 px-2 py-0.5 rounded-full">Operational</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-100">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-success-400 animate-pulse" />
                  <span className="text-sm text-surface-700">Video Meetings</span>
                </div>
                <span className="text-xs font-medium text-success-400 bg-success-500/10 px-2 py-0.5 rounded-full">Operational</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-100">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-success-400 animate-pulse" />
                  <span className="text-sm text-surface-700">Escrow Contracts</span>
                </div>
                <span className="text-xs font-medium text-success-400 bg-success-500/10 px-2 py-0.5 rounded-full">Operational</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}