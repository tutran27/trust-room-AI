'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
  Textarea,
} from '@trustroom/ui';
import { AppShell } from '../../../components/app-shell';
import { AuthGate } from '../../../components/auth-gate';
import { StatusBadge } from '../../../components/status-badge';
import {
  useAddEvidence,
  useConfirmEscrowCreated,
  useConfirmTerms,
  useCreateDispute,
  useCreateEscrow,
  useSubmitDelivery,
  useCreateMeeting,
  useDeal,
  useDetectScam,
  useDispute,
  useEscrowByDeal,
  useGetUnsignedTx,
  useFundEscrow,
  useMeetingsByDeal,
  useInviteSeller,
  useRefundEscrow,
  useReleaseEscrow,
  useTransitionDeal,
  useUpdateDeal,
} from '../../../hooks/use-api';
import { signAndSendTx, isPhantomInstalled } from '../../../lib/solana';
import { useDealRoom } from '../../../hooks/use-deal-room';
import {
  formatAmount,
  formatDateTime,
  formatRelativeTime,
  titleCaseStatus,
} from '../../../lib/format';
import { shortAddress } from '../../../lib/wallet';
import { useAuth } from '../../../providers/auth-provider';

const DEAL_ACTION_OPTIONS: Record<string, string[]> = {
  Draft: ['publish', 'cancel'],
  Created: ['open-invitation', 'cancel'],
  WaitingForCounterparty: ['verify-wallets', 'cancel'],
};

function riskVariant(level?: string) {
  const normalized = String(level ?? '').toLowerCase();
  if (normalized === 'critical' || normalized === 'high') return 'danger' as const;
  if (normalized === 'medium') return 'warning' as const;
  if (normalized === 'low') return 'info' as const;
  return 'muted' as const;
}

