import { z } from 'zod';

export const reputationEventTypeSchema = z.enum([
  'deal_completed',
  'dispute_won',
  'dispute_lost',
  'risk_flagged',
  'manual_adjustment',
]);
export type ReputationEventType = z.infer<typeof reputationEventTypeSchema>;

export const reputationProfileSchema = z.object({
  walletAddress: z.string(),
  score: z.number().int().min(0).max(100),
  successfulDeals: z.number().int().nonnegative().default(0),
  disputesWon: z.number().int().nonnegative().default(0),
  disputesLost: z.number().int().nonnegative().default(0),
  riskFlags: z.number().int().nonnegative().default(0),
  updatedAt: z.string().datetime(),
});
export type ReputationProfile = z.infer<typeof reputationProfileSchema>;

export const reputationEventSchema = z.object({
  id: z.string(),
  walletAddress: z.string(),
  dealId: z.string().nullable(),
  type: reputationEventTypeSchema,
  scoreDelta: z.number().int(),
  reason: z.string(),
  createdAt: z.string().datetime(),
});
export type ReputationEvent = z.infer<typeof reputationEventSchema>;