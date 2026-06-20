import { z } from 'zod';
import { speakerRoleSchema } from './risk';

/**
 * A speaker-attributed transcript chunk emitted by the Agora STT pipeline.
 * Language is detected per chunk (Vietnamese / English / mixed) — downstream
 * Scam Guard and Notary must be multilingual.
 */
export const transcriptChunkSchema = z.object({
  id: z.string(),
  dealId: z.string(),
  speakerRole: speakerRoleSchema,
  speakerWallet: z.string().nullable(),
  text: z.string(),
  language: z.string().default('und'),
  confidence: z.number().min(0).max(1),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
});
export type TranscriptChunk = z.infer<typeof transcriptChunkSchema>;

/**
 * Inbound chat / transcript ingestion request. Reuses the canonical
 * {@link speakerRoleSchema} so chat messages and STT chunks share one role
 * taxonomy. `speakerWallet` is optional (system/ai speakers have none).
 */
export const chatMessageRequestSchema = z.object({
  dealId: z.string(),
  speakerRole: speakerRoleSchema,
  text: z.string().min(1),
  speakerWallet: z.string().optional(),
});
export type ChatMessageRequest = z.infer<typeof chatMessageRequestSchema>;
