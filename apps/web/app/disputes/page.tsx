'use client';

import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { AuthGate } from '@/components/auth-gate';
import { useDisputes } from '@/hooks/use-api';
import { formatDateTime } from '@/lib/format';
import { shortAddress } from '@/lib/wallet';

function disputeStatusVariant(status: string) {
  const s = status.toLowerCase();
  if (s === 'open' || s === 'pending') return 'warning' as const;
  if (s === 'resolved' || s === 'closed') return 'success' as const;
  if (s === 'escalated') return 'danger' as const;
  return 'default' as const;
}

export default function DisputesPage() {
  const disputes = useDisputes();

  return (
    <AuthGate>
      <AppLayout>
        <div className="space-y-6">
          <PageHeader
            title="Disputes"
            description="All disputes involving your wallet"
            actions={
              <Link href="/dashboard">
                <Button variant="outline" size="sm">Dashboard</Button>
              </Link>
            }
          />

          {disputes.isLoading ? (
            <div className="grid gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : disputes.isError ? (
            <Card padding="lg">
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <p className="text-red-600 font-medium">Failed to load disputes</p>
                <p className="text-sm text-surface-500 mt-1">
                  {disputes.error instanceof Error ? disputes.error.message : 'Unknown error.'}
                </p>
              </div>
            </Card>
          ) : disputes.data && disputes.data.length > 0 ? (
            <div className="grid gap-4">
              {disputes.data.map((dispute) => (
                <Link key={dispute.id} href={`/disputes/${dispute.id}`}>
                  <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-primary-200">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="truncate text-sm font-semibold text-surface-900 group-hover:text-primary-700 transition-colors">
                              {dispute.reason}
                            </h3>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-surface-500">
                              <span className="flex items-center gap-1">
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                                {dispute.deal?.title ?? dispute.dealId}
                              </span>
                              <span className="text-surface-300">·</span>
                              <span className="flex items-center gap-1">
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                </svg>
                                {shortAddress(dispute.raisedBy, 5, 5)}
                              </span>
                              <span className="text-surface-300">·</span>
                              <span>{dispute.evidence?.length ?? 0} evidence</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:ml-4">
                        <Badge variant={disputeStatusVariant(dispute.status)} dot>
                          {dispute.status}
                        </Badge>
                        <span className="text-xs text-surface-400">
                          {formatDateTime(dispute.createdAt)}
                        </span>
                        <svg className="h-4 w-4 text-surface-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={
                <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              }
              title="No disputes yet"
              description="You can open a dispute directly from a deal room."
            />
          )}
        </div>
      </AppLayout>
    </AuthGate>
  );
}