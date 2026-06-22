'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { apiFetch } from '@/lib/api';
import {
  FileText,
  Plus,
  Search,
  ArrowUpRight,
  Shield,
  TrendingUp,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

const FILTER_TABS = [
  { key: 'all', label: 'All Deals' },
  { key: 'NEGOTIATING', label: 'Negotiating' },
  { key: 'ESCROW_FUNDED', label: 'Escrow Funded' },
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
        const res = await apiFetch<{ data: any[] }>('/deals?limit=50');
        setDeals(res?.data || []);
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
      deal.buyerWallet?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.sellerWallet?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: deals.length,
    active: deals.filter(d => ['NEGOTIATING', 'ESCROW_FUNDED', 'IN_MEETING'].includes(d.status)).length,
    volume: deals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0),
    disputed: deals.filter(d => d.status === 'DISPUTED').length,
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Deals</h1>
            <p className="text-sm text-surface-500 mt-1">Manage your active and past deals with AI-powered protection.</p>
          </div>
          <Link href="/deals/new">
            <Button>
              <Plus className="w-4 h-4 mr-1.5" />
              New Deal
            </Button>
          </Link>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
                <FileText className="h-5 w-5 text-brand-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-surface-900 tracking-tight">{stats.total}</p>
                <p className="text-xs font-medium text-surface-500">Total Deals</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
                <Shield className="h-5 w-5 text-brand-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-surface-900 tracking-tight">{stats.active}</p>
                <p className="text-xs font-medium text-surface-500">Active Deals</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50">
                <TrendingUp className="h-5 w-5 text-success-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-surface-900 tracking-tight">{stats.volume.toLocaleString()} SOL</p>
                <p className="text-xs font-medium text-surface-500">Total Volume</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stats.disputed ? 'bg-danger-50' : 'bg-surface-100'}`}>
                <AlertTriangle className={`h-5 w-5 ${stats.disputed ? 'text-danger-600' : 'text-surface-400'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-surface-900 tracking-tight">{stats.disputed}</p>
                <p className="text-xs font-medium text-surface-500">Disputes</p>
              </div>
            </div>
          </Card>
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
              className="w-full rounded-xl border border-surface-300 bg-white pl-10 pr-4 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all shadow-sm"
            />
          </div>
          <div className="flex items-center gap-1 p-1 bg-surface-100 rounded-xl">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeFilter === tab.key
                    ? 'bg-white text-surface-900 shadow-sm'
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
              <div key={i} className="animate-pulse flex items-center gap-4 p-4 rounded-xl bg-white border border-surface-200 shadow-sm">
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
          <Card>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-surface-400" />
              </div>
              <h3 className="text-lg font-semibold text-surface-800">No deals found</h3>
              <p className="mt-1 text-sm text-surface-500 max-w-sm">
                {searchQuery ? `No deals match "${searchQuery}"` : "Create your first deal to get started."}
              </p>
              {!searchQuery && (
                <Link href="/deals/new" className="mt-4">
                  <Button size="sm">
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Create Deal
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredDeals.map((deal) => (
              <Link key={deal.id} href={`/deals/${deal.id}`}>
                <Card className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-brand-300 hover:-translate-y-0.5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition-all duration-200 group-hover:bg-brand-100 group-hover:scale-105">
                      <FileText className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-surface-900 group-hover:text-brand-600 transition-colors truncate">
                          {deal.title}
                        </h3>
                        <StatusBadge type="deal" status={deal.status} />
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-surface-500">
                        <span className="flex items-center gap-1">
                          <span className="font-medium text-surface-700">{deal.buyerWallet?.slice(0, 8) || 'Buyer'}</span>
                          <span className="text-surface-400">→</span>
                          <span className="font-medium text-surface-700">{deal.sellerWallet?.slice(0, 8) || 'Seller'}</span>
                        </span>
                        <span className="text-surface-300">|</span>
                        <span>{new Date(deal.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-bold text-surface-900">{deal.amount || '0'} SOL</p>
                        {deal.escrow && (
                          <p className="text-[11px] text-surface-500">Escrowed</p>
                        )}
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-surface-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-500" />
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
