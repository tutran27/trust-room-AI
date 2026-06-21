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
  CardDescription,
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
        subtitle="?i?u ph?i deal, meeting, escrow v? dispute trong m?t m?n h?nh g?n h?n."
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
            ) : deal ? (
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
            ) : null}
          </>
        }
      >
        {dealQuery.isLoading ? (
          <div className="grid gap-6">
            <Skeleton className="h-[820px] rounded-[32px]" />
          </div>
        ) : dealQuery.isError || !deal ? (
          <Alert variant="danger" title="Không tải được deal">
            {dealQuery.error instanceof Error ? dealQuery.error.message : 'Deal không tồn tại.'}
          </Alert>
        ) : (
          <div className="grid gap-6 2xl:grid-cols-[2.08fr_0.92fr]">
            <div className="space-y-6">
              <Card className="overflow-hidden border-emerald-500/15 bg-[linear-gradient(180deg,rgba(8,15,32,0.95),rgba(5,10,20,0.98))]">
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <CardTitle className="text-base">Deal overview</CardTitle>
                      <span className="text-xs text-slate-400">
                        Buyer {shortAddress(deal.buyerWallet, 4, 4)} · Seller{' '}
                        {deal.sellerWallet ? shortAddress(deal.sellerWallet, 4, 4) : 'chưa gán'} · v{deal.version}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        className="px-3 py-1.5 text-xs"
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
                          className="px-3 py-1.5 text-xs"
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
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[1.4fr_0.6fr]">
                    <Textarea
                      rows={2}
                      value={editDescription || deal.description || ''}
                      onChange={(event) => setEditDescription(event.target.value)}
                      placeholder="Cập nhật mô tả deal"
                    />

                    {!deal.sellerWallet ? (
                      <div className="flex flex-col gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
                        <p className="text-xs font-medium text-amber-200">Mời seller</p>
                        <Input
                          value={sellerWallet}
                          onChange={(event) => setSellerWallet(event.target.value)}
                          placeholder="Nhập wallet seller"
                        />
                        <Button
                          className="px-3 py-1.5 text-xs"
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
                    ) : (
                      <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
                        <p>deadline {formatDateTime(deal.deadline)}</p>
                        <p>updated {formatRelativeTime(deal.updatedAt)}</p>
                      </div>
                    )}
                  </div>

                  {(transitionDeal.error || updateDeal.error) ? (
                    <Alert variant="danger" title="Không thể cập nhật deal">
                      {(transitionDeal.error instanceof Error && transitionDeal.error.message) ||
                        (updateDeal.error instanceof Error && updateDeal.error.message) ||
                        'Lỗi không xác định.'}
                    </Alert>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="border-emerald-500/15 bg-slate-950/85">
                <CardHeader className="border-b border-white/10 pb-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                      <CardTitle className="text-xl">Deal room realtime + Scam Guard</CardTitle>
                      <CardDescription>
                        Khu vực chính để chat thương lượng, theo dõi scam signal và xem realtime updates theo bố cục rộng, dễ quét.
                      </CardDescription>
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
                      <div className="rounded-[30px] border border-emerald-500/20 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.15),transparent_38%),rgba(4,8,18,0.92)] p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-emerald-200">Realtime transcript/chat</p>
                            <p className="text-xs text-slate-400">
                              Nơi thương lượng chính. Scam Guard sẽ quan sát trực tiếp từ đây.
                            </p>
                          </div>
                          <Badge variant={live.connected ? 'success' : 'warning'}>
                            {live.connected ? 'live' : 'offline'}
                          </Badge>
                        </div>

                        <div className="max-h-[540px] space-y-3 overflow-y-auto pr-1">
                          {live.messages.length > 0 ? (
                            live.messages.map((message, index) => (
                              <div
                                key={`${message.timestamp}-${index}`}
                                className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4"
                              >
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="muted">{shortAddress(message.sender, 5, 5)}</Badge>
                                    <Badge variant="info">{message.speakerRole}</Badge>
                                  </div>
                                  <span>{formatRelativeTime(message.timestamp)}</span>
                                </div>
                                <p className="text-sm leading-6 text-slate-100">{message.message}</p>
                              </div>
                            ))
                          ) : (
                            <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-dashed border-emerald-500/20 bg-slate-950/30 p-8 text-center">
                              <div className="space-y-2">
                                <p className="text-lg font-medium text-slate-100">Chưa có transcript realtime</p>
                                <p className="text-sm leading-6 text-slate-400">
                                  Gửi một chat message để khởi động realtime monitor và feed dữ liệu cho Scam Guard.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="grid gap-3 xl:grid-cols-[1fr_auto]">
                          <Textarea
                            rows={4}
                            value={chatMessage}
                            onChange={(event) => setChatMessage(event.target.value)}
                            placeholder="Nhập nội dung thương lượng... ví dụ để thử Scam Guard: 'send me seed phrase' hoặc 'release trước đi'"
                          />
                          <div className="flex flex-col gap-3 xl:w-[180px]">
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
                      <div className="rounded-[28px] border border-red-500/15 bg-[linear-gradient(180deg,rgba(68,10,12,0.35),rgba(15,6,8,0.7))] p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-100">AI monitor</p>
                            <p className="text-xs text-slate-400">
                              Cảnh báo đang active sẽ được đẩy lên đầu để phản ứng nhanh.
                            </p>
                          </div>
                          <Badge variant={chatRiskSummary ? riskVariant(chatRiskSummary.level) : 'muted'}>
                            {chatRiskSummary?.level ?? 'idle'}
                          </Badge>
                        </div>

                        {chatRiskSummary ? (
                          <div className="space-y-3">
                            <p className="text-sm leading-6 text-slate-100">
                              {chatRiskSummary.reasons.join(' • ')}
                            </p>
                            <div className="rounded-2xl border border-red-500/15 bg-black/15 px-3 py-2">
                              <p className="text-xs uppercase tracking-[0.16em] text-red-300/80">
                                Trigger text
                              </p>
                              <p className="mt-1 text-sm text-slate-100">
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

                      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-100">Realtime updates</p>
                            <p className="text-xs text-slate-400">
                              Các chuyển động trạng thái và feed live liên quan đến deal.
                            </p>
                          </div>
                          <Badge variant="muted">{live.updates.length}</Badge>
                        </div>
                        {live.updates.length > 0 ? (
                          <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                            {live.updates.map((update, index) => (
                              <div
                                key={`${update.timestamp}-${index}`}
                                className="rounded-2xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-300"
                              >
                                <p className="font-medium text-slate-100">{update.kind ?? 'deal_update'}</p>
                                <p>
                                  {update.from
                                    ? `${update.from} -> ${update.to}`
                                    : update.status ?? 'No status payload'}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {formatRelativeTime(update.timestamp)}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">Chưa có cập nhật realtime.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              

              <Card className="border-white/10 bg-slate-950/70">
                <CardHeader className="pb-4">
                  <CardTitle>Escrow (Solana Devnet)</CardTitle>
                  <CardDescription>Giao dịch SOL thật trên devnet — cần Phantom wallet để ký.</CardDescription>
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
                        <span className="text-sm text-slate-300">
                          {formatAmount(escrow.amount, deal.token)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">Buyer: {shortAddress(escrow.buyerAddress, 6, 6)} {escrow.buyerConfirmed ? '✅' : '⏳'}</p>
                      <p className="text-xs text-slate-400">Seller: {shortAddress(escrow.sellerAddress, 6, 6)} {escrow.sellerConfirmed ? '✅' : '⏳'}</p>
                      {escrow.txSignature ? (
                        <a
                          href={`https://solscan.io/tx/${escrow.txSignature}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-400 underline"
                        >
                          Xem tx trên Solscan →
                        </a>
                      ) : null}
                      <div className="flex flex-wrap gap-3">
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
                                      // On-chain already confirmed by other party — just update DB
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
                                      // On-chain already confirmed by other party — just update DB
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
                            // Validate addresses before sending
                            if (!buyerWallet || buyerWallet.length < 32) {
                              throw new Error('Buyer wallet address is invalid. Please reconnect Phantom.');
                            }
                            if (!sellerWallet || sellerWallet.length < 32) {
                              throw new Error('Seller wallet address is invalid. Please invite seller first.');
                            }
                            // 1. API creates DB record + returns unsigned init tx
                            const res = await createEscrow.mutateAsync({
                              dealId: deal.id,
                              amount: deal.amount,
                              sellerWallet,
                              buyerWallet,
                            });
                            // 2. Sign with Phantom + send to devnet
                            const sig = await signAndSendTx(res.txBase64);
                            // 3. Confirm on backend
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

              <Card className="border-white/10 bg-slate-950/70">
                <CardHeader className="pb-4">
                  <CardTitle>Dispute flow</CardTitle>
                  <CardDescription>Mở dispute và thêm evidence mà không chiếm quá nhiều không gian.</CardDescription>
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
                  <div className="flex flex-wrap gap-3">
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

              <Card className="border-white/10 bg-slate-950/70">
                <CardHeader className="pb-4">
                  <CardTitle>Event timeline</CardTitle>
                  <CardDescription>Giữ dạng feed gọn để tra cứu biến động gần nhất của deal.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {deal.events?.length ? (
                    deal.events.map((event) => (
                      <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-slate-100">{event.type}</p>
                          <p className="text-xs text-slate-500">{formatRelativeTime(event.createdAt)}</p>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          actor: {shortAddress(event.actorWallet, 5, 5)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">Chưa có timeline event.</p>
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
