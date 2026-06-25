'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getToken, API_BASE } from '../lib/api-client';
import type {
  AgoraTokenResult,
  Deal,
  Dispute,
  Escrow,
  EscrowActionResult,
  EvidenceRecord,
  MeetingInviteRecord,
  MeetingRiskEventRecord,
  MeetingSessionRecord,
  MeetingSttStateRecord,
  MeetingTranscriptRecord,
  NotificationRecord,
  Paginated,
  ReputationRecord,
  TermFile,
} from '../lib/api-types';

// ── Deals ──────────────────────────────────────────────
export function useDeals(status?: string, enabled = true) {
  return useQuery({
    queryKey: ['deals', status ?? 'all'],
    queryFn: () =>
      apiFetch<Paginated<Deal>>(`/deals${status ? `?status=${encodeURIComponent(status)}` : ''}`),
    enabled,
    retry: 2,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

export function useDeal(id: string | null) {
  return useQuery({
    queryKey: ['deal', id],
    queryFn: () => apiFetch<Deal>(`/deals/${id}`),
    enabled: Boolean(id),
  });
}

export function useUpdateDeal(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      expectedVersion: number;
      title?: string;
      description?: string;
      amount?: string;
      deadline?: string;
    }) => apiFetch<Deal>(`/deals/${dealId}`, { method: 'PATCH', body: input }),
    onSuccess: (deal) => {
      qc.setQueryData(['deal', dealId], deal);
      qc.invalidateQueries({ queryKey: ['deals'] });
    },
  });
}

export interface CreateDealInput {
  title: string;
  description?: string;
  type: string;
  amount: string;
  token: string;
  deadline?: string;
  counterpartyWallet?: string;
  role?: 'buyer' | 'seller';
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDealInput) =>
      apiFetch<Deal>('/deals', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}

export function useTransitionDeal(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { action: string; expectedVersion: number; reason?: string }) =>
      apiFetch<Deal>(`/deals/${dealId}/actions`, { method: 'POST', body: input }),
    onSuccess: (deal) => {
      qc.setQueryData(['deal', dealId], deal);
      qc.invalidateQueries({ queryKey: ['deals'] });
    },
  });
}

export function useInviteSeller(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sellerWallet: string; expectedVersion: number }) =>
      apiFetch<Deal>(`/deals/${dealId}/invite`, { method: 'POST', body: input }),
    onSuccess: (deal) => qc.setQueryData(['deal', dealId], deal),
  });
}



export function useDeleteDeal(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean }>(`/deals/${dealId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.removeQueries({ queryKey: ['deal', dealId] });
    },
  });
}

// ── Escrow ─────────────────────────────────────────────
export function useEscrowByDeal(dealId: string | null) {
  return useQuery({
    queryKey: ['escrow', dealId],
    queryFn: () => apiFetch<Escrow>(`/escrow/deal/${dealId}`).catch(() => null),
    enabled: Boolean(dealId),
  });
}

export function useCreateEscrow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { dealId: string; amount: string; sellerWallet: string; buyerWallet: string; tokenMint?: string }) =>
      apiFetch<EscrowActionResult>('/escrow', { method: 'POST', body: input }),
    onSuccess: (res) => qc.invalidateQueries({ queryKey: ['escrow', res.escrow.dealId] }),
  });
}

export function useConfirmEscrowCreated() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ escrowId, txSignature }: { escrowId: string; txSignature: string }) =>
      apiFetch<EscrowActionResult>(`/escrow/${escrowId}/confirm-created`, {
        method: 'POST',
        body: { txSignature },
      }),
    onSuccess: (res) => qc.invalidateQueries({ queryKey: ['escrow', res.escrow.dealId] }),
  });
}

export function useFundEscrow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ escrowId, txSignature }: { escrowId: string; txSignature: string }) =>
      apiFetch<EscrowActionResult>(`/escrow/${escrowId}/confirm-funded`, {
        method: 'POST',
        body: { txSignature },
      }),
    onSuccess: (res) => qc.invalidateQueries({ queryKey: ['escrow', res.escrow.dealId] }),
  });
}

export function useReleaseEscrow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ escrowId, txSignature }: { escrowId: string; txSignature: string }) =>
      apiFetch<EscrowActionResult>(`/escrow/${escrowId}/confirm-released`, {
        method: 'POST',
        body: { txSignature },
      }),
    onSuccess: (res) => qc.invalidateQueries({ queryKey: ['escrow', res.escrow.dealId] }),
  });
}

export function useRefundEscrow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ escrowId, txSignature }: { escrowId: string; txSignature: string }) =>
      apiFetch<EscrowActionResult>(`/escrow/${escrowId}/confirm-refunded`, {
        method: 'POST',
        body: { txSignature },
      }),
    onSuccess: (res) => qc.invalidateQueries({ queryKey: ['escrow', res.escrow.dealId] }),
  });
}

export function useGetUnsignedTx() {
  return useMutation({
    mutationFn: async ({ path }: { path: string }) =>
      apiFetch<{ txBase64: string; [key: string]: unknown }>(path, { method: 'POST', body: {} }),
  });
}

export function useConfirmTerms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ escrowId, txSignature }: { escrowId: string; txSignature: string }) =>
      apiFetch<EscrowActionResult>(`/escrow/${escrowId}/confirm-terms-done`, {
        method: 'POST',
        body: { txSignature },
      }),
    onSuccess: (res) => qc.invalidateQueries({ queryKey: ['escrow', res.escrow.dealId] }),
  });
}

export function useSellerAcceptDeal(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { expectedVersion: number }) =>
      apiFetch<Deal>(`/deals/${dealId}/actions`, {
        method: 'POST',
        body: { action: 'verify-wallets', expectedVersion: input.expectedVersion },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deal', dealId] });
    },
  });
}

export function useSubmitDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ escrowId, txSignature }: { escrowId: string; txSignature: string }) =>
      apiFetch<EscrowActionResult>(`/escrow/${escrowId}/submit-delivery-done`, {
        method: 'POST',
        body: { txSignature },
      }),
    onSuccess: (res) => qc.invalidateQueries({ queryKey: ['escrow', res.escrow.dealId] }),
  });
}

// ── Terms / Contract Files ─────────────────────────────
export function useUploadTermFile(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const token = getToken();
      const res = await fetch(
        `${API_BASE}/deals/${dealId}/terms/upload`,
        {
          method: 'POST',
          headers: token ? { authorization: `Bearer ${token}` } : {},
          body: formData,
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error?.message || 'Upload failed');
      }
      return res.json() as Promise<TermFile>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['term-files', dealId] });
    },
  });
}

export function useTermFiles(dealId: string | null) {
  return useQuery({
    queryKey: ['term-files', dealId],
    queryFn: () => apiFetch<TermFile[]>(`/deals/${dealId}/terms`),
    enabled: Boolean(dealId),
    refetchInterval: 30_000,
  });
}

export function useDeleteTermFile(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fileId: string) =>
      apiFetch<{ success: boolean }>(`/deals/${dealId}/terms/${fileId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['term-files', dealId] });
    },
  });
}

