'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@trustroom/ui';
import type { Deal } from '../lib/api-types';
import { formatAmount, formatRelativeTime, titleCaseStatus } from '../lib/format';
import { shortAddress } from '../lib/wallet';
import { StatusBadge } from './status-badge';

export function DealCard({ deal }: { deal: Deal }) {
  return (
    <Link href={`/deals/${deal.id}`} className="block">
      <Card className="h-full transition hover:border-emerald-400/40 hover:bg-white/[0.04]">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{deal.title}</CardTitle>
              <CardDescription className="mt-1">
                {deal.description || 'Chưa có mô tả chi tiết.'}
              </CardDescription>
            </div>
            <StatusBadge value={deal.status} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Giá trị</p>
            <p className="mt-1 font-medium text-slate-100">{formatAmount(deal.amount, deal.token)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Loại</p>
            <p className="mt-1 font-medium text-slate-100">{titleCaseStatus(deal.type)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Buyer</p>
            <p className="mt-1">{shortAddress(deal.buyerWallet)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Seller</p>
            <p className="mt-1">{shortAddress(deal.sellerWallet)}</p>
          </div>
        </CardContent>
        <CardFooter className="justify-between text-xs text-slate-400">
          <span>Version {deal.version}</span>
          <span>Cập nhật {formatRelativeTime(deal.updatedAt)}</span>
        </CardFooter>
      </Card>
    </Link>
  );
}
