'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@trustroom/ui';
import type { Deal } from '../lib/api-types';
import { formatAmount, formatRelativeTime, titleCaseStatus } from '../lib/format';
import { shortAddress } from '../lib/wallet';
import { StatusBadge } from './status-badge';

const STATUS_ACCENT: Record<string, string> = {
  Released: 'border-l-emerald-500',
  Disputed: 'border-l-red-500',
  Negotiating: 'border-l-amber-500',
  Deposited: 'border-l-amber-500',
  Created: 'border-l-sky-500',
  Draft: 'border-l-zinc-500',
};

export function DealCard({ deal }: { deal: Deal }) {
  const accent = STATUS_ACCENT[deal.status] ?? 'border-l-zinc-700';

  return (
    <Link href={`/deals/${deal.id}`} className="block group">
      <Card className={`h-full border-l-2 ${accent} transition-all duration-200 hover:bg-white/[0.05] hover:border-white/[0.1]`}>
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
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Giá trị</p>
            <p className="mt-1 font-medium text-zinc-100">{formatAmount(deal.amount, deal.token)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Loại</p>
            <p className="mt-1 font-medium text-zinc-100">{titleCaseStatus(deal.type)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Buyer</p>
            <p className="mt-1 font-mono text-zinc-400">{shortAddress(deal.buyerWallet)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Seller</p>
            <p className="mt-1 font-mono text-zinc-400">{shortAddress(deal.sellerWallet)}</p>
          </div>
        </CardContent>
        <CardFooter className="justify-between text-xs text-zinc-500">
          <span>v{deal.version}</span>
          <span>{formatRelativeTime(deal.updatedAt)}</span>
        </CardFooter>
      </Card>
    </Link>
  );
}
