'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api-client';
import type {
  Deal,
  Dispute,
  Escrow,
  EscrowActionResult,
  EvidenceRecord,
  NotificationRecord,
  Paginated,
  ReputationRecord,
} from '../lib/api-types';

// ── Deals ──────────────────────────────────────────────
export function useDeals(status?: string) {
  return useQuery({
    queryKey: ['deals', status ?? 'all'],
    queryFn: () =>
      apiFetch<Paginated<Deal>>(`/deals${status ? `?status=${encodeURIComponent(status)}` : ''}`),
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
  sellerWallet?: string;
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
    mutationFn: (input: { dealId: string; amount: string; sellerWallet: string; buyerWallet?: string }) =>
      apiFetch<EscrowActionResult>('/escrow', { method: 'POST', body: input }),
    onSuccess: (res) => qc.invalidateQueries({ queryKey: ['escrow', res.escrow.dealId] }),
  });
}

function useEscrowAction(action: 'fund' | 'release' | 'refund') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (escrowId: string) =>
      apiFetch<EscrowActionResult>(`/escrow/${escrowId}/${action}`, { method: 'POST', body: {} }),
    onSuccess: (res) => qc.invalidateQueries({ queryKey: ['escrow', res.escrow.dealId] }),
  });
}
export const useFundEscrow = () => useEscrowAction('fund');
export const useReleaseEscrow = () => useEscrowAction('release');
export const useRefundEscrow = () => useEscrowAction('refund');

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
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<NotificationRecord[]>('/notifications'),
    refetchInterval: 20_000,
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
