import { z } from 'zod';
import { decimalAmountSchema, solanaAddressSchema } from './deal';

/**
 * Escrow transaction status on Solana.
 * Canonical values match the Prisma `EscrowStatus` enum (PascalCase) so the API
 * can validate against DB-compatible values without translation.
 */
export const escrowStatusSchema = z.enum([
  'Created',
  'Funded',
  'Released',
  'Refunded',
  'Disputed',
]);
export type EscrowStatus = z.infer<typeof escrowStatusSchema>;

/**
 * Escrow transaction record.
 * Links a deal to its on-chain escrow PDA.
 */
export const escrowTransactionSchema = z.object({
  id: z.string(),
  dealId: z.string(),
  escrowPda: z.string().nullable(),
  escrowBump: z.number().int().nullable(),
  amount: z.string(), // lamports as string to avoid precision loss
  token: z.string().default('SOL'),
  status: escrowStatusSchema.default('Created'),
  fundedAt: z.string().datetime().nullable(),
  releasedAt: z.string().datetime().nullable(),
  refundedAt: z.string().datetime().nullable(),
  releaseSignature: z.string().nullable(),
  refundSignature: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type EscrowTransaction = z.infer<typeof escrowTransactionSchema>;

// ──────────────────────────────────────────────
// Request / response payloads (API surface)
// ──────────────────────────────────────────────

/**
 * Request to create an escrow for a deal. `amount` is a decimal string to avoid
 * float precision loss. `buyerWallet` is optional (may be derived server-side).
 */
export const createEscrowRequestSchema = z.object({
  dealId: z.string(),
  amount: decimalAmountSchema,
  sellerWallet: solanaAddressSchema,
  buyerWallet: solanaAddressSchema.optional(),
});
export type CreateEscrowRequest = z.infer<typeof createEscrowRequestSchema>;

/** Request to fund an existing escrow. */
export const fundEscrowRequestSchema = z.object({
  buyerWallet: solanaAddressSchema,
});
export type FundEscrowRequest = z.infer<typeof fundEscrowRequestSchema>;

/**
 * Response returned by escrow lifecycle actions (create / fund / release /
 * refund). `simulated` is true when the action ran against a simulated chain.
 */
export const escrowActionResponseSchema = z.object({
  escrow: escrowTransactionSchema,
  simulated: z.boolean(),
  txSignature: z.string().optional(),
});
export type EscrowActionResponse = z.infer<typeof escrowActionResponseSchema>;