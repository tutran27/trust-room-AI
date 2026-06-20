import { z } from 'zod';

export const riskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

/** Speaker role within a deal room. */
export const speakerRoleSchema = z.enum(['buyer', 'seller', 'ai', 'system']);
export type SpeakerRole = z.infer<typeof speakerRoleSchema>;

/**
 * Scam-intent taxonomy detected by the Scam Guard. Keep in sync with the rules
 * catalog in `@trustroom/ai`.
 */
export const scamIntentSchema = z.enum([
  'early_release_request',
  'move_off_platform',
  'fake_payment_proof',
  'credential_request',
  'external_wallet',
  'time_pressure',
  'impersonation',
  'term_change_after_deposit',
  'ambiguous_terms',
  'unverified_delivery',
  'phishing_link',
]);
export type ScamIntent = z.infer<typeof scamIntentSchema>;

/** Maps a 0-100 score to a risk level. Thresholds per the technical brief §5.7. */
export function scoreToLevel(score: number): RiskLevel {
  if (score >= 80) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

export const riskEventSchema = z.object({
  id: z.string(),
  dealId: z.string(),
  sourceTranscriptId: z.string().nullable(),
  speakerRole: speakerRoleSchema,
  intent: scamIntentSchema,
  riskLevel: riskLevelSchema,
  scoreDelta: z.number(),
  confidence: z.number().min(0).max(1),
  triggerText: z.string(),
  reason: z.string(),
  suggestedAction: z.string(),
  createdAt: z.string().datetime(),
});
export type RiskEvent = z.infer<typeof riskEventSchema>;
