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
