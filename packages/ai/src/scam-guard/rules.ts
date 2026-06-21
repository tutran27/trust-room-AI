import {
  SCAM_INTENT_SUGGESTED_ACTION,
  type DealStatus,
  type RiskLevel,
  type ScamIntent,
} from '@trustroom/types';

/**
 * A deterministic Scam Guard rule. Rules are the fast first layer of detection
 * (run before the LLM intent classifier). Each rule contributes a score delta;
 * the aggregator combines deltas into a final risk level.
 *
 * Matching is two-pronged:
 *  - `keywords`: substring match against normalized (lowercased, accent-folded) text.
 *  - `patterns`: regex match against the normalized text. Patterns capture the
 *    "vòng vo" / paraphrased phrasings that a flat keyword list misses
 *    (e.g. "cứ bấm hoàn tất đi rồi mình gửi sau").
 */
export interface ScamRule {
  ruleId: string;
  intent: ScamIntent;
  riskLevel: RiskLevel;
  /** Base score contribution (0-100). */
  score: number;
  /** Lowercased keyword/phrase triggers (matched against normalized text). VI + EN. */
  keywords?: string[];
  /** Regex triggers against normalized text — covers paraphrased / indirect phrasing. */
  patterns?: RegExp[];
  /** If set, the rule only fires when the deal is NOT in one of these states. */
  invalidBeforeStates?: DealStatus[];
  /**
   * True when this intent directly threatens escrowed funds. Used by the
   * aggregator to decide whether to recommend locking the Release button.
   */
  escrowThreat?: boolean;
  /**
   * True when repeating this behavior should accrue the repetition penalty
   * (technical brief §6.1 "lặp lại cùng hành vi nguy hiểm").
   */
  repeatable?: boolean;
  /** Human-readable explanation shown to the user (must explain the reason). */
  message: string;
}

/**
 * Returns the canonical user-facing action for an intent. Falls back to a generic
 * caution string for intents without a dedicated entry.
 */
export function suggestedActionFor(intent: ScamIntent): string {
  return (
    SCAM_INTENT_SUGGESTED_ACTION[intent] ??
    'Review the deal terms carefully before taking any action.'
  );
}

/**
 * MVP rule catalog. Keywords + regex intentionally include Vietnamese phrasings
 * because transcripts are VI / EN / mixed. Normalization (see `detect.ts`) folds
 * Vietnamese diacritics, so the patterns here are written without accents and a
 * single rule matches both "release trước" and "release truoc".
 *
 * This is the deterministic layer; the LLM intent classifier + embedding playbook
 * extend it with semantic coverage for paraphrases not enumerated here.
 */
export const SCAM_RULES: ScamRule[] = [
  {
    ruleId: 'EARLY_RELEASE',
    intent: 'early_release_request',
    riskLevel: 'high',
    score: 40,
    keywords: [
      'release first',
      'release truoc',
      'confirm first',
      'complete first',
      'send later',
      'gui file sau',
      'gui hang sau',
      'chuyen truoc',
      'tin tui di',
      'trust me',
    ],
    patterns: [
      // "release/confirm/complete/bấm hoàn tất ... (rồi/then) ... gửi/giao/chuyển sau"
      /\b(release|confirm|complete|hoan tat|xac nhan|bam)\b.{0,40}\b(truoc|first|di)\b/,
      /\b(truoc|first)\b.{0,30}\b(gui|giao|chuyen|send|deliver)\b.{0,20}\b(sau|later)\b/,
      /\bcu (release|hoan tat|xac nhan|bam)\b/,
    ],
    invalidBeforeStates: ['DeliverySubmitted', 'ReadyToRelease'],
    escrowThreat: true,
    repeatable: true,
    message: 'Counterparty is asking to release escrow before delivery is verified.',
  },
  {
    ruleId: 'OFF_PLATFORM',
    intent: 'move_off_platform',
    riskLevel: 'high',
    score: 35,
    keywords: [
      'telegram',
      'zalo',
      'whatsapp',
      'messenger',
      'discord',
      'wechat',
      'viber',
      'app khac',
      'nen tang khac',
      'platform khac',
      'qua ben ngoai',
      'giao dich ngoai',
      'noi chuyen ngoai',
      'noi chuyen rieng',
      'ra ngoai noi',
      'khong chat o day',
      'khong nhan o day',
      'khong can o room nay',
      'bo escrow',
      'ne escrow',
      'direct wallet',
      'nhan rieng',
      'inbox',
      'private chat',
      'off platform',
    ],
    patterns: [
      /\b(qua|sang|chuyen sang|ra)\b.{0,15}\b(telegram|zalo|whatsapp|messenger|discord|ngoai)\b/,
      /\bnoi chuyen\b.{0,15}\b(rieng|ngoai|cho tien|cho nhanh)\b/,
      /\bkhong (can|thich)\b.{0,10}\b(escrow|ai|nghe|giam sat)\b/,
      /\b(chuyen|doi|qua)\b.{0,15}\b(app|nen tang|platform)\b.{0,10}\b(khac|ngoai)\b/,
      /\b(dung|khong)\b.{0,12}\b(chat|nhan tin)\b.{0,12}\b(o day|trong room|tren he thong)\b/,
      /\b(giao dich|noi)\b.{0,12}\b(ngoai|rieng)\b.{0,12}\b(room|nen tang|he thong)?\b/,
      /\b(bo|ne|khong can)\b.{0,10}\b(escrow)\b/,
    ],
    escrowThreat: true,
    repeatable: true,
    message: 'Counterparty is trying to move the deal off-platform, where you lose protection.',
  },
  {
    ruleId: 'CREDENTIAL_REQUEST',
    intent: 'credential_request',
    riskLevel: 'critical',
    score: 100,
    keywords: [
      'seed phrase',
      'seedphrase',
      'private key',
      'recovery phrase',
      'cum tu khoi phuc',
      'mat khau',
      'password',
      'otp',
      'ma xac minh',
      'ma otp',
      'anydesk',
      'teamviewer',
      'remote access',
    ],
    patterns: [
      /\b(gui|cho|xin|nhap|share)\b.{0,20}\b(seed|private key|recovery|otp|mat khau|password)\b/,
      /\b(cai|install)\b.{0,15}\b(app|ung dung)\b.{0,20}\b(ket noi vi|connect wallet)\b/,
    ],
    escrowThreat: true,
    message: 'Never share your seed phrase, private key, OTP, or password with anyone.',
  },
  {
    ruleId: 'EXTERNAL_WALLET',
    intent: 'external_wallet',
    riskLevel: 'critical',
    score: 80,
    // No keyword/pattern triggers: this rule is fired by the wallet-address parser
    // (see wallet-parser.ts) when an on-chain address that is NOT part of the
    // verified deal/escrow appears in the transcript.
    escrowThreat: true,
    repeatable: true,
    message: 'A wallet address that is not part of the verified deal/escrow was detected.',
  },
  {
    ruleId: 'SPLIT_PAYMENT',
    intent: 'split_payment',
    riskLevel: 'high',
    score: 35,
    keywords: [
      'chia ra',
      'tach ra',
      'mot phan ngoai escrow',
      'coc truoc',
      'dat coc truoc',
      'gui truoc 30',
      'gui truoc mot phan',
      'split payment',
      'partial payment',
      'escrow chi de',
    ],
    patterns: [
      /\b(gui|chuyen|coc)\b.{0,15}\b(truoc)\b.{0,15}\b(\d{1,3} ?%|mot phan|ngoai escrow)\b/,
      /\bchia\b.{0,10}\b(\d|nhieu)\b.{0,10}\b(vi|lan|phan)\b/,
      /\bescrow chi (de|la)\b.{0,15}\b(tuong trung|hinh thuc)\b/,
    ],
    escrowThreat: true,
    repeatable: true,
    message: 'Counterparty wants to split the payment or pay partly outside escrow — only the full escrow deposit is protected.',
  },
  {
    ruleId: 'FAKE_PAYMENT_PROOF',
    intent: 'fake_payment_proof',
    riskLevel: 'high',
    score: 40,
    keywords: [
      'da gui bill',
      'anh chuyen khoan',
      'anh bill',
      'bien lai',
      'screenshot',
      'screen shot',
      'i already paid',
      'da thanh toan roi',
      'da chuyen roi',
      'tien chac chan ve',
      'ngan hang bao pending',
    ],
    patterns: [
      /\b(da|toi|minh)\b.{0,10}\b(chuyen|thanh toan|paid|gui tien)\b.{0,25}\b(release|hoan tat|giao|gui hang|con cho gi)\b/,
      /\b(xem|day|gui)\b.{0,10}\b(anh|bill|bien lai|email|sms)\b.{0,20}\b(release|di|roi)\b/,
    ],
    escrowThreat: true,
    repeatable: true,
    message: 'A screenshot is not proof of an on-chain payment. Verify the transaction before releasing.',
  },
  {
    ruleId: 'TIME_PRESSURE',
    intent: 'time_pressure',
    riskLevel: 'medium',
    score: 20,
    keywords: [
      'nhanh len',
      'gap',
      'khan',
      'last chance',
      'co hoi cuoi',
      'het han',
      'chi con',
      'het gio',
      'lam ngay',
      'ngay bay gio',
      'right now',
      'hurry',
      'limited time',
    ],
    patterns: [
      /\bchi con\b.{0,10}\b(\d+\s*(phut|giay|gio|minute|second)|it)\b/,
      /\bneu (ban )?khong\b.{0,20}\b(report|mat deal|mat co hoi|huy)\b/,
    ],
    repeatable: true,
    message: 'Be cautious of urgency/time pressure — it is a common manipulation tactic.',
  },
  {
    ruleId: 'IMPERSONATION',
    intent: 'impersonation',
    riskLevel: 'high',
    score: 35,
    keywords: [
      'i am support',
      'toi la admin',
      'toi la support',
      'minh la admin',
      'nhan vien',
      'arbitrator',
      'trong tai',
      'dai dien du an',
      'official support',
      'he thong bao tri',
    ],
    patterns: [
      /\b(toi|minh|i)\b.{0,5}\b(la|am)\b.{0,10}\b(support|admin|nhan vien|trong tai|moderator)\b/,
      /\badmin (bao|noi|yeu cau)\b.{0,15}\b(release|chuyen|gui)\b/,
    ],
    repeatable: true,
    message: 'This identity is not a verified TrustRoom support/admin/arbitrator.',
  },
  {
    ruleId: 'TERM_CHANGE_AFTER_DEPOSIT',
    intent: 'term_change_after_deposit',
    riskLevel: 'high',
    score: 25,
    keywords: [
      'gio gia phai',
      'tra them',
      'doi gia',
      'phai release mot phan',
      'lui deadline',
      'doi deadline',
      'muon ban full',
      'them phi',
    ],
    patterns: [
      /\b(gio|bay gio)\b.{0,15}\b(gia|deadline|phai)\b.{0,15}\b(la|phai|them)\b/,
      /\b(deadline|gia)\b.{0,10}\b(phai )?(lui|doi|tang|len)\b/,
    ],
    // Only meaningful once the deal terms are locked / funds deposited.
    invalidBeforeStates: ['Draft', 'Created', 'WaitingForCounterparty', 'WalletVerified'],
    repeatable: true,
    message: 'Counterparty is changing agreed terms after deposit. Both parties must sign an amendment.',
  },
  {
    ruleId: 'AMBIGUOUS_TERMS',
    intent: 'ambiguous_terms',
    riskLevel: 'medium',
    score: 15,
    keywords: [
      'cu tin toi',
      'khong can ghi',
      'khong can xac nhan',
      'noi mieng',
      'cu deposit di roi ban',
      'dung ghi cai nay',
      'noi vay thoi',
    ],
    patterns: [
      /\b(khong can|dung)\b.{0,10}\b(ghi|xac nhan|ky)\b/,
      /\bcu (tin|deposit|chuyen)\b.{0,15}\b(di|roi)\b.{0,10}\b(ban tiep|noi sau)?\b/,
    ],
    repeatable: true,
    message: 'Counterparty is avoiding clear written terms. Confirm asset, price, deadline, and release condition first.',
  },
  {
    ruleId: 'UNVERIFIED_DELIVERY',
    intent: 'unverified_delivery',
    riskLevel: 'medium',
    score: 20,
    keywords: [
      'toi gui roi ma',
      'da lam xong',
      'nft dang pending',
      'chua upload duoc',
      'dung hoi them',
      'file o link nay',
    ],
    patterns: [
      /\b(da|toi)\b.{0,5}\b(gui|giao|lam xong)\b.{0,10}\b(roi)\b.{0,15}\b(ma|release|di)?\b/,
      /\b(nft|token|hang)\b.{0,10}\b(dang pending|chua xong|chua co)\b.{0,15}\b(release|di)\b/,
    ],
    invalidBeforeStates: ['ReadyToRelease', 'Released'],
    escrowThreat: true,
    repeatable: true,
    message: 'Delivery is claimed but not verified. Require valid delivery proof before releasing.',
  },
  {
    ruleId: 'PHISHING_LINK',
    intent: 'phishing_link',
    riskLevel: 'high',
    score: 35,
    // Fired by the URL parser in wallet-parser.ts when a suspicious link/domain
    // (shortener, look-alike, or "connect wallet / claim" lure) is detected. The
    // keywords below catch the common social-engineering lures around such links.
    keywords: [
      'ket noi vi',
      'connect wallet',
      'claim airdrop',
      'nhan thuong',
      'verify wallet',
      'xac minh vi',
      'ky thu transaction',
    ],
    escrowThreat: true,
    repeatable: true,
    message: 'A suspicious link or wallet-connect lure was detected. Do not open it or sign anything.',
  },
];
