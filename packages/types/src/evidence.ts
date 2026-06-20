import { z } from 'zod';

/**
 * Evidence artifact attached to a deal/dispute.
 * Hash is the canonical integrity reference used for audit trails.
 */
export const evidenceTypeSchema = z.enum([
  'transcript',
  'audio',
  'screenshot',
  'file',
  'payment_proof',
  'delivery_proof',
  'system_report',
]);
export type EvidenceType = z.infer<typeof evidenceTypeSchema>;

export const evidenceRecordSchema = z.object({
  id: z.string(),
  dealId: z.string(),
  disputeId: z.string().nullable(),
  uploadedBy: z.string().nullable(),
  type: evidenceTypeSchema,
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number().int().nonnegative(),
  storageUrl: z.string(),
  sha256Hash: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>;