// ── Disputes & evidence ────────────────────────────────
export function useDisputes() {
  return useQuery({
    queryKey: ['disputes'],
    queryFn: () => apiFetch<Dispute[]>('/disputes'),
  });
}

export function useDispute(id: string | null) {
  return useQuery({
    queryKey: ['dispute', id],
    queryFn: () => apiFetch<Dispute>(`/disputes/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateDispute() {
  const qc = useQueryClient();
  return useMutation({
    // API requires description (min 10 chars) + reason (min 3 chars).
    mutationFn: (input: { dealId: string; reason: string; description: string }) =>
      apiFetch<Dispute>('/disputes', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['disputes'] }),
  });
}

export function useAddEvidence(disputeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: string; content: string; url?: string }) =>
      apiFetch<EvidenceRecord>(`/disputes/${disputeId}/evidence`, { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dispute', disputeId] }),
  });
}

export function useResolveDispute(disputeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { resolution: string }) =>
      apiFetch<Dispute>(`/disputes/${disputeId}/resolve`, { method: 'POST', body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dispute', disputeId] });
      qc.invalidateQueries({ queryKey: ['disputes'] });
    },
  });
}

// ── Notifications ──────────────────────────────────────
export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<NotificationRecord[]>('/notifications'),
    refetchInterval: 20_000,
    enabled,
  });
}

// ── Meetings ───────────────────────────────────────────────────────────────
export function useMeetingsByDeal(dealId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['meetings', 'deal', dealId],
    queryFn: () => apiFetch<MeetingSessionRecord[]>(`/meetings/deal/${dealId}`),
    enabled: enabled && Boolean(dealId),
  });
}

export function useMeeting(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['meeting', id],
    queryFn: () => apiFetch<MeetingSessionRecord>(`/meetings/${id}`),
    enabled: enabled && Boolean(id),
  });
}

export function useCreateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { dealId: string; title: string; scheduledAt?: string }) =>
      apiFetch<MeetingSessionRecord>('/meetings', { method: 'POST', body: input }),
    onSuccess: (meeting) => {
      qc.invalidateQueries({ queryKey: ['meetings', 'deal', meeting.dealId] });
      qc.setQueryData(['meeting', meeting.id], meeting);
    },
  });
}

export function useUpdateMeetingStatus(meetingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { status: 'Scheduled' | 'Active' | 'Ended' }) =>
      apiFetch<MeetingSessionRecord>(`/meetings/${meetingId}/status`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: (meeting) => {
      qc.setQueryData(['meeting', meetingId], meeting);
      qc.invalidateQueries({ queryKey: ['meetings', 'deal', meeting.dealId] });
    },
  });
}

export function useCreateMeetingInvite(meetingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      walletAddress?: string;
      role: 'buyer' | 'seller' | 'arbiter' | 'guest';
      maxUses?: number;
      expiresAt: string;
    }) =>
      apiFetch<MeetingInviteRecord>(`/meetings/${meetingId}/invites`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meeting', meetingId] }),
  });
}

export function useJoinMeetingByToken() {
  return useMutation({
    mutationFn: (input: { token: string }) =>
      apiFetch<MeetingInviteRecord>('/meetings/join', { method: 'POST', body: input }),
  });
}

export function useAddMeetingTranscript(meetingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      participantId?: string;
      speakerLabel: string;
      content: string;
      confidence?: number;
      startTime: number;
      endTime?: number;
      language?: string;
    }) =>
      apiFetch<MeetingTranscriptRecord>(`/meetings/${meetingId}/transcripts`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meeting-transcripts', meetingId] });
      qc.invalidateQueries({ queryKey: ['meeting-risk-events', meetingId] });
      qc.invalidateQueries({ queryKey: ['meeting', meetingId] });
    },
  });
}

export function useAddMeetingTranslation(meetingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      transcriptId: string;
      targetLanguage: string;
      content: string;
      provider?: string;
    }) =>
      apiFetch(`/meetings/${meetingId}/translations`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meeting-transcripts', meetingId] });
      qc.invalidateQueries({ queryKey: ['meeting', meetingId] });
    },
  });
}

export function useMeetingTranscripts(meetingId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['meeting-transcripts', meetingId],
    queryFn: () => apiFetch<MeetingTranscriptRecord[]>(`/meetings/${meetingId}/transcripts`),
    enabled: enabled && Boolean(meetingId),
    refetchInterval: 15_000,
  });
}

export function useMeetingSttState(meetingId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['meeting-stt-state', meetingId],
    queryFn: () => apiFetch<MeetingSttStateRecord>(`/meetings/${meetingId}/stt`),
    enabled: enabled && Boolean(meetingId),
    refetchInterval: 15_000,
  });
}

export function useStartMeetingStt(meetingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      languages?: string[];
      targetLanguages?: string[];
      maxIdleTime?: number;
      subscribeAudioUids?: string[];
      enableTranslation?: boolean;
    }) =>
      apiFetch<MeetingSttStateRecord>(`/meetings/${meetingId}/stt/start`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meeting-stt-state', meetingId] });
    },
  });
}

export function useStopMeetingStt(meetingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<MeetingSttStateRecord>(`/meetings/${meetingId}/stt/stop`, {
        method: 'POST',
        body: {},
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meeting-stt-state', meetingId] });
    },
  });
}

export function useMeetingRiskEvents(meetingId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['meeting-risk-events', meetingId],
    queryFn: () => apiFetch<MeetingRiskEventRecord[]>(`/meetings/${meetingId}/risk-events`),
    enabled: enabled && Boolean(meetingId),
    refetchInterval: 15_000,
  });
}

export function useAgoraToken(
  meetingId: string | null,
  input: { uid: number; role?: 1 | 2; expiry?: number },
  enabled = true,
) {
  return useQuery({
    queryKey: ['meeting-agora-token', meetingId, input.uid, input.role ?? 1, input.expiry ?? 3600],
    queryFn: () =>
      apiFetch<AgoraTokenResult>(
        `/meetings/${meetingId}/agora-token?uid=${input.uid}&role=${input.role ?? 1}&expiry=${input.expiry ?? 3600}`,
      ),
    enabled: enabled && Boolean(meetingId),
  });
}

export function useReputation(wallet: string | null | undefined) {
  return useQuery({
    queryKey: ['reputation', wallet],
    queryFn: () => apiFetch<ReputationRecord>(`/reputation/${wallet}`),
    enabled: Boolean(wallet),
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => apiFetch<ReputationRecord[]>('/reputation/leaderboard?limit=10'),
  });
}

// ── AI ─────────────────────────────────────────────────
export interface AnalyzeDealResult {
  terms: unknown;
  risk: { score?: number; level?: string; flags?: string[]; recommendation?: string };
  scamCheck: unknown;
  llmAvailable: boolean;
}

export function useAnalyzeDeal() {
  return useMutation({
    // API endpoint reads `dealDescription` from the body.
    mutationFn: (input: { dealDescription: string }) =>
      apiFetch<AnalyzeDealResult>('/ai/analyze-deal', { method: 'POST', body: input }),
  });
}

export function useDetectScam() {
  return useMutation({
    mutationFn: (input: { text: string }) =>
      apiFetch<{
        score: number;
        level: 'low' | 'medium' | 'high' | 'critical';
        hits: Array<{ rule: { id: string; message: string; severity: string; intent: string } }>;
        intents: string[];
      }>('/ai/detect-scam', { method: 'POST', body: input }),
  });
}
