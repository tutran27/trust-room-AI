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

export const participantRoleSchema = z.enum(['buyer', 'seller']);
export type ParticipantRole = z.infer<typeof participantRoleSchema>;

export const dealActionSchema = z.enum([
  'publish',
  'open-invitation',
  'verify-wallets',
  'create-escrow',
  'deposit',
  'start-negotiation',
  'confirm-terms',
  'submit-delivery',
  'mark-ready',
  'release',
  'raise-dispute',
  'refund',
  'cancel',
]);
export type DealAction = z.infer<typeof dealActionSchema>;

export const solanaAddressSchema = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana address.');

export const decimalAmountSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,19})(?:\.\d{1,18})?$/, 'Invalid decimal amount format.')
  .refine((value) => !/^0(?:\.0+)?$/.test(value), 'Amount must be greater than zero.');

export const dealSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  type: dealTypeSchema,
  buyerWallet: z.string().nullable(),
  sellerWallet: z.string().nullable(),
  amount: decimalAmountSchema, // store as string to avoid float precision loss
  token: tokenSchema,
  status: dealStatusSchema,
  deadline: z.string().datetime().nullable(),
  termsHash: z.string().nullable(),
  evidenceHash: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  version: z.number().int().nonnegative().optional(),
});
export type Deal = z.infer<typeof dealSchema>;
