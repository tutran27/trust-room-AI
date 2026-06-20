import { z } from 'zod';

/**
 * Escrow transaction status on Solana.
 * Maps to the on-chain state in the Escrow PDA.
 */
export const escrowStatusSchema = z.enum([
  'created',
  'funded',
  'active',
  'released',
  'refunded',
  'disputed',
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
  status: escrowStatusSchema.default('created'),
  fundedAt: z.string().datetime().nullable(),
  releasedAt: z.string().datetime().nullable(),
  refundedAt: z.string().datetime().nullable(),
  releaseSignature: z.string().nullable(),
  refundSignature: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type EscrowTransaction = z.infer<typeof escrowTransactionSchema>;