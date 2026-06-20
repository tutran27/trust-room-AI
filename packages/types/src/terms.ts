import { z } from 'zod';
import { dealTypeSchema, tokenSchema } from './deal';

/**
 * Structured deal terms produced by the AI Deal Notary from the live conversation.
 * The notary may set `missingFields` and `confidence`; both parties must sign the
 * canonical terms hash before the deal advances to TermsConfirmed.
 */
export const extractedTermsSchema = z.object({
  dealId: z.string(),
  dealType: dealTypeSchema,
  buyerWallet: z.string().nullable(),
  sellerWallet: z.string().nullable(),
  assetOrService: z.string(),
  amount: z.string(),
  token: tokenSchema,
  deadline: z.string().datetime().nullable(),
  deliveryCondition: z.string(),
  releaseCondition: z.string(),
  refundCondition: z.string(),
  disputeCondition: z.string(),
  specialTerms: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  missingFields: z.array(z.string()).default([]),
  riskNotes: z.array(z.string()).default([]),
});
export type ExtractedTerms = z.infer<typeof extractedTermsSchema>;