export default function DealDetailPage() {
  const params = useParams<{ id: string }>();
  const dealId = params?.id ?? null;
  const router = useRouter();
  const { address } = useAuth();
  const dealQuery = useDeal(dealId);
  const escrowQuery = useEscrowByDeal(dealId);
  const deal = dealQuery.data ?? null;
  const escrow = escrowQuery.data ?? null;
  const transitionDeal = useTransitionDeal(dealId ?? '');
  const inviteSeller = useInviteSeller(dealId ?? '');
  const updateDeal = useUpdateDeal(dealId ?? '');
  const createEscrow = useCreateEscrow();
  const createMeeting = useCreateMeeting();
  const meetingsQuery = useMeetingsByDeal(dealId, Boolean(dealId && address));
  const fundEscrow = useFundEscrow();
  const releaseEscrow = useReleaseEscrow();
  const refundEscrow = useRefundEscrow();
  const createDispute = useCreateDispute();
  const detectScam = useDetectScam();
  const live = useDealRoom(deal, address);

  const [sellerWallet, setSellerWallet] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [disputeReason, setDisputeReason] = useState('Delivery quality issue');
  const [disputeDescription, setDisputeDescription] = useState(
    'Seller claims delivery complete but deliverable is missing key requirements.',
  );
  const [editDescription, setEditDescription] = useState('');
  const [evidenceContent, setEvidenceContent] = useState('Screenshot / transcript evidence');
  const [escrowLoading, setEscrowLoading] = useState<string | null>(null);
  const [escrowError, setEscrowError] = useState<string | null>(null);
  const getUnsignedTx = useGetUnsignedTx();
  const confirmCreated = useConfirmEscrowCreated();
  const confirmTerms = useConfirmTerms();
  const submitDelivery = useSubmitDelivery();

  const activeDisputeId = deal?.status === 'Disputed' ? undefined : undefined;
  const currentDispute = useDispute(activeDisputeId ?? null);
  const addEvidence = useAddEvidence(currentDispute.data?.id ?? '');

  const chatRiskSummary = useMemo(() => live.riskEvents[0] ?? null, [live.riskEvents]);
  const availableActions = deal ? DEAL_ACTION_OPTIONS[deal.status] ?? [] : [];

  return (
    <AuthGate>
      <AppShell
        title={deal?.title ?? 'Deal room'}
        contentClassName="max-w-[1920px] px-3 md:px-5 2xl:px-8"
        actions={
          <>
            <Link href="/dashboard">
              <Button variant="ghost">Dashboard</Button>
            </Link>
            <Link href="/disputes">
              <Button variant="secondary">Xem disputes</Button>
            </Link>
            {meetingsQuery.data?.[0] ? (
              <Link href={`/meetings/${meetingsQuery.data[0].id}`}>
                <Button>Vào meeting</Button>
              </Link>
            ) : null}
          </>
        }
      >
        {dealQuery.isLoading ? (
          <div className="grid gap-6">
            <Skeleton className="h-[820px]" />
          </div>
        ) : dealQuery.isError || !deal ? (
          <Alert variant="danger" title="Không tải được deal">
            {dealQuery.error instanceof Error ? dealQuery.error.message : 'Deal không tồn tại.'}
          </Alert>
        ) : (
          <div className="grid gap-6 2xl:grid-cols-[2.08fr_0.92fr]">
            <div className="space-y-6">
              {/* Deal Overview Card */}
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-white/[0.06] pb-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {meetingsQuery.data?.[0] ? (
                          <Link href={`/meetings/${meetingsQuery.data[0].id}`}>
                            <Button>Vào meeting</Button>
                          </Link>
                        ) : (
                          <Button
                            onClick={async () => {
                              const meeting = await createMeeting.mutateAsync({
                                dealId: deal.id,
                                title: `${deal.title} - Meeting`,
                              });
                              router.push(`/meetings/${meeting.id}`);
                            }}
                            disabled={createMeeting.isPending}
                          >
                            {createMeeting.isPending ? 'Đang tạo room...' : 'Tạo meeting'}
                          </Button>
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg">Deal overview</CardTitle>
                      </div>
                    </div>
                    <div className="grid gap-1.5 text-sm text-zinc-400 xl:text-right">
                      <p>Buyer: <span className="font-mono text-zinc-300">{shortAddress(deal.buyerWallet, 5, 5)}</span></p>
                      <p>
                        Seller:{' '}
                        {deal.sellerWallet ? <span className="font-mono text-zinc-300">{shortAddress(deal.sellerWallet, 5, 5)}</span> : <span className="text-zinc-500">chưa gán</span>}
                      </p>
                      <p>Created: {formatDateTime(deal.createdAt)}</p>
                      <p>Updated: {formatRelativeTime(deal.updatedAt)}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-5 pt-6 xl:grid-cols-[1.2fr_0.8fr]">
                  <div className="space-y-4">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Mô tả deal</p>
                      <p className="text-sm leading-relaxed text-zinc-300">
                        {deal.description || 'Chưa có mô tả.'}
                      </p>
                    </div>

                    <Textarea
                      rows={4}
                      value={editDescription || deal.description || ''}
                      onChange={(event) => setEditDescription(event.target.value)}
                      placeholder="Cập nhật mô tả deal"
                    />

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() =>
                          updateDeal.mutate({
                            expectedVersion: deal.version,
                            description: editDescription,
                          })
                        }
                        disabled={updateDeal.isPending}
                      >
                        Lưu mô tả
                      </Button>

                      {availableActions.map((action) => (
                        <Button
                          key={action}
                          variant="ghost"
                          onClick={() =>
                            transitionDeal.mutate({
                              action,
                              expectedVersion: deal.version,
                            })
                          }
                          disabled={transitionDeal.isPending}
                        >
                          {titleCaseStatus(action)}
                        </Button>
                      ))}
                    </div>

                    {(transitionDeal.error || updateDeal.error) ? (
                      <Alert variant="danger" title="Không thể cập nhật deal">
                        {(transitionDeal.error instanceof Error && transitionDeal.error.message) ||
                          (updateDeal.error instanceof Error && updateDeal.error.message) ||
                          'Lỗi không xác định.'}
                      </Alert>
                    ) : null}
                  </div>

                  {!deal.sellerWallet ? (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
                      <p className="mb-3 text-sm font-medium text-amber-400">Mời seller</p>
                      <div className="flex flex-col gap-3">
                        <Input
                          value={sellerWallet}
                          onChange={(event) => setSellerWallet(event.target.value)}
                          placeholder="Nhập wallet seller"
                        />
                        <Button
                          onClick={() =>
                            inviteSeller.mutate({
                              sellerWallet,
                              expectedVersion: deal.version,
                            })
                          }
                          disabled={inviteSeller.isPending || !sellerWallet}
                        >
                          Mời seller
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <p className="text-sm font-medium text-zinc-100">Đối tác sẵn sàng</p>
                      <p className="mt-2 text-sm text-zinc-400">
                        Seller hiện tại là <span className="font-mono text-zinc-300">{shortAddress(deal.sellerWallet, 5, 5)}</span>.
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        v{deal.version} • deadline {formatDateTime(deal.deadline)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Realtime + Scam Guard Card */}
              <Card>
                <CardHeader className="border-b border-white/[0.06] pb-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                      <CardTitle className="text-lg">Deal room realtime + Scam Guard</CardTitle>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={chatRiskSummary ? riskVariant(chatRiskSummary.level) : 'muted'}>
                        {chatRiskSummary ? `risk ${chatRiskSummary.level}` : 'no active alert'}
                      </Badge>
                      <Badge variant="muted">{live.messages.length} messages</Badge>
                      <Badge variant="muted">{live.updates.length} updates</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {detectScam.data ? (
                    <Alert
                      variant={
                        detectScam.data.level === 'critical' || detectScam.data.level === 'high'
                          ? 'danger'
                          : detectScam.data.level === 'medium'
                            ? 'warning'
                            : 'success'
                      }
                      title={`Scam scan: ${detectScam.data.level}`}
                    >
                      {detectScam.data.hits.length > 0
                        ? detectScam.data.hits.map((hit) => hit.rule.message).join(' | ')
                        : 'Không có hit đáng chú ý.'}
                    </Alert>
                  ) : null}

                  <div className="grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
                    <div className="space-y-4">
                      {/* Transcript */}
                      <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-emerald-400">Transcript</p>
                          <Badge variant={live.connected ? 'success' : 'warning'}>
                            {live.connected ? 'live' : 'offline'}
                          </Badge>
                        </div>

                        <div className="max-h-[540px] space-y-3 overflow-y-auto pr-1">
                          {live.messages.length > 0 ? (
                            live.messages.map((message, index) => (
                              <div
                                key={`${message.timestamp}-${index}`}
                                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                              >
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="muted">{shortAddress(message.sender, 5, 5)}</Badge>
                                    <Badge variant="info">{message.speakerRole}</Badge>
                                  </div>
                                  <span>{formatRelativeTime(message.timestamp)}</span>
                                </div>
                                <p className="text-sm leading-relaxed text-zinc-100">{message.message}</p>
                              </div>
                            ))
                          ) : (
                            <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-emerald-500/15 bg-white/[0.01] p-8 text-center">
                              <div className="space-y-2">
                                <p className="text-base font-medium text-zinc-200">Chưa có transcript realtime</p>
                                <p className="text-sm leading-relaxed text-zinc-500">
                                  Gửi một chat message để khởi động realtime monitor và feed dữ liệu cho Scam Guard.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Chat Input */}
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <div className="grid gap-3 xl:grid-cols-[1fr_auto]">
                          <Textarea
                            rows={4}
                            value={chatMessage}
                            onChange={(event) => setChatMessage(event.target.value)}
                            placeholder="Nhập nội dung thương lượng..."
                          />
                          <div className="flex flex-col gap-2 xl:w-[160px]">
                            <Button
                              onClick={() => {
                                live.sendChatMessage(chatMessage);
                                setChatMessage('');
                              }}
                              disabled={!chatMessage.trim()}
                            >
                              Gửi chat
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => detectScam.mutate({ text: chatMessage })}
                              disabled={!chatMessage.trim() || detectScam.isPending}
                            >
                              Scan nhanh
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* AI Monitor */}
                      <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.04] p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-zinc-100">AI monitor</p>
                          <Badge variant={chatRiskSummary ? riskVariant(chatRiskSummary.level) : 'muted'}>
                            {chatRiskSummary?.level ?? 'idle'}
                          </Badge>
                        </div>

                        {chatRiskSummary ? (
                          <div className="space-y-3">
                            <p className="text-sm leading-relaxed text-zinc-300">
                              {chatRiskSummary.reasons.join(' • ')}
                            </p>
                            <div className="rounded-lg border border-red-500/10 bg-red-500/[0.04] px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wider text-red-400/80">
                                Trigger text
                              </p>
                              <p className="mt-1 text-sm text-zinc-200">
                                {chatRiskSummary.triggerText}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <Alert title="Chưa có cảnh báo">
                            Realtime Scam Guard sẽ đẩy event vào đây khi có tín hiệu đáng ngờ.
                          </Alert>
                        )}
                      </div>

                      {/* Realtime Updates */}
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-zinc-100">Realtime updates</p>
                          <Badge variant="muted">{live.updates.length}</Badge>
                        </div>
                        {live.updates.length > 0 ? (
                          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                            {live.updates.map((update, index) => (
                              <div
                                key={`${update.timestamp}-${index}`}
                                className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 text-sm text-zinc-400"
                              >
                                <p className="font-medium text-zinc-200">{update.kind ?? 'deal_update'}</p>
                                <p>
                                  {update.from
                                    ? `${update.from} -> ${update.to}`
                                    : update.status ?? 'No status payload'}
                                </p>
                                <p className="mt-1 text-[11px] text-zinc-500">
                                  {formatRelativeTime(update.timestamp)}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-zinc-500">Chưa có cập nhật realtime.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {/* Escrow Card */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle>Escrow (Solana Devnet)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {escrowError ? (
                    <Alert variant="danger" title="Lỗi escrow">{escrowError}</Alert>
                  ) : null}

                  {!isPhantomInstalled() ? (
                    <Alert variant="warning" title="Cần cài Phantom wallet">
                      <a href="https://phantom.app/" target="_blank" rel="noopener noreferrer" className="underline">
                        Cài Phantom
                      </a>{' '}
                      để ký giao dịch Solana thật.
                    </Alert>
                  ) : null}

                  {escrow ? (
                    <>
                      <div className="flex items-center justify-between">
                        <StatusBadge value={escrow.status} />
                        <span className="text-sm font-medium text-zinc-200">
                          {formatAmount(escrow.amount, deal.token)}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs text-zinc-400">
                        <p>Buyer: <span className="font-mono">{shortAddress(escrow.buyerAddress, 6, 6)}</span> {escrow.buyerConfirmed ? '✅' : '⏳'}</p>
                        <p>Seller: <span className="font-mono">{shortAddress(escrow.sellerAddress, 6, 6)}</span> {escrow.sellerConfirmed ? '✅' : '⏳'}</p>
                      </div>
                      {escrow.txSignature ? (
                        <a
                          href={`https://solscan.io/tx/${escrow.txSignature}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-400 hover:underline"
                        >
                          Xem tx trên Solscan →
                        </a>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {escrow.status === 'Created' && address === escrow.buyerAddress ? (
                          <Button
                            disabled={escrowLoading !== null}
                            onClick={async () => {
                              setEscrowError(null);
                              setEscrowLoading('fund');
                              try {
                                const res = await getUnsignedTx.mutateAsync({
                                  path: `/escrow/${escrow.id}/fund`,
                                });
                                const sig = await signAndSendTx(res.txBase64);
                                await fundEscrow.mutateAsync({ escrowId: escrow.id, txSignature: sig });
                              } catch (err) {
                                setEscrowError(err instanceof Error ? err.message : 'Fund failed');
                              } finally {
                                setEscrowLoading(null);
                              }
                            }}
                          >
                            {escrowLoading === 'fund' ? 'Đang ký & gửi...' : 'Fund (nạp tiền)'}
                          </Button>
                        ) : null}

                        {escrow.status === 'Funded' ? (
                          <>
                            {address === escrow.buyerAddress && !escrow.buyerConfirmed ? (
                              <Button
                                disabled={escrowLoading !== null}
                                onClick={async () => {
                                  setEscrowError(null);
                                  setEscrowLoading('confirm-terms');
                                  try {
                                    const res = await getUnsignedTx.mutateAsync({
                                      path: `/escrow/deal/${deal.id}/confirm-terms`,
                                    });
                                    if (res.txBase64) {
                                      const sig = await signAndSendTx(res.txBase64);
                                      await confirmTerms.mutateAsync({ escrowId: escrow.id, txSignature: sig });
                                    } else {
                                      await confirmTerms.mutateAsync({ escrowId: escrow.id, txSignature: 'skipped' });
                                    }
                                  } catch (err) {
                                    setEscrowError(err instanceof Error ? err.message : 'Confirm terms failed');
                                  } finally {
                                    setEscrowLoading(null);
                                  }
                                }}
                              >
                                {escrowLoading === 'confirm-terms' ? 'Đang ký...' : 'Buyer: Confirm Terms'}
                              </Button>
                            ) : null}
                            {address === escrow.sellerAddress && !escrow.sellerConfirmed ? (
                              <Button
                                disabled={escrowLoading !== null}
                                onClick={async () => {
                                  setEscrowError(null);
                                  setEscrowLoading('confirm-terms');
                                  try {
                                    const res = await getUnsignedTx.mutateAsync({
                                      path: `/escrow/deal/${deal.id}/confirm-terms`,
                                    });
                                    if (res.txBase64) {
                                      const sig = await signAndSendTx(res.txBase64);
                                      await confirmTerms.mutateAsync({ escrowId: escrow.id, txSignature: sig });
                                    } else {
                                      await confirmTerms.mutateAsync({ escrowId: escrow.id, txSignature: 'skipped' });
                                    }
                                  } catch (err) {
                                    setEscrowError(err instanceof Error ? err.message : 'Confirm terms failed');
                                  } finally {
                                    setEscrowLoading(null);
                                  }
                                }}
                              >
                                {escrowLoading === 'confirm-terms' ? 'Đang ký...' : 'Seller: Confirm Terms'}
                              </Button>
                            ) : null}
                            {escrow.buyerConfirmed && escrow.sellerConfirmed && address === escrow.sellerAddress ? (
                              <Button
                                disabled={escrowLoading !== null}
                                onClick={async () => {
                                  setEscrowError(null);
                                  setEscrowLoading('submit-delivery');
                                  try {
                                    const res = await getUnsignedTx.mutateAsync({
                                      path: `/escrow/deal/${deal.id}/submit-delivery`,
                                    });
                                    const sig = await signAndSendTx(res.txBase64);
                                    await submitDelivery.mutateAsync({ escrowId: escrow.id, txSignature: sig });
                                  } catch (err) {
                                    setEscrowError(err instanceof Error ? err.message : 'Submit delivery failed');
                                  } finally {
                                    setEscrowLoading(null);
                                  }
                                }}
                              >
                                {escrowLoading === 'submit-delivery' ? 'Đang ký...' : 'Submit Delivery'}
                              </Button>
                            ) : null}
                            {escrow.deliverySubmitted && address === escrow.buyerAddress ? (
                              <Button
                                disabled={escrowLoading !== null}
                                onClick={async () => {
                                  setEscrowError(null);
                                  setEscrowLoading('release');
                                  try {
                                    const res = await getUnsignedTx.mutateAsync({
                                      path: `/escrow/${escrow.id}/release`,
                                    });
                                    const sig = await signAndSendTx(res.txBase64);
                                    await releaseEscrow.mutateAsync({ escrowId: escrow.id, txSignature: sig });
                                  } catch (err) {
                                    setEscrowError(err instanceof Error ? err.message : 'Release failed');
                                  } finally {
                                    setEscrowLoading(null);
                                  }
                                }}
                              >
                                {escrowLoading === 'release' ? 'Đang ký & gửi...' : 'Release (rút tiền)'}
                              </Button>
                            ) : null}
                            {address === escrow.buyerAddress && escrow.status === 'Funded' ? (
                              <Button
                                variant="secondary"
                                disabled={escrowLoading !== null}
                                onClick={async () => {
                                  setEscrowError(null);
                                  setEscrowLoading('refund');
                                  try {
                                    const res = await getUnsignedTx.mutateAsync({
                                      path: `/escrow/${escrow.id}/refund`,
                                    });
                                    const sig = await signAndSendTx(res.txBase64);
                                    await refundEscrow.mutateAsync({ escrowId: escrow.id, txSignature: sig });
                                  } catch (err) {
                                    setEscrowError(err instanceof Error ? err.message : 'Refund failed');
                                  } finally {
                                    setEscrowLoading(null);
                                  }
                                }}
                              >
                                {escrowLoading === 'refund' ? 'Đang ký & gửi...' : 'Refund (hoàn tiền)'}
                              </Button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <>
                      <Alert title="Chưa tạo escrow">
                        Tạo escrow trên Solana devnet để bắt đầu flow nạp tiền thật.
                      </Alert>
                      <Button
                        disabled={!deal.sellerWallet || createEscrow.isPending || !address}
                        onClick={async () => {
                          setEscrowError(null);
                          setEscrowLoading('create');
                          try {
                            const buyerWallet = address ?? '';
                            const sellerWallet = deal.sellerWallet ?? '';
                            if (!buyerWallet || buyerWallet.length < 32) {
                              throw new Error('Buyer wallet address is invalid. Please reconnect Phantom.');
                            }
                            if (!sellerWallet || sellerWallet.length < 32) {
                              throw new Error('Seller wallet address is invalid. Please invite seller first.');
                            }
                            const res = await createEscrow.mutateAsync({
                              dealId: deal.id,
                              amount: deal.amount,
                              sellerWallet,
                              buyerWallet,
                            });
                            const sig = await signAndSendTx(res.txBase64);
                            await confirmCreated.mutateAsync({ escrowId: res.escrow.id, txSignature: sig });
                          } catch (err) {
                            setEscrowError(err instanceof Error ? err.message : 'Create escrow failed');
                          } finally {
                            setEscrowLoading(null);
                          }
                        }}
                      >
                        {escrowLoading === 'create' ? 'Đang ký & tạo on-chain...' : 'Tạo escrow on-chain'}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Dispute Card */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle>Dispute flow</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    value={disputeReason}
                    onChange={(event) => setDisputeReason(event.target.value)}
                    placeholder="Reason"
                  />
                  <Textarea
                    rows={4}
                    value={disputeDescription}
                    onChange={(event) => setDisputeDescription(event.target.value)}
                    placeholder="Mô tả chi tiết tranh chấp"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        const dispute = await createDispute.mutateAsync({
                          dealId: deal.id,
                          reason: disputeReason,
                          description: disputeDescription,
                        });
                        router.push(`/disputes/${dispute.id}`);
                      }}
                    >
                      Mở dispute
                    </Button>
                    {currentDispute.data ? (
                      <Button
                        variant="ghost"
                        onClick={() =>
                          addEvidence.mutate({
                            type: 'text',
                            content: evidenceContent,
                          })
                        }
                      >
                        Add evidence
                      </Button>
                    ) : null}
                  </div>
                  <Textarea
                    rows={2}
                    value={evidenceContent}
                    onChange={(event) => setEvidenceContent(event.target.value)}
                    placeholder="Nội dung evidence text"
                  />
                  {(createDispute.error || addEvidence.error) ? (
                    <Alert variant="danger" title="Dispute action failed">
                      {(createDispute.error instanceof Error && createDispute.error.message) ||
                        (addEvidence.error instanceof Error && addEvidence.error.message) ||
                        'Lỗi không xác định.'}
                    </Alert>
                  ) : null}
                </CardContent>
              </Card>

              {/* Event Timeline Card */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle>Event timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {deal.events?.length ? (
                    deal.events.map((event) => (
                      <div key={event.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-zinc-100">{event.type}</p>
                          <p className="text-[11px] text-zinc-500">{formatRelativeTime(event.createdAt)}</p>
                        </div>
                        <p className="mt-1 text-[11px] font-mono text-zinc-500">
                          {shortAddress(event.actorWallet, 5, 5)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500">Chưa có timeline event.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </AppShell>
    </AuthGate>
  );
}
