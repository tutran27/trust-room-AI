'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Stepper } from '@/components/ui/Stepper';
import {
  useAddEvidence,
  useConfirmEscrowCreated,
  useConfirmTerms,
  useCreateDispute,
  useCreateEscrow,
  useCreateMeeting,
  useDeleteDeal,
  useSubmitDelivery,
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
  useTermFiles,
  useUploadTermFile,
  useDeleteTermFile,
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
import {
  ChevronRight,
  Shield,
  Users,
  Clock,
  AlertTriangle,
  Video,
  Send,
  Scan,
  MessageSquare,
  Bot,
  ExternalLink,
  Wallet,
  FileText,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Zap,
} from 'lucide-react';

const DEAL_ACTION_OPTIONS: Record<string, string[]> = {
  Draft: ['publish', 'cancel'],
  Created: ['open-invitation', 'cancel'],
  WaitingForCounterparty: ['verify-wallets', 'cancel'],
};

function riskVariant(level?: string): 'danger' | 'warning' | 'info' | 'default' {
  const normalized = String(level ?? '').toLowerCase();
  if (normalized === 'critical' || normalized === 'high') return 'danger';
  if (normalized === 'medium') return 'warning';
  if (normalized === 'low') return 'info';
  return 'default';
}

function riskColor(level?: string) {
  const normalized = String(level ?? '').toLowerCase();
  if (normalized === 'critical' || normalized === 'high') return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500', iconBg: 'bg-red-100' };
  if (normalized === 'medium') return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500', iconBg: 'bg-amber-100' };
  return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', iconBg: 'bg-emerald-100' };
}

function explainRiskIntent(intent?: string) {
  switch (intent) {
    case 'move_off_platform':
      return {
        title: 'Yêu cầu chuyển qua nền tảng khác',
        explanation:
          'Có thể đối phương đang cố đưa bạn ra ngoài hệ thống để né escrow, né log hội thoại và tăng rủi ro lừa đảo.',
      };
    case 'early_release_request':
      return {
        title: 'Yêu cầu release sớm',
        explanation:
          'Đối phương đang thúc bạn giải ngân trước khi hàng hóa, dịch vụ hoặc bằng chứng hoàn tất được xác minh.',
      };
    case 'external_wallet':
      return {
        title: 'Yêu cầu gửi sang ví ngoài escrow',
        explanation:
          'Ví này không nằm trong deal đã xác minh. Nếu chuyển tiền ra ngoài, bạn có thể mất toàn bộ lớp bảo vệ của escrow.',
      };
    case 'fake_payment_proof':
      return {
        title: 'Bằng chứng thanh toán chưa đáng tin',
        explanation:
          'Hệ thống phát hiện dấu hiệu dùng ảnh chụp, bill hoặc xác nhận mơ hồ thay cho thanh toán đã được kiểm chứng thật.',
      };
    case 'credential_request':
      return {
        title: 'Yêu cầu thông tin nhạy cảm',
        explanation:
          'Không ai hợp lệ được phép xin seed phrase, private key, OTP hoặc quyền truy cập ví của bạn.',
      };
    case 'time_pressure':
      return {
        title: 'Đang tạo áp lực thời gian',
        explanation:
          'Việc hối thúc quá nhanh thường nhằm khiến bạn bỏ qua bước xác minh quan trọng trước khi giao dịch.',
      };
    default:
      return {
        title: 'Phát hiện tín hiệu rủi ro',
        explanation:
          'Nội dung hội thoại có dấu hiệu bất thường, bạn nên kiểm tra kỹ điều khoản và bằng chứng trước khi tiếp tục.',
      };
  }
}

/** Map escrow status to stepper index */
function escrowStepIndex(status?: string): number {
  switch (status) {
    case 'Created': return 0;
    case 'Funded': return 1;
    case 'TermsConfirmed': return 3;
    case 'DeliverySubmitted': return 4;
    case 'Released': return 5;
    case 'Refunded': return 5;
    default: return 0;
  }
}

const ESCROW_STEPS = [
  { label: 'Created', description: 'Escrow deployed' },
  { label: 'Funded', description: 'SOL deposited' },
  { label: 'Upload Terms', description: 'Seller uploads contract' },
  { label: 'Confirm', description: 'Both parties agree' },
  { label: 'Delivery', description: 'Seller submits' },
  { label: 'Release', description: 'Funds released' },
];

export default function DealDetailPage() {
  const params = useParams<{ id: string }>();
  const dealId = params?.id ?? null;
  const router = useRouter();
  const { address } = useAuth();
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const dealQuery = useDeal(dealId);
  const escrowQuery = useEscrowByDeal(dealId);
  const deal = dealQuery.data ?? null;
  const escrow = escrowQuery.data ?? null;
  const transitionDeal = useTransitionDeal(dealId ?? '');
  const inviteSeller = useInviteSeller(dealId ?? '');
  const updateDeal = useUpdateDeal(dealId ?? '');
  const createEscrow = useCreateEscrow();
  const createMeeting = useCreateMeeting();
  const deleteDeal = useDeleteDeal(dealId ?? '');
  const meetingsQuery = useMeetingsByDeal(dealId, Boolean(dealId && address));
  const termFilesQuery = useTermFiles(dealId);
  const uploadTermFile = useUploadTermFile(dealId ?? '');
  const deleteTermFile = useDeleteTermFile(dealId ?? '');
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
  const [termsUploadError, setTermsUploadError] = useState<string | null>(null);
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
  const liveRiskFeed = useMemo(() => live.riskEvents.slice(0, 8), [live.riskEvents]);
  const availableActions = deal ? DEAL_ACTION_OPTIONS[deal.status] ?? [] : [];
  const sendCurrentChatMessage = () => {
    if (!chatMessage.trim()) return;
    live.sendChatMessage(chatMessage);
    setChatMessage('');
  };

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
    }
  }, [live.messages]);

  return (
    <AppLayout>
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href="/deals" className="text-surface-400 hover:text-primary-600 transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            Deals
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-surface-300" />
          <span className="text-surface-700 font-medium truncate max-w-[200px]">{deal?.title ?? 'Loading...'}</span>
        </nav>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-surface-900 tracking-tight">{deal?.title ?? 'Deal Room'}</h1>
              {deal && <StatusBadge type="deal" status={deal.status} />}
            </div>
            <p className="mt-1.5 text-sm text-surface-500">
              {deal ? `Created ${formatDateTime(deal.createdAt)} · v${deal.version}` : 'Loading...'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/disputes">
              <Button variant="outline" size="sm">
                <AlertTriangle className="h-4 w-4 mr-1.5" />
                Disputes
              </Button>
            </Link>
            {meetingsQuery.data?.[0] ? (
              <Link href={`/meetings/${meetingsQuery.data[0].id}`}>
                <Button variant="primary" size="sm">
                  <Video className="h-4 w-4 mr-1.5" />
                  Join Meeting
                </Button>
              </Link>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={async () => {
                  const meeting = await createMeeting.mutateAsync({
                    dealId: deal!.id,
                    title: `${deal!.title} - Meeting`,
                  });
                  router.push(`/meetings/${meeting.id}`);
                }}
                disabled={createMeeting.isPending}
              >
                <Video className="h-4 w-4 mr-1.5" />
                {createMeeting.isPending ? 'Creating...' : 'Create Meeting'}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-danger-600 border-danger-200 hover:bg-danger-50"
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this deal?')) {
                  deleteDeal.mutate(undefined, {
                    onSuccess: () => router.push('/deals')
                  });
                }
              }}
              disabled={deleteDeal.isPending}
            >
              {deleteDeal.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>

        {dealQuery.isLoading ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-surface-100 animate-pulse" />
            ))}
          </div>
        ) : dealQuery.isError || !deal ? (
          <Card padding="lg">
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-7 w-7 text-red-500" />
              </div>
              <p className="text-red-600 font-semibold">Failed to load deal</p>
              <p className="text-sm text-surface-500 mt-1.5">
                {dealQuery.error instanceof Error ? dealQuery.error.message : 'Deal does not exist.'}
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            {/* Left Column: Main Content */}
            <div className="space-y-6">
              {/* Deal Overview */}
              <Card padding="lg">
                <h2 className="text-base font-semibold text-surface-900 mb-5 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary-500" />
                  Deal Overview
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <div className="rounded-xl bg-surface-50 border border-surface-200 p-3.5">
                    <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Buyer</p>
                    <p className="text-sm font-mono font-medium text-surface-800">{shortAddress(deal.buyerWallet, 6, 4)}</p>
                  </div>
                  <div className="rounded-xl bg-surface-50 border border-surface-200 p-3.5">
                    <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Seller</p>
                    {deal.sellerWallet ? (
                      <p className="text-sm font-mono font-medium text-surface-800">{shortAddress(deal.sellerWallet, 6, 4)}</p>
                    ) : (
                      <p className="text-sm text-surface-400 italic">Not assigned</p>
                    )}
                  </div>
                  <div className="rounded-xl bg-primary-50 border border-primary-100 p-3.5">
                    <p className="text-[11px] font-semibold text-primary-500 uppercase tracking-wider mb-1.5">Amount</p>
                    <p className="text-sm font-bold text-primary-700">{formatAmount(deal.amount, deal.token)}</p>
                  </div>
                  <div className="rounded-xl bg-surface-50 border border-surface-200 p-3.5">
                    <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Deadline</p>
                    <p className="text-sm font-medium text-surface-700">{formatDateTime(deal.deadline)}</p>
                  </div>
                </div>

                {/* Description */}
                <div className="mb-5">
                  <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-2">Description</p>
                  <p className="text-sm text-surface-600 leading-relaxed">
                    {deal.description || 'No description provided.'}
                  </p>
                </div>

                {/* Edit Description */}
                <div className="space-y-3">
                  <textarea
                    rows={3}
                    value={editDescription || deal.description || ''}
                    onChange={(event) => setEditDescription(event.target.value)}
                    placeholder="Update deal description..."
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-all resize-none"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        updateDeal.mutate({
                          expectedVersion: deal.version,
                          description: editDescription,
                        })
                      }
                      disabled={updateDeal.isPending}
                    >
                      Save Description
                    </Button>
                    {availableActions.map((action) => (
                      <Button
                        key={action}
                        variant="outline"
                        size="sm"
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
                    <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      <p className="text-sm text-red-700">
                        {(transitionDeal.error instanceof Error && transitionDeal.error.message) ||
                          (updateDeal.error instanceof Error && updateDeal.error.message) ||
                          'An error occurred.'}
                      </p>
                    </div>
                  ) : null}
                </div>

                {/* Invite Seller */}
                {!deal.sellerWallet ? (
                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-4 w-4 text-amber-600" />
                      <p className="text-sm font-semibold text-amber-800">Invite Seller</p>
                    </div>
                    <div className="flex gap-3">
                      <input
                        value={sellerWallet}
                        onChange={(event) => setSellerWallet(event.target.value)}
                        placeholder="Enter seller wallet address"
                        className="flex-1 rounded-xl border border-amber-200 bg-surface-50 px-4 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300 transition-all"
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() =>
                          inviteSeller.mutate({
                            sellerWallet,
                            expectedVersion: deal.version,
                          })
                        }
                        disabled={inviteSeller.isPending || !sellerWallet}
                      >
                        Invite
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl bg-emerald-50/50 border border-emerald-200 p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <p className="text-sm font-semibold text-emerald-800">Counterparty Ready</p>
                    </div>
                    <p className="text-sm text-emerald-700 mt-1 font-mono">
                      {shortAddress(deal.sellerWallet, 6, 4)}
                    </p>
                  </div>
                )}
              </Card>

              {/* Realtime Transcript + Scam Guard */}
              <Card padding="lg">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-semibold text-surface-900 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary-500" />
                      Deal Room & Scam Guard
                    </h2>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      live.connected
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-surface-100 text-surface-500 border border-surface-200'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${live.connected ? 'bg-emerald-500 animate-pulse' : 'bg-surface-400'}`} />
                      {live.connected ? 'Live' : 'Offline'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={chatRiskSummary ? riskVariant(chatRiskSummary.level) : 'default'}>
                      {chatRiskSummary ? `Risk: ${chatRiskSummary.level}` : 'No active alert'}
                    </Badge>
                    <Badge variant="default">{live.messages.length} msgs</Badge>
                  </div>
                </div>

                {detectScam.data ? (
                  <div className={`rounded-xl p-4 mb-5 border ${
                    detectScam.data.level === 'critical' || detectScam.data.level === 'high'
                      ? 'bg-red-50 border-red-200'
                      : detectScam.data.level === 'medium'
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-emerald-50 border-emerald-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Scan className={`h-4 w-4 ${
                        detectScam.data.level === 'critical' || detectScam.data.level === 'high'
                          ? 'text-red-600'
                          : detectScam.data.level === 'medium'
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                      }`} />
                      <p className={`text-sm font-semibold ${
                        detectScam.data.level === 'critical' || detectScam.data.level === 'high'
                          ? 'text-red-800'
                          : detectScam.data.level === 'medium'
                            ? 'text-amber-800'
                            : 'text-emerald-800'
                      }`}>
                        Scam Scan: {detectScam.data.level}
                      </p>
                    </div>
                    <p className="text-sm text-surface-600 mt-1.5 ml-6">
                      {detectScam.data.hits.length > 0
                        ? detectScam.data.hits.map((hit) => hit.rule.message).join(' | ')
                        : 'No notable hits.'}
                    </p>
                  </div>
                ) : null}

                <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
                  {/* Transcript Column */}
                  <div className="space-y-4">
                    <div className="rounded-xl border border-surface-200 bg-surface-50/50 p-4">
                      <p className="text-sm font-semibold text-surface-700 mb-3 flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-surface-400" />
                        Transcript
                        {live.connected ? (
                          <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-success-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-success-500" />
                            Live
                          </span>
                        ) : (
                          <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-surface-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-surface-300" />
                            Connecting...
                          </span>
                        )}
                      </p>
                      <div className="max-h-[600px] space-y-3 overflow-y-auto">
                        {live.messages.length > 0 ? (
                          live.messages.map((message, index) => (
                            <div
                              key={`${message.timestamp}-${index}`}
                              className="rounded-xl border border-surface-200 bg-surface-50 p-3.5"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-semibold text-surface-700">
                                    {shortAddress(message.sender, 5, 3)}
                                  </span>
                                  <Badge variant="info">{message.speakerRole}</Badge>
                                </div>
                                <span className="text-[11px] text-surface-400">
                                  {formatRelativeTime(message.timestamp)}
                                </span>
                              </div>
                              <p className="text-sm text-surface-800 leading-relaxed">{message.message}</p>
                            </div>
                          ))
                        ) : (
                          <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-dashed border-surface-300 p-8 text-center">
                            <div>
                              <div className="w-12 h-12 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-3">
                                <MessageSquare className="h-5 w-5 text-surface-400" />
                              </div>
                              <p className="text-sm font-medium text-surface-700">No transcript yet</p>
                              <p className="text-xs text-surface-500 mt-1">
                                Chat messages are sent in real-time. Both parties must be on this page to exchange messages.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Chat Input */}
                    <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
                      <div className="flex gap-3">
                        <textarea
                          rows={2}
                          value={chatMessage}
                          onChange={(event) => setChatMessage(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              sendCurrentChatMessage();
                            }
                          }}
                          placeholder="Type your negotiation message..."
                          className="flex-1 rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 resize-none transition-all"
                        />
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            onClick={sendCurrentChatMessage}
                            disabled={!chatMessage.trim()}
                          >
                            <Send className="h-3.5 w-3.5 mr-1" />
                            Send
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => detectScam.mutate({ text: chatMessage })}
                            disabled={!chatMessage.trim() || detectScam.isPending}
                          >
                            <Scan className="h-3.5 w-3.5 mr-1" />
                            Scan
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Monitor Column */}
                  <div className="space-y-4">
                    <div className={`rounded-xl border p-4 ${
                      chatRiskSummary
                        ? `${riskColor(chatRiskSummary.level).bg} ${riskColor(chatRiskSummary.level).border}`
                        : 'border-surface-200 bg-surface-50/50'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            chatRiskSummary ? riskColor(chatRiskSummary.level).iconBg : 'bg-surface-100'
                          }`}>
                            <Bot className={`h-4 w-4 ${chatRiskSummary ? riskColor(chatRiskSummary.level).text : 'text-surface-500'}`} />
                          </div>
                          <p className="text-sm font-semibold text-surface-700">AI Monitor</p>
                        </div>
                        <Badge variant={chatRiskSummary ? riskVariant(chatRiskSummary.level) : 'default'}>
                          {chatRiskSummary?.level ?? 'Idle'}
                        </Badge>
                      </div>
                      {liveRiskFeed.length ? (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                          {liveRiskFeed.map((riskEvent, index) => (
                            <div
                              key={`${riskEvent.timestamp}-${index}`}
                              className="rounded-xl border border-red-200 bg-surface-50 p-3.5"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <Badge variant={riskVariant(riskEvent.level)}>{riskEvent.level}</Badge>
                                <span className="text-[11px] text-surface-400">
                                  {formatRelativeTime(riskEvent.timestamp)}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-surface-800">
                                {explainRiskIntent(riskEvent.intents[0]).title}
                              </p>
                              <p className="text-xs text-surface-600 mt-1 leading-relaxed">
                                {explainRiskIntent(riskEvent.intents[0]).explanation}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <div className="w-10 h-10 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-2.5">
                            <Shield className="h-5 w-5 text-surface-400" />
                          </div>
                          <p className="text-sm font-medium text-surface-600">No alerts yet</p>
                          <p className="text-xs text-surface-400 mt-0.5">
                            Realtime Scam Guard will push events here.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Realtime Updates */}
                    <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-surface-700 flex items-center gap-2">
                          <Zap className="h-3.5 w-3.5 text-surface-400" />
                          Realtime Updates
                        </p>
                      <Badge variant="default">{live.updates.length}</Badge>
                      </div>
                      {live.updates.length > 0 ? (
                        <div className="max-h-[250px] space-y-2 overflow-y-auto">
                          {live.updates.map((update, index) => (
                            <div
                              key={`${update.timestamp}-${index}`}
                              className="rounded-xl bg-surface-50 p-3 border border-surface-200"
                            >
                              <p className="text-xs font-semibold text-surface-700">{update.kind ?? 'deal_update'}</p>
                              <p className="text-xs text-surface-500 mt-0.5">
                                {update.from
                                  ? `${update.from} → ${update.to}`
                                  : update.status ?? 'No status payload'}
                              </p>
                              <p className="text-[10px] text-surface-400 mt-1">
                                {formatRelativeTime(update.timestamp)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-surface-400 text-center py-4">No updates yet</p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Right Column: Sidebar */}
            <div className="space-y-6">
              {/* Escrow Card with Stepper */}
              <Card padding="lg">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
                      <Wallet className="h-4.5 w-4.5 text-primary-600" />
                    </div>
                    <h2 className="text-base font-semibold text-surface-900">Escrow</h2>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span className="text-[11px] font-semibold text-blue-700">Solana Devnet</span>
                  </div>
                </div>

                {escrowError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3 mb-4 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-700">{escrowError}</p>
                  </div>
                )}

                {!isPhantomInstalled() && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 mb-4">
                    <p className="text-sm text-amber-800">
                      <a href="https://phantom.app/" target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                        Install Phantom
                      </a>{' '}
                      to sign Solana transactions.
                    </p>
                  </div>
                )}

                {escrow ? (
                  <div className="space-y-5">
                    {/* Escrow Stepper */}
                    <div className="rounded-xl bg-surface-50 border border-surface-200 p-4">
                      <Stepper
                        steps={ESCROW_STEPS}
                        currentStep={escrow.status === 'Refunded' ? -1 : escrowStepIndex(escrow.status)}
                      />
                    </div>

                    {/* Escrow Info */}
                    <div className="rounded-xl bg-surface-50 border border-surface-200 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <StatusBadge type="escrow" status={escrow.status} />
                        <span className="text-sm font-bold text-surface-900">
                          {formatAmount(escrow.amount, deal.token)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg bg-surface-50 border border-surface-200 p-2.5">
                          <p className="text-surface-400 mb-1 font-medium">Buyer</p>
                          <p className="font-mono font-semibold text-surface-700 text-[11px]">{shortAddress(escrow.buyerAddress, 6, 4)}</p>
                          <span className={`mt-1 inline-flex items-center gap-1 text-[11px] font-medium ${escrow.buyerConfirmed ? 'text-emerald-600' : 'text-surface-400'}`}>
                            {escrow.buyerConfirmed ? '✅ Confirmed' : '⏳ Pending'}
                          </span>
                        </div>
                        <div className="rounded-lg bg-surface-50 border border-surface-200 p-2.5">
                          <p className="text-surface-400 mb-1 font-medium">Seller</p>
                          <p className="font-mono font-semibold text-surface-700 text-[11px]">{shortAddress(escrow.sellerAddress, 6, 4)}</p>
                          <span className={`mt-1 inline-flex items-center gap-1 text-[11px] font-medium ${escrow.sellerConfirmed ? 'text-emerald-600' : 'text-surface-400'}`}>
                            {escrow.sellerConfirmed ? '✅ Confirmed' : '⏳ Pending'}
                          </span>
                        </div>
                      </div>
                      {escrow.txSignature && (
                        <a
                          href={`https://solscan.io/tx/${escrow.txSignature}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-semibold transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View on Solscan
                        </a>
                      )}
                    </div>

                    {/* Terms / Contract Files */}
                    {(escrow.status === 'Funded' || escrow.status === 'TermsConfirmed') && (
                      <div className="rounded-xl bg-surface-50 border border-surface-200 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary-500" />
                          <p className="text-sm font-semibold text-surface-900">Terms & Contract</p>
                        </div>

                        {/* List uploaded files */}
                        {termFilesQuery.data && termFilesQuery.data.length > 0 && (
                          <div className="space-y-2">
                            {termFilesQuery.data.map((f) => (
                              <div key={f.id} className="flex items-center justify-between rounded-lg bg-surface-50 border border-surface-200 p-2.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="h-4 w-4 text-surface-400 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-surface-800 truncate">{f.originalName}</p>
                                    <p className="text-xs text-surface-400">{(f.fileSize / 1024).toFixed(1)} KB · {f.mimeType}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <a
                                    href={`/api/deals/${dealId}/terms/${f.id}/download`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Download
                                  </a>
                                  {address === f.uploadedBy && (
                                    <button
                                      onClick={() => deleteTermFile.mutate(f.id)}
                                      className="p-1.5 text-xs text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                                      title="Delete file"
                                    >
                                      <span className="text-lg leading-none">&times;</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Upload form — seller only */}
                        {address === escrow.sellerAddress && (
                          <div>
                            <label className="flex flex-col items-center justify-center border-2 border-dashed border-surface-300 rounded-xl p-4 cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-all">
                              <FileText className="h-6 w-6 text-surface-400 mb-1" />
                              <p className="text-sm font-medium text-surface-600">Upload terms / contract file</p>
                              <p className="text-xs text-surface-400 mt-0.5">PDF, DOCX, images — max 10 MB</p>
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setTermsUploadError(null);
                                  try {
                                    await uploadTermFile.mutateAsync(file);
                                  } catch (err) {
                                    setTermsUploadError(err instanceof Error ? err.message : 'Upload failed');
                                  }
                                  e.target.value = '';
                                }}
                                disabled={uploadTermFile.isPending}
                              />
                            </label>
                            {uploadTermFile.isPending && (
                              <p className="text-xs text-primary-600 mt-1.5 text-center">Uploading...</p>
                            )}
                            {termsUploadError && (
                              <p className="text-xs text-danger-600 mt-1.5">{termsUploadError}</p>
                            )}
                          </div>
                        )}

                        {/* Buyer notice when files exist but none uploaded */}
                        {address === escrow.buyerAddress && termFilesQuery.data && termFilesQuery.data.length === 0 && (
                          <p className="text-xs text-surface-400 text-center py-2">Waiting for seller to upload terms...</p>
                        )}
                      </div>
                    )}

                    {/* Escrow Actions */}
                    <div className="space-y-2.5">
                      {escrow.status === 'Created' && address === escrow.buyerAddress && (
                        <Button
                          className="w-full"
                          onClick={async () => {
                            setEscrowError(null);
                            setEscrowLoading('fund');
                            try {
                              const res = await getUnsignedTx.mutateAsync({ path: `/escrow/${escrow.id}/fund` });
                              const sig = await signAndSendTx(res.txBase64);
                              await fundEscrow.mutateAsync({ escrowId: escrow.id, txSignature: sig });
                            } catch (err) {
                              setEscrowError(err instanceof Error ? err.message : 'Fund failed');
                            } finally {
                              setEscrowLoading(null);
                            }
                          }}
                          disabled={escrowLoading !== null}
                        >
                          <Wallet className="h-4 w-4 mr-1.5" />
                          {escrowLoading === 'fund' ? 'Signing...' : 'Fund Escrow'}
                        </Button>
                      )}

                      {escrow.status !== 'Created' && (
                        <>
                          {address === escrow.buyerAddress && !escrow.buyerConfirmed && (
                            <Button
                              className="w-full"
                              onClick={async () => {
                                setEscrowError(null);
                                setEscrowLoading('confirm-terms');
                                try {
                                  const res = await getUnsignedTx.mutateAsync({ path: `/escrow/deal/${deal.id}/confirm-terms` });
                                  if (res.txBase64) {
                                    const sig = await signAndSendTx(res.txBase64);
                                    await confirmTerms.mutateAsync({ escrowId: escrow.id, txSignature: sig });
                                  } else {
                                    await confirmTerms.mutateAsync({ escrowId: escrow.id, txSignature: 'skipped' });
                                  }
                                } catch (err) {
                                  setEscrowError(err instanceof Error ? err.message : 'Confirm failed');
                                } finally {
                                  setEscrowLoading(null);
                                }
                              }}
                              disabled={escrowLoading !== null || !termFilesQuery.data?.length}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1.5" />
                              {escrowLoading === 'confirm-terms' ? 'Signing...' : 'Buyer: Confirm Terms'}
                            </Button>
                          )}
                          {address === escrow.sellerAddress && !escrow.sellerConfirmed && (
                            <Button
                              className="w-full"
                              onClick={async () => {
                                setEscrowError(null);
                                setEscrowLoading('confirm-terms');
                                try {
                                  const res = await getUnsignedTx.mutateAsync({ path: `/escrow/deal/${deal.id}/confirm-terms` });
                                  if (res.txBase64) {
                                    const sig = await signAndSendTx(res.txBase64);
                                    await confirmTerms.mutateAsync({ escrowId: escrow.id, txSignature: sig });
                                  } else {
                                    await confirmTerms.mutateAsync({ escrowId: escrow.id, txSignature: 'skipped' });
                                  }
                                } catch (err) {
                                  setEscrowError(err instanceof Error ? err.message : 'Confirm failed');
                                } finally {
                                  setEscrowLoading(null);
                                }
                              }}
                              disabled={escrowLoading !== null || !termFilesQuery.data?.length}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1.5" />
                              {escrowLoading === 'confirm-terms' ? 'Signing...' : 'Seller: Confirm Terms'}
                            </Button>
                          )}
                          {escrow.buyerConfirmed && escrow.sellerConfirmed && !escrow.deliverySubmitted && address === escrow.buyerAddress && (
                            <div className="rounded-xl bg-brand-50 border border-brand-200 p-4 text-center">
                              <p className="text-sm font-medium text-brand-800">Both parties confirmed terms</p>
                              <p className="text-xs text-brand-600 mt-1">Waiting for seller to submit delivery proof.</p>
                            </div>
                          )}
                          {escrow.buyerConfirmed && escrow.sellerConfirmed && address === escrow.sellerAddress && (
                            <Button
                              className="w-full"
                              onClick={async () => {
                                setEscrowError(null);
                                setEscrowLoading('submit-delivery');
                                try {
                                  const res = await getUnsignedTx.mutateAsync({ path: `/escrow/deal/${deal.id}/submit-delivery` });
                                  const sig = await signAndSendTx(res.txBase64);
                                  await submitDelivery.mutateAsync({ escrowId: escrow.id, txSignature: sig });
                                } catch (err) {
                                  setEscrowError(err instanceof Error ? err.message : 'Submit delivery failed');
                                } finally {
                                  setEscrowLoading(null);
                                }
                              }}
                              disabled={escrowLoading !== null}
                            >
                              <Send className="h-4 w-4 mr-1.5" />
                              {escrowLoading === 'submit-delivery' ? 'Signing...' : 'Submit Delivery'}
                            </Button>
                          )}
                          {escrow.deliverySubmitted && address === escrow.buyerAddress && (
                            <Button
                              className="w-full"
                              onClick={async () => {
                                setEscrowError(null);
                                setEscrowLoading('release');
                                try {
                                  const res = await getUnsignedTx.mutateAsync({ path: `/escrow/${escrow.id}/release` });
                                  const sig = await signAndSendTx(res.txBase64);
                                  await releaseEscrow.mutateAsync({ escrowId: escrow.id, txSignature: sig });
                                } catch (err) {
                                  setEscrowError(err instanceof Error ? err.message : 'Release failed');
                                } finally {
                                  setEscrowLoading(null);
                                }
                              }}
                              disabled={escrowLoading !== null}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1.5" />
                              {escrowLoading === 'release' ? 'Signing...' : 'Release Funds'}
                            </Button>
                          )}
                          {address === escrow.buyerAddress && escrow.status === 'Funded' && (
                            <Button
                              className="w-full"
                              variant="outline"
                              onClick={async () => {
                                setEscrowError(null);
                                setEscrowLoading('refund');
                                try {
                                  const res = await getUnsignedTx.mutateAsync({ path: `/escrow/${escrow.id}/refund` });
                                  const sig = await signAndSendTx(res.txBase64);
                                  await refundEscrow.mutateAsync({ escrowId: escrow.id, txSignature: sig });
                                } catch (err) {
                                  setEscrowError(err instanceof Error ? err.message : 'Refund failed');
                                } finally {
                                  setEscrowLoading(null);
                                }
                              }}
                              disabled={escrowLoading !== null}
                            >
                              {escrowLoading === 'refund' ? 'Signing...' : 'Refund'}
                            </Button>
                          )}
                        </>
                      )}

                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
                      <Wallet className="h-6 w-6 text-surface-400" />
                    </div>
                    <p className="text-sm font-semibold text-surface-700 mb-1">No escrow created</p>
                    <p className="text-xs text-surface-500 mb-5">
                      Create an escrow on Solana devnet to start the fund flow.
                    </p>
                    <Button
                      className="w-full"
                      onClick={async () => {
                        setEscrowError(null);
                        setEscrowLoading('create');
                        try {
                          const buyerWallet = address ?? '';
                          const sellerWalletVal = deal.sellerWallet ?? '';
                          if (!buyerWallet || buyerWallet.length < 32) {
                            throw new Error('Buyer wallet address is invalid. Please reconnect Phantom.');
                          }
                          if (!sellerWalletVal || sellerWalletVal.length < 32) {
                            throw new Error('Seller wallet address is invalid. Please invite seller first.');
                          }
                          const res = await createEscrow.mutateAsync({
                            dealId: deal.id,
                            amount: deal.amount,
                            sellerWallet: sellerWalletVal,
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
                      disabled={!deal.sellerWallet || createEscrow.isPending || !address}
                    >
                      <Wallet className="h-4 w-4 mr-1.5" />
                      {escrowLoading === 'create' ? 'Creating on-chain...' : 'Create Escrow'}
                    </Button>
                  </div>
                )}
              </Card>

              {/* Dispute Card */}
              <Card padding="lg">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                    <AlertTriangle className="h-4.5 w-4.5 text-red-600" />
                  </div>
                  <h2 className="text-base font-semibold text-surface-900">Dispute</h2>
                </div>
                <div className="space-y-3">
                  <input
                    value={disputeReason}
                    onChange={(event) => setDisputeReason(event.target.value)}
                    placeholder="Reason"
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-all"
                  />
                  <textarea
                    rows={3}
                    value={disputeDescription}
                    onChange={(event) => setDisputeDescription(event.target.value)}
                    placeholder="Describe the dispute in detail..."
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-all resize-none"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={async () => {
                        const dispute = await createDispute.mutateAsync({
                          dealId: deal.id,
                          reason: disputeReason,
                          description: disputeDescription,
                        });
                        router.push(`/disputes/${dispute.id}`);
                      }}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                      Open Dispute
                    </Button>
                    {currentDispute.data && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          addEvidence.mutate({
                            type: 'text',
                            content: evidenceContent,
                          })
                        }
                      >
                        <FileText className="h-3.5 w-3.5 mr-1" />
                        Add Evidence
                      </Button>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    value={evidenceContent}
                    onChange={(event) => setEvidenceContent(event.target.value)}
                    placeholder="Evidence content..."
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-all resize-none"
                  />
                  {(createDispute.error || addEvidence.error) && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      <p className="text-sm text-red-700">
                        {(createDispute.error instanceof Error && createDispute.error.message) ||
                          (addEvidence.error instanceof Error && addEvidence.error.message) ||
                          'An error occurred.'}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}