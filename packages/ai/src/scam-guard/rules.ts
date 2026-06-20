import type { DealStatus, RiskLevel, ScamIntent } from '@trustroom/types';

/**
 * A deterministic Scam Guard rule. Rules are the fast first layer of detection
 * (run before the LLM intent classifier). Each rule contributes a score delta;
 * the aggregator combines deltas into a final risk level.
 */
export interface ScamRule {
  ruleId: string;
  intent: ScamIntent;
  riskLevel: RiskLevel;
  /** Base score contribution (0-100). */
  score: number;
  /** Lowercased keyword/phrase triggers (matched against normalized text). VI + EN. */
  keywords?: string[];
  /** If set, the rule only fires when the deal is NOT in one of these states. */
  invalidBeforeStates?: DealStatus[];
  /** Human-readable explanation shown to the user (must explain the reason). */
  message: string;
}

/**
 * MVP rule catalog. Keywords intentionally include Vietnamese phrasings because
 * transcripts are VI / EN / mixed. This is a starting set — extend with the
 * embedding playbook (Qdrant + bge-m3) for semantic coverage.
 */
export const SCAM_RULES: ScamRule[] = [
  {
    ruleId: 'EARLY_RELEASE',
    intent: 'early_release_request',
    riskLevel: 'high',
    score: 40,
    keywords: ['release first', 'release truoc', 'release trước', 'gửi file sau', 'chuyển trước'],
    invalidBeforeStates: ['DeliverySubmitted', 'ReadyToRelease'],
    message: 'Counterparty is asking to release escrow before delivery is verified.',
  },
  {
    ruleId: 'OFF_PLATFORM',
    intent: 'move_off_platform',
    riskLevel: 'high',
    score: 35,
    keywords: ['telegram', 'zalo', 'whatsapp', 'messenger', 'nhắn riêng', 'qua zalo', 'inbox'],
    message: 'Counterparty is trying to move the deal off-platform, where you lose protection.',
  },
  {
    ruleId: 'CREDENTIAL_REQUEST',
    intent: 'credential_request',
    riskLevel: 'critical',
    score: 100,
    keywords: ['seed phrase', 'private key', 'recovery phrase', 'mật khẩu', 'otp', 'mã xác minh'],
    message: 'Never share your seed phrase, private key, OTP, or password with anyone.',
  },
  {
    ruleId: 'EXTERNAL_WALLET',
    intent: 'external_wallet',
    riskLevel: 'critical',
    score: 80,
    message: 'A wallet address that is not part of the verified deal/escrow was detected.',
  },
  {
    ruleId: 'FAKE_PAYMENT_PROOF',
    intent: 'fake_payment_proof',
    riskLevel: 'high',
    score: 40,
    keywords: ['đã gửi bill', 'ảnh chuyển khoản', 'screenshot', 'i already paid', 'cứ release đi'],
    message: 'A screenshot is not proof of an on-chain payment. Verify the transaction before releasing.',
  },
  {
    ruleId: 'TIME_PRESSURE',
    intent: 'time_pressure',
    riskLevel: 'medium',
    score: 20,
    keywords: ['nhanh lên', 'gấp', 'last chance', 'only 5 minutes', 'chỉ còn'],
    message: 'Be cautious of urgency/time pressure — it is a common manipulation tactic.',
  },
  {
    ruleId: 'IMPERSONATION',
    intent: 'impersonation',
    riskLevel: 'high',
    score: 35,
    keywords: ['i am support', 'tôi là admin', 'tôi là support', 'arbitrator', 'nhân viên'],
    message: 'This identity is not a verified TrustRoom support/admin/arbitrator.',
  },
];
