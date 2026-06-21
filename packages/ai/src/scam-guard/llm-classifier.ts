import { scamIntentSchema, type ScamIntent, type RiskLevel } from '@trustroom/types';
import type { LLMClient } from '../llm.js';

/**
 * LLM intent classifier (technical brief §5.2). Catches paraphrased / indirect
 * scam phrasing that the deterministic keyword + regex layer misses ("vòng vo").
 *
 * Guardrails (plan §5.2):
 *  - The LLM only produces *signals*; it never decides to release/block funds.
 *  - Output is constrained to the known intent taxonomy; unknown intents are dropped.
 *  - Degrades safely: with no API key, or on any error/invalid JSON, returns an
 *    empty signal list so the rule layer alone still works.
 */

export interface LlmIntentSignal {
  intent: ScamIntent;
  riskLevel: RiskLevel;
  confidence: number;
  scoreDelta: number;
  reason: string;
  source: 'llm';
}

export interface LlmClassifierContext {
  dealStatus?: string;
  escrowState?: string;
  speakerRole?: string;
  confirmedTerms?: Record<string, unknown> | null;
  recentMessages?: string[];
}

const SYSTEM_PROMPT = `You are a fraud-risk classifier for P2P crypto escrow deals.
Classify the speaker's latest message into zero or more risk intents, using the deal state, escrow status, confirmed terms, and recent conversation as context.
You only produce risk SIGNALS — you never decide to release, block, or move funds.
Do not invent facts. If evidence is insufficient, return an empty intents array or low confidence.

Allowed intents (use these exact strings):
- early_release_request: asks to release escrow before delivery is verified
- move_off_platform: tries to move chat/payment off-platform (telegram, zalo, direct, no escrow)
- fake_payment_proof: uses a screenshot/claim instead of an on-chain payment, pressures release
- credential_request: asks for seed phrase, private key, OTP, password, or remote access
- external_wallet: asks to send to a wallet that is not the verified escrow
- split_payment: asks to split the payment or pay partly outside escrow
- time_pressure: manufactures urgency to force a quick decision
- impersonation: falsely claims to be support/admin/arbitrator/project rep
- term_change_after_deposit: changes agreed price/deadline/terms after deposit
- ambiguous_terms: avoids confirming clear written terms
- unverified_delivery: claims delivery without valid proof
- phishing_link: shares a suspicious link / wallet-connect lure

Return STRICT JSON only:
{"intents":[{"intent":"<one of the above>","risk_level":"low|medium|high|critical","confidence":0.0-1.0,"score_delta":0-100,"reason":"short explanation"}]}`;

interface RawLlmResponse {
  intents?: Array<{
    intent?: string;
    risk_level?: string;
    confidence?: number;
    score_delta?: number;
    reason?: string;
  }>;
}

const VALID_LEVELS: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function sanitize(raw: RawLlmResponse): LlmIntentSignal[] {
  if (!raw?.intents || !Array.isArray(raw.intents)) return [];
  const signals: LlmIntentSignal[] = [];
  for (const item of raw.intents) {
    const parsed = scamIntentSchema.safeParse(item?.intent);
    if (!parsed.success) continue; // drop unknown intents
    const riskLevel: RiskLevel = VALID_LEVELS.includes(item.risk_level as RiskLevel)
      ? (item.risk_level as RiskLevel)
      : 'medium';
    signals.push({
      intent: parsed.data,
      riskLevel,
      confidence: clamp(item.confidence ?? 0.6, 0, 1, 0.6),
      scoreDelta: Math.round(clamp(item.score_delta ?? 20, 0, 100, 20)),
      reason: typeof item.reason === 'string' && item.reason ? item.reason : 'LLM-detected risk intent.',
      source: 'llm',
    });
  }
  return signals;
}

/**
 * Run the LLM intent classifier. Returns [] when the client is unavailable or any
 * error occurs — callers must treat the LLM as an enhancement, not a dependency.
 */
export async function classifyIntents(
  client: LLMClient | undefined,
  message: string,
  context: LlmClassifierContext = {},
): Promise<LlmIntentSignal[]> {
  if (!client || !client.isConfigured() || !message.trim()) return [];

  const contextBlock = JSON.stringify(
    {
      deal_status: context.dealStatus ?? null,
      escrow_state: context.escrowState ?? null,
      speaker_role: context.speakerRole ?? null,
      confirmed_terms: context.confirmedTerms ?? null,
      recent_messages: (context.recentMessages ?? []).slice(-6),
    },
    null,
    0,
  );

  try {
    const raw = await client.chatWithJSON<RawLlmResponse>(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Context:\n${contextBlock}\n\nLatest message:\n"""${message}"""` },
      ],
      { temperature: 0.1 },
    );
    return sanitize(raw);
  } catch {
    return [];
  }
}
