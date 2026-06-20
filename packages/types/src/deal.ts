import { z } from 'zod';

/**
 * Canonical deal lifecycle states. The deal lifecycle is a finite-state machine —
 * never mutate status ad-hoc; only apply transitions in {@link DEAL_TRANSITIONS}.
 */
export const DealStatus = {
  Draft: 'Draft',
  Created: 'Created',
  WaitingForCounterparty: 'WaitingForCounterparty',
  WalletVerified: 'WalletVerified',
  EscrowCreated: 'EscrowCreated',
  Deposited: 'Deposited',
  Negotiating: 'Negotiating',
  TermsConfirmed: 'TermsConfirmed',
  DeliverySubmitted: 'DeliverySubmitted',
  ReadyToRelease: 'ReadyToRelease',
  Released: 'Released',
  // exceptional / terminal
  Disputed: 'Disputed',
  ResolvedRelease: 'ResolvedRelease',
  ResolvedRefund: 'ResolvedRefund',
  ResolvedSplit: 'ResolvedSplit',
  Refunded: 'Refunded',
  Cancelled: 'Cancelled',
  Expired: 'Expired',
} as const;

export type DealStatus = (typeof DealStatus)[keyof typeof DealStatus];

export const dealStatusSchema = z.enum(
  Object.values(DealStatus) as [DealStatus, ...DealStatus[]],
);

/**
 * Allowed forward transitions per state. Any transition not listed here is invalid
 * and must be rejected by the deal service.
 */
export const DEAL_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  Draft: ['Created', 'Cancelled'],
  Created: ['WaitingForCounterparty', 'Cancelled'],
  WaitingForCounterparty: ['WalletVerified', 'Cancelled', 'Expired'],
  WalletVerified: ['EscrowCreated', 'Cancelled', 'Expired'],
  EscrowCreated: ['Deposited', 'Cancelled', 'Expired'],
  Deposited: ['Negotiating', 'Disputed', 'Refunded', 'Expired'],
  Negotiating: ['TermsConfirmed', 'Disputed', 'Refunded'],
  TermsConfirmed: ['DeliverySubmitted', 'Disputed', 'Refunded'],
  DeliverySubmitted: ['ReadyToRelease', 'Disputed'],
  ReadyToRelease: ['Released', 'Disputed'],
  Released: [],
  Disputed: ['ResolvedRelease', 'ResolvedRefund', 'ResolvedSplit'],
  ResolvedRelease: [],
  ResolvedRefund: [],
  ResolvedSplit: [],
  Refunded: [],
  Cancelled: [],
  Expired: [],
};

/** Returns true if `to` is a valid next state from `from`. */
export function canTransition(from: DealStatus, to: DealStatus): boolean {
  return DEAL_TRANSITIONS[from]?.includes(to) ?? false;
}

export const dealTypeSchema = z.enum([
  'freelance_service',
  'nft',
  'token_otc',
  'digital_goods',
  'domain',
  'other',
]);
export type DealType = z.infer<typeof dealTypeSchema>;

export const tokenSchema = z.enum(['SOL', 'USDC', 'SPL_TOKEN']);
export type Token = z.infer<typeof tokenSchema>;

export const dealSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  type: dealTypeSchema,
  buyerWallet: z.string().nullable(),
  sellerWallet: z.string().nullable(),
  amount: z.string(), // store as string to avoid float precision loss
  token: tokenSchema,
  status: dealStatusSchema,
  deadline: z.string().datetime().nullable(),
  termsHash: z.string().nullable(),
  evidenceHash: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type Deal = z.infer<typeof dealSchema>;
