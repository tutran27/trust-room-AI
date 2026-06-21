'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
  Stat,
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
import { formatAmount, formatDateTime, formatRelativeTime, titleCaseStatus } from '../../../lib/format';
import { shortAddress } from '../../../lib/wallet';
import { useAuth } from '../../../providers/auth-provider';

const DEAL_ACTION_OPTIONS: Record<string, string[]> = {
  Draft: ['publish', 'cancel'],
  Created: ['open-invitation', 'cancel'],
  WaitingForCounterparty: ['verify-wallets', 'cancel'],
};

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
        subtitle="Đây là room điều phối chính: theo dõi trạng thái deal, realtime chat + Scam Guard, escrow mô phỏng và dispute flow."
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
            <Skeleton className="h-48 rounded-3xl" />
            <Skeleton className="h-96 rounded-3xl" />
          </div>
        ) : dealQuery.isError || !deal ? (
          <Alert variant="danger" title="Không tải được deal">
            {dealQuery.error instanceof Error ? dealQuery.error.message : 'Deal không tồn tại.'}
          </Alert>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <section className="grid gap-4 md:grid-cols-4">
                <Card><CardContent className="pt-6"><Stat label="Status" value={<StatusBadge value={deal.status} />} hint={`v${deal.version}`} /></CardContent></Card>
                <Card><CardContent className="pt-6"><Stat label="Amount" value={formatAmount(deal.amount, deal.token)} hint={titleCaseStatus(deal.type)} /></CardContent></Card>
                <Card><CardContent className="pt-6"><Stat label="Buyer" value={shortAddress(deal.buyerWallet, 5, 5)} hint="Chủ động chính" /></CardContent></Card>
                <Card><CardContent className="pt-6"><Stat label="Seller" value={shortAddress(deal.sellerWallet, 5, 5)} hint={deal.sellerWallet ? 'Đã gán' : 'Chưa mời'} /></CardContent></Card>
              </section>

              <Card>
                <CardHeader>
                  <CardTitle>Thông tin & lifecycle</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-300">{deal.description || 'Chưa có mô tả.'}</p>
                  <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                    <div>Created: {formatDateTime(deal.createdAt)}</div>
                    <div>Updated: {formatRelativeTime(deal.updatedAt)}</div>
                    <div>Deadline: {formatDateTime(deal.deadline)}</div>
                    <div>Socket: {live.connected ? 'Đã kết nối realtime' : 'Đang offline'}</div>
                  </div>

                  <div className="grid gap-3">
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
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="mb-3 font-medium text-slate-100">Mời seller</p>
                      <div className="flex flex-wrap gap-3">
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
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Deal room realtime + Scam Guard</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-dashed border-emerald-400/30 bg-emerald-500/5 p-4 text-sm text-slate-200">
                      {process.env.NEXT_PUBLIC_AGORA_APP_ID
                        ? 'Agora key đã có. Có thể nâng cấp panel call thật ở wave tiếp theo.'
                        : 'Chế độ demo call panel: chưa có Agora key, nên room này dùng chat transcript để drive realtime AI monitor.'}
                    </div>

                    <div className="max-h-[420px] space-y-3 overflow-auto rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                      {live.messages.length > 0 ? (
                        live.messages.map((message, index) => (
                          <div key={`${message.timestamp}-${index}`} className="rounded-xl bg-white/[0.03] p-3">
                            <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                              <span>{shortAddress(message.sender, 5, 5)} · {message.speakerRole}</span>
                              <span>{formatRelativeTime(message.timestamp)}</span>
                            </div>
                            <p className="text-sm text-slate-100">{message.message}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">
                          Chưa có transcript. Gửi một chat message để realtime monitor bắt đầu hoạt động.
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <Textarea
                        rows={3}
                        value={chatMessage}
                        onChange={(event) => setChatMessage(event.target.value)}
                        placeholder="Nhập nội dung thương lượng… ví dụ để thử Scam Guard: 'send me seed phrase' hoặc 'release trước đi'"
                      />
                      <div className="flex flex-col gap-3">
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
                  </div>

                  <div className="space-y-4">
                    <Card className="border-white/10 bg-white/[0.03]">
                      <CardHeader>
                        <CardTitle>AI monitor</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {chatRiskSummary ? (
                          <>
                            <StatusBadge value={chatRiskSummary.level} />
                            <p className="text-sm text-slate-300">{chatRiskSummary.reasons.join(' • ')}</p>
                            <p className="text-xs text-slate-500">
                              Trigger: {chatRiskSummary.triggerText}
                            </p>
                          </>
                        ) : (
                          <Alert title="Chưa có cảnh báo">Realtime Scam Guard sẽ đẩy event vào đây.</Alert>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-white/10 bg-white/[0.03]">
                      <CardHeader>
                        <CardTitle>Realtime updates</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {live.updates.length > 0 ? (
                          live.updates.map((update, index) => (
                            <div key={`${update.timestamp}-${index}`} className="rounded-xl border border-white/10 p-3 text-sm text-slate-300">
                              <p className="font-medium text-slate-100">{update.kind ?? 'deal_update'}</p>
                              <p>
                                {update.from ? `${update.from} → ${update.to}` : update.status ?? 'No status payload'}
                              </p>
                              <p className="text-xs text-slate-500">{formatRelativeTime(update.timestamp)}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-400">Chưa có cập nhật realtime.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Meeting room</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {meetingsQuery.isLoading ? (
                    <Skeleton className="h-24 rounded-2xl" />
                  ) : meetingsQuery.data?.length ? (
                    <>
                      {meetingsQuery.data.map((meeting) => (
                        <div key={meeting.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-100">{meeting.title}</p>
                              <p className="text-xs text-slate-400">
                                {meeting.status} • {meeting.participants?.length ?? 0} participant • created {formatRelativeTime(meeting.createdAt)}
                              </p>
                            </div>
                            <Link href={`/meetings/${meeting.id}`}>
                              <Button variant="secondary">Mở room</Button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </>
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
                      {createMeeting.error instanceof Error ? createMeeting.error.message : 'Lỗi không xác định.'}
                    </Alert>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Escrow demo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {escrow ? (
                    <>
                      <div className="flex items-center justify-between">
                        <StatusBadge value={escrow.status} />
                        <span className="text-sm text-slate-300">{formatAmount(escrow.amount, deal.token)}</span>
                      </div>
                      <p className="text-sm text-slate-300">Seller nhận: {shortAddress(escrow.sellerAddress, 5, 5)}</p>
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
                      <Alert title="Chưa tạo escrow">Tạo escrow mô phỏng để unlock flow payment/release/refund.</Alert>
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

              <Card>
                <CardHeader>
                  <CardTitle>Dispute flow</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="Reason" />
                  <Textarea
                    rows={4}
                    value={disputeDescription}
                    onChange={(e) => setDisputeDescription(e.target.value)}
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
                    onChange={(e) => setEvidenceContent(e.target.value)}
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

              <Card>
                <CardHeader>
                  <CardTitle>Event timeline</CardTitle>
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
