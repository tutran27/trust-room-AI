'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@trustroom/ui';
import type { Deal } from '../lib/api-types';
import { formatAmount, formatRelativeTime, titleCaseStatus } from '../lib/format';
import { shortAddress } from '../lib/wallet';
import { StatusBadge } from './status-badge';

const STATUS_ACCENT: Record<string, string> = {
  Released: 'border-l-indigo-500',
  Disputed: 'border-l-red-500',
  Negotiating: 'border-l-amber-500',
  Deposited: 'border-l-amber-500',
  Created: 'border-l-sky-500',
  Draft: 'border-l-slate-300',
  Funded: 'border-l-indigo-400',
  Refunded: 'border-l-slate-400',
  Cancelled: 'border-l-slate-300',
  EscrowCreated: 'border-l-indigo-300',
};

export function DealCard({ deal }: { deal: Deal }) {
  const accent = STATUS_ACCENT[deal.status] ?? 'border-l-slate-200';

  return (
    <Link href={`/deals/${deal.id}`} className="block group">
      <Card className={`h-full border-l-2 ${accent} transition-all duration-200 hover:bg-slate-50 hover:border-slate-300`}>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate">{deal.title}</CardTitle>
              <CardDescription className="mt-1 line-clamp-2">
                {deal.description || 'Chưa có mô tả chi tiết.'}
              </CardDescription>
            </div>
            <StatusBadge value={deal.status} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Giá trị</p>
            <p className="mt-1 font-medium text-slate-900">{formatAmount(deal.amount, deal.token)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Loại</p>
            <p className="mt-1 font-medium text-slate-900">{titleCaseStatus(deal.type)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Buyer</p>
            <p className="mt-1 font-mono text-slate-600">{shortAddress(deal.buyerWallet)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Seller</p>
            <p className="mt-1 font-mono text-slate-600">{shortAddress(deal.sellerWallet)}</p>
          </div>
        </CardContent>
        <CardFooter className="justify-between text-xs text-slate-400">
          <span>v{deal.version}</span>
          <span>{formatRelativeTime(deal.updatedAt)}</span>
        </CardFooter>
      </Card>
    </Link>
  );
}
