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
  useCreateDispute,
  useCreateEscrow,
  useCreateMeeting,
  useDeal,
  useDetectScam,
  useDispute,
  useEscrowByDeal,
  useFundEscrow,
  useMeetingsByDeal,
  useInviteSeller,
  useRefundEscrow,
  useReleaseEscrow,
  useTransitionDeal,
  useUpdateDeal,
} from '../../../hooks/use-api';
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

  const activeDisputeId = deal?.status === 'Disputed' ? undefined : undefined;
  const currentDispute = useDispute(activeDisputeId ?? null);
  const addEvidence = useAddEvidence(currentDispute.data?.id ?? '');

  const chatRiskSummary = useMemo(() => live.riskEvents[0] ?? null, [live.riskEvents]);
  const availableActions = deal ? DEAL_ACTION_OPTIONS[deal.status] ?? [] : [];

  return (
    <AuthGate>
      <AppShell
        title={deal?.title ?? 'Deal room'}
        subtitle="Bảng điều phối deal theo thời gian thực: tập trung vào chat, Scam Guard, meeting room và các hành động quỹ/dispute quan trọng."
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
                <CardHeader className="border-b border-white/10 pb-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge value={deal.status} />
                        <Badge variant="muted">{formatAmount(deal.amount, deal.token)}</Badge>
                        <Badge variant="muted">{titleCaseStatus(deal.type)}</Badge>
                        <Badge variant={live.connected ? 'success' : 'warning'}>
                          {live.connected ? 'realtime connected' : 'offline'}
                        </Badge>
                      </div>
                      <div>
                        <CardTitle className="text-2xl">Deal overview</CardTitle>
                        <CardDescription>
                          Tập trung lại thông tin cốt lõi của deal và các hành động lifecycle quan trọng, tránh dàn trải nhiều khối nhỏ.
                        </CardDescription>
                      </div>
                    </div>
                    <div className="grid gap-2 text-sm text-slate-300 xl:text-right">
                      <p>Buyer: {shortAddress(deal.buyerWallet, 5, 5)}</p>
                      <p>
                        Seller:{' '}
                        {deal.sellerWallet ? shortAddress(deal.sellerWallet, 5, 5) : 'chưa gán'}
                      </p>
                      <p>Created: {formatDateTime(deal.createdAt)}</p>
                      <p>Updated: {formatRelativeTime(deal.updatedAt)}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-5 pt-6 xl:grid-cols-[1.2fr_0.8fr]">
                  <div className="space-y-4">
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                      <p className="mb-2 text-sm font-medium text-slate-100">Mô tả deal</p>
                      <p className="text-sm leading-6 text-slate-300">
                        {deal.description || 'Chưa có mô tả.'}
                      </p>
                    </div>

                    <Textarea
                      rows={4}
                      value={editDescription || deal.description || ''}
                      onChange={(event) => setEditDescription(event.target.value)}
                      placeholder="Cập nhật mô tả deal"
                    />

                    <div className="flex flex-wrap gap-3">
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
                    <div className="rounded-[28px] border border-amber-500/20 bg-amber-500/5 p-4">
                      <p className="mb-3 text-sm font-medium text-amber-200">Mời seller</p>
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
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-sm font-medium text-slate-100">Counterparty ready</p>
                      <p className="mt-2 text-sm text-slate-300">
                        Seller hiện tại là {shortAddress(deal.sellerWallet, 5, 5)}.
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Version v{deal.version} • deadline {formatDateTime(deal.deadline)}
                      </p>
                    </div>
                  )}
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
                  <CardTitle>Meeting room</CardTitle>
                  <CardDescription>
                    Nơi chuyển sang phòng họp voice/video đầy đủ khi deal sẵn sàng vào phiên riêng.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {meetingsQuery.isLoading ? (
                    <Skeleton className="h-24 rounded-2xl" />
                  ) : meetingsQuery.data?.length ? (
                    meetingsQuery.data.map((meeting) => (
                      <div key={meeting.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-100">{meeting.title}</p>
                            <p className="text-xs text-slate-400">
                              {meeting.status} • {meeting.participants?.length ?? 0} participant • created{' '}
                              {formatRelativeTime(meeting.createdAt)}
                            </p>
                          </div>
                          <Link href={`/meetings/${meeting.id}`}>
                            <Button variant="secondary">Mở room</Button>
                          </Link>
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      <Alert title="Chưa có meeting room">
                        Tạo meeting riêng cho deal này để lấy invite link, participant list, transcript và Agora token.
                      </Alert>
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
                        Tạo meeting room
                      </Button>
                    </>
                  )}
                  {createMeeting.error ? (
                    <Alert variant="danger" title="Không thể tạo meeting">
                      {createMeeting.error instanceof Error
                        ? createMeeting.error.message
                        : 'Lỗi không xác định.'}
                    </Alert>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-slate-950/70">
                <CardHeader className="pb-4">
                  <CardTitle>Escrow demo</CardTitle>
                  <CardDescription>Giữ lại các action quỹ quan trọng nhưng hiển thị gọn hơn.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {escrow ? (
                    <>
                      <div className="flex items-center justify-between">
                        <StatusBadge value={escrow.status} />
                        <span className="text-sm text-slate-300">
                          {formatAmount(escrow.amount, deal.token)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300">
                        Seller nhận: {shortAddress(escrow.sellerAddress, 5, 5)}
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {escrow.status === 'Created' ? (
                          <Button onClick={() => fundEscrow.mutate(escrow.id)}>Fund</Button>
                        ) : null}
                        {escrow.status === 'Funded' ? (
                          <>
                            <Button onClick={() => releaseEscrow.mutate(escrow.id)}>Release</Button>
                            <Button variant="secondary" onClick={() => refundEscrow.mutate(escrow.id)}>
                              Refund
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <>
                      <Alert title="Chưa tạo escrow">
                        Tạo escrow mô phỏng để mở khóa flow payment/release/refund.
                      </Alert>
                      <Button
                        onClick={() =>
                          createEscrow.mutate({
                            dealId: deal.id,
                            amount: deal.amount,
                            sellerWallet: deal.sellerWallet ?? '',
                          })
                        }
                        disabled={!deal.sellerWallet || createEscrow.isPending}
                      >
                        Tạo escrow
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
