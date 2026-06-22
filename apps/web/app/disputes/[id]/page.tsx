'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { AuthGate } from '@/components/auth-gate';
import { useAddEvidence, useDispute, useResolveDispute } from '@/hooks/use-api';
import { formatDateTime } from '@/lib/format';
import { shortAddress } from '@/lib/wallet';

function disputeStatusVariant(status: string): 'warning' | 'success' | 'danger' | 'default' {
  const s = status.toLowerCase();
  if (s === 'open' || s === 'pending') return 'warning';
  if (s === 'resolved' || s === 'closed') return 'success';
  if (s === 'escalated') return 'danger';
  return 'default';
}

function evidenceTypeIcon(type: string) {
  const t = type.toLowerCase();
  if (t === 'transcript') {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    );
  }
  if (t === 'screenshot' || t === 'image') {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M2.25 18V6.75a2.25 2.25 0 012.25-2.25h15a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H4.5A2.25 2.25 0 012.25 18z" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

export default function DisputeDetailPage() {
  const params = useParams<{ id: string }>();
  const disputeId = params?.id ?? null;
  const dispute = useDispute(disputeId);
  const resolveDispute = useResolveDispute(disputeId ?? '');
  const addEvidence = useAddEvidence(disputeId ?? '');
  const [resolution, setResolution] = useState<'ReleaseToSeller' | 'RefundToBuyer' | 'SplitPayment'>('RefundToBuyer');
  const [evidenceText, setEvidenceText] = useState('');

  return (
    <AuthGate>
      <AppLayout>
        <div className="space-y-6">
          <PageHeader
            title={dispute.data?.reason ?? 'Dispute Detail'}
            description="Review evidence, status, and resolve the dispute"
            actions={
              <div className="flex items-center gap-3">
                <Link href="/disputes">
                  <Button variant="outline" size="sm">All Disputes</Button>
                </Link>
                {dispute.data?.dealId ? (
                  <Link href={`/deals/${dispute.data.dealId}`}>
                    <Button variant="primary" size="sm">Open Deal</Button>
                  </Link>
                ) : null}
              </div>
            }
          />

          {dispute.isLoading ? (
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <Skeleton className="h-96 rounded-2xl" />
              <div className="space-y-6">
                <Skeleton className="h-48 rounded-2xl" />
                <Skeleton className="h-48 rounded-2xl" />
              </div>
            </div>
          ) : dispute.isError || !dispute.data ? (
            <Card padding="lg">
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <p className="text-red-600 font-medium">Failed to load dispute</p>
                <p className="text-sm text-surface-500 mt-1">
                  {dispute.error instanceof Error ? dispute.error.message : 'Dispute not found.'}
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              {/* Left: Details + Evidence */}
              <div className="space-y-6">
                {/* Dispute Info */}
                <Card>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-semibold text-surface-900">Dispute Details</h3>
                    <Badge variant={disputeStatusVariant(dispute.data.status)} dot>
                      {dispute.data.status}
                    </Badge>
                  </div>

                  <div className="space-y-5">
                    {/* AI Summary */}
                    {dispute.data.aiSummary ? (
                      <div className="rounded-xl bg-gradient-to-br from-primary-50 to-primary-100/50 p-4 border border-primary-200/50">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex h-5 w-5 items-center justify-center rounded bg-primary-600">
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                            </svg>
                          </div>
                          <span className="text-xs font-semibold text-primary-700 uppercase tracking-wider">AI Analysis</span>
                        </div>
                        <p className="text-sm text-primary-800 leading-relaxed">{dispute.data.aiSummary}</p>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-surface-50 p-4 border border-surface-200">
                        <p className="text-sm text-surface-400 italic">No AI summary available yet.</p>
                      </div>
                    )}

                    {/* Metadata Grid */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-surface-400 uppercase tracking-wider">Raised By</p>
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-surface-100 flex items-center justify-center">
                            <svg className="h-3 w-3 text-surface-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                            </svg>
                          </div>
                          <span className="font-mono text-sm text-surface-700">{shortAddress(dispute.data.raisedBy, 5, 5)}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-surface-400 uppercase tracking-wider">Deal</p>
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-surface-100 flex items-center justify-center">
                            <svg className="h-3 w-3 text-surface-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6V5.25A2.25 2.25 0 0011.25 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 005.25 21h6a2.25 2.25 0 002.25-2.25V15m0 0l-3-3m0 0l3 3m-3-3v11.25" />
                            </svg>
                          </div>
                          <span className="font-mono text-sm text-surface-700">{dispute.data.dealId.slice(0, 8)}...</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-surface-400 uppercase tracking-wider">Created</p>
                        <p className="text-sm text-surface-600">{formatDateTime(dispute.data.createdAt)}</p>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-surface-400 uppercase tracking-wider">Resolved</p>
                        <p className="text-sm text-surface-600">
                          {dispute.data.resolvedAt ? formatDateTime(dispute.data.resolvedAt) : (
                            <span className="text-surface-400 italic">Pending</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Evidence List */}
                <Card>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-semibold text-surface-900">Evidence</h3>
                    <Badge variant="default">{dispute.data.evidence?.length ?? 0} items</Badge>
                  </div>

                  {dispute.data.evidence?.length ? (
                    <div className="space-y-3">
                      {dispute.data.evidence.map((evidence) => (
                        <div
                          key={evidence.id}
                          className="rounded-xl border border-surface-200 bg-surface-50/50 p-4 transition-colors hover:border-surface-300"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-100 text-surface-500">
                                {evidenceTypeIcon(evidence.type)}
                              </div>
                              <span className="text-sm font-semibold text-surface-800">{evidence.type}</span>
                            </div>
                            <span className="text-xs text-surface-400">{formatDateTime(evidence.createdAt)}</span>
                          </div>
                          <p className="mt-3 text-sm text-surface-600 leading-relaxed">{evidence.content}</p>
                          {evidence.url ? (
                            <a
                              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
                              href={evidence.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                              Open attachment
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={
                        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      }
                      title="No evidence yet"
                      description="Add evidence using the panel on the right."
                    />
                  )}
                </Card>
              </div>

              {/* Right: Actions */}
              <div className="space-y-6">
                {/* Add Evidence */}
                <Card>
                  <div className="mb-5">
                    <h3 className="text-sm font-semibold text-surface-900">Add Evidence</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-surface-600">Evidence Content</label>
                      <textarea
                        rows={5}
                        value={evidenceText}
                        onChange={(event) => setEvidenceText(event.target.value)}
                        placeholder="Paste transcript, describe screenshot, or add investigation notes..."
                        className="w-full rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none resize-none transition-all"
                      />
                    </div>
                    <Button
                      onClick={() => {
                        addEvidence.mutate({ type: 'text', content: evidenceText });
                        setEvidenceText('');
                      }}
                      disabled={addEvidence.isPending || !evidenceText.trim()}
                      className="w-full"
                    >
                      {addEvidence.isPending ? 'Adding...' : 'Submit Evidence'}
                    </Button>
                  </div>
                </Card>

                {/* Resolution */}
                <Card>
                  <div className="mb-5">
                    <h3 className="text-sm font-semibold text-surface-900">Resolution</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2.5">
                      <label className="text-sm font-medium text-surface-600">Resolution Type</label>
                      <div className="grid grid-cols-1 gap-2">
                        {(['RefundToBuyer', 'ReleaseToSeller', 'SplitPayment'] as const).map((option) => (
                          <button
                            key={option}
                            onClick={() => setResolution(option)}
                            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all ${
                              resolution === option
                                ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-500/20'
                                : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300 hover:bg-surface-50'
                            }`}
                          >
                            <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                              resolution === option ? 'border-primary-500 bg-primary-500' : 'border-surface-300'
                            }`}>
                              {resolution === option && (
                                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              )}
                            </div>
                            <span>{option === 'RefundToBuyer' ? 'Refund to Buyer' : option === 'ReleaseToSeller' ? 'Release to Seller' : 'Split Payment'}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="danger"
                      onClick={() => resolveDispute.mutate({ resolution })}
                      disabled={resolveDispute.isPending}
                      className="w-full"
                    >
                      {resolveDispute.isPending ? 'Resolving...' : 'Resolve Dispute'}
                    </Button>
                    {(resolveDispute.error || addEvidence.error) ? (
                      <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                        <div className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                          </svg>
                          <p className="text-sm text-red-600">
                            {(resolveDispute.error instanceof Error && resolveDispute.error.message) ||
                              (addEvidence.error instanceof Error && addEvidence.error.message) ||
                              'An error occurred.'}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </AppLayout>
    </AuthGate>
  );
}