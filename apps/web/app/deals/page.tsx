'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiFetch } from '@/lib/api';
import {
  FileText,
  Plus,
  Search,
  ArrowUpRight,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';

const FILTER_TABS = [
  { key: 'all', label: 'All Deals' },
  { key: 'NEGOTIATING', label: 'Negotiating' },
  { key: 'ESCROW_FUNDED', label: 'Escrow Funded' },
  { key: 'IN_MEETING', label: 'In Meeting' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'DISPUTED', label: 'Disputed' },
];

export default function DealsPage() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchDeals() {
      try {
        const res = await apiFetch<{ deals: any[]; total: number }>('/deals?limit=50');
        setDeals(res?.deals || []);
      } catch (err) {
        console.error('Failed to load deals:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDeals();
  }, []);

  const filteredDeals = deals.filter((deal) => {
    const matchesFilter = activeFilter === 'all' || deal.status === activeFilter;
    const matchesSearch = !searchQuery || 
      deal.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.buyer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.seller?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: deals.length,
    active: deals.filter(d => ['NEGOTIATING', 'ESCROW_FUNDED', 'IN_MEETING'].includes(d.status)).length,
    volume: deals.reduce((sum, d) => sum + (d.amount || 0), 0),
    disputed: deals.filter(d => d.status === 'DISPUTED').length,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Deals"
          description="Manage your active and past deals with AI-powered protection."
          actions={
            <Link href="/deals/new">
              <button className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-500 active:bg-primary-700">
                <Plus className="h-4 w-4" />
                New Deal
              </button>
            </Link>
          }
        />

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Deals', value: stats.total, icon: FileText, color: 'text-primary-400', bg: 'bg-primary-500/10' },
            { label: 'Active Deals', value: stats.active, icon: Shield, color: 'text-success-400', bg: 'bg-success-500/10' },
            { label: 'Total Volume', value: `${stats.volume.toLocaleString()} SOL`, icon: TrendingUp, color: 'text-info-400', bg: 'bg-info-500/10' },
            { label: 'Disputes', value: stats.disputed, icon: AlertTriangle, color: 'text-danger-400', bg: 'bg-danger-500/10' },
          ].map((stat) => (
            <Card key={stat.label} className="p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-surface-900 tracking-tight">{stat.value}</p>
                  <p className="text-xs font-medium text-surface-500">{stat.label}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
            <input
              type="text"
              placeholder="Search deals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-surface-300 bg-surface-100 pl-10 pr-4 py-2.5 text-sm text-surface-900 placeholder:text-surface-500 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
            />
          </div>
          <div className="flex items-center gap-1 p-1 bg-surface-100 rounded-xl">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeFilter === tab.key
                    ? 'bg-surface-0 text-surface-900 shadow-sm'
                    : 'text-surface-500 hover:text-surface-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Deals List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-4 p-4 rounded-xl bg-surface-100">
                <div className="w-12 h-12 bg-surface-200 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-surface-200 rounded w-1/3" />
                  <div className="h-2.5 bg-surface-200 rounded w-1/2" />
                </div>
                <div className="h-5 bg-surface-200 rounded-full w-16" />
              </div>
            ))}
          </div>
        ) : filteredDeals.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-12 h-12" />}
            title="No deals found"
            description={searchQuery ? `No deals match "${searchQuery}"` : "Create your first deal to get started with secure, AI-powered transactions."}
            action={{ label: 'Create Deal', onClick: () => {} }}
          />
        ) : (
          <div className="space-y-3">
            {filteredDeals.map((deal) => (
              <Link key={deal.id} href={`/deals/${deal.id}`}>
                <Card className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-surface-200/50 hover:border-primary-400/50 hover:-translate-y-0.5">
                  <div className="flex items-center gap-4">
                    {/* Deal Icon */}
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-400 transition-all duration-200 group-hover:bg-primary-500/20 group-hover:scale-105">
                      <FileText className="h-5 w-5" />
                    </div>

                    {/* Deal Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-surface-900 group-hover:text-primary-400 transition-colors truncate">
                          {deal.title}
                        </h3>
                        <StatusBadge type="deal" status={deal.status} />
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-surface-500">
                        <span className="flex items-center gap-1">
                          <span className="font-medium text-surface-700">{deal.buyer?.name || 'Buyer'}</span>
                          <span className="text-surface-400">→</span>
                          <span className="font-medium text-surface-700">{deal.seller?.name || 'Seller'}</span>
                        </span>
                        <span className="text-surface-400">|</span>
                        <span>{new Date(deal.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Right side: Amount */}
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-bold text-surface-900">{deal.amount?.toLocaleString() || '0'} SOL</p>
                        {deal.escrow && (
                          <p className="text-[11px] text-surface-500">Escrowed</p>
                        )}
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-surface-400 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary-400" />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}