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
  'split_payment',
  'time_pressure',
  'impersonation',
  'term_change_after_deposit',
  'ambiguous_terms',
  'unverified_delivery',
  'phishing_link',
]);
export type ScamIntent = z.infer<typeof scamIntentSchema>;

/**
 * The recommended user-facing action for each scam intent. The Scam Guard never
 * acts on funds itself (AI is a risk assistant, not a judge) — it only surfaces
 * these recommendations so the human decides. Keep in sync with the rules catalog.
 */
export const SCAM_INTENT_SUGGESTED_ACTION: Record<ScamIntent, string> = {
  early_release_request:
    'Do not release escrow until delivery proof is submitted and verified.',
  move_off_platform:
    'Stay inside the Deal Room — moving off-platform removes escrow and evidence protection.',
  fake_payment_proof:
    'Do not release based on a screenshot. Require an on-chain transaction hash or confirmed settlement.',
  credential_request:
    'Never share your seed phrase, private key, OTP, or password. Stop and consider opening a dispute.',
  external_wallet:
    'Only the verified escrow address is protected. Do not send funds to any other wallet.',
  split_payment:
    'Reject splitting the payment or paying outside escrow — only the full escrow deposit is protected.',
  time_pressure:
    'Take your time. Urgency is a manipulation tactic — re-check the deal terms before acting.',
  impersonation:
    'This person is not verified TrustRoom support/admin. Do not trust role claims made in chat.',
  term_change_after_deposit:
    'Terms changed after deposit. Require a signed amendment from both parties before proceeding.',
  ambiguous_terms:
    'Clarify and confirm the asset, price, deadline, and release condition before depositing or releasing.',
  unverified_delivery:
    'Do not release without valid delivery proof (file, tx hash, or on-chain ownership transfer).',
  phishing_link:
    'Do not open the link or install anything. It may be a phishing or wallet-draining attempt.',
};

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
