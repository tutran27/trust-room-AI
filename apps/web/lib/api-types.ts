// Shapes returned by the TrustRoom API (serialized forms). Kept local to the web
// app since the API serializes a few fields (Decimal → string, Date → ISO) that
// differ from the raw Prisma/Zod models.

export interface DealParticipant {
  walletAddress: string;
  role: 'buyer' | 'seller';
}

export interface DealEventRecord {
  id: string;
  actorWallet: string;
  type: string;
  metadata: unknown;
  createdAt: string;
}

export interface Deal {
  id: string;
  title: string;
  description: string | null;
  type: string;
  amount: string;
  token: string;
  status: string;
  deadline: string | null;
  termsHash: string | null;
  evidenceHash: string | null;
  buyerWallet: string | null;
  sellerWallet: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  participants: DealParticipant[];
  events?: DealEventRecord[];
}

export interface Paginated<T> {
  data: T[];
  meta: { limit: number; nextCursor: string | null };
}

export interface Escrow {
  id: string;
  dealId: string;
  amount: string;
  buyerAddress: string;
  sellerAddress: string;
  tokenMint: string;
  dealIdHash: string | null;
  status: 'Created' | 'Funded' | 'Released' | 'Refunded' | 'Disputed';
  txSignature: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EscrowActionResult {
  escrow: Escrow;
  txBase64: string;
  dealIdHash?: string;
  tokenMint?: string;
  message?: string;
}

export interface EvidenceRecord {
  id: string;
  disputeId: string;
  type: string;
  content: string | null;
  url: string | null;
  hash: string | null;
  createdAt: string;
}

export interface Dispute {
  id: string;
  dealId: string;
  raisedBy: string;
  reason: string;
  status: string;
  resolution: string | null;
  aiSummary: string | null;
  aiConfidence: number | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  evidence?: EvidenceRecord[];
  deal?: Deal;
}

export interface NotificationRecord {
  id: string;
  wallet: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  dealId: string | null;
  createdAt: string;
}

export interface ReputationRecord {
  wallet: string;
  completedDeals: number;
  successfulDeals: number;
  disputedDeals: number;
  totalVolume: string | number;
  score: number;
  lastUpdated: string;
}

export interface MeetingParticipantRecord {
  id: string;
  sessionId: string;
  walletAddress: string;
  role: 'buyer' | 'seller' | 'arbiter' | 'guest';
  agoraUid: number | null;
  joinedAt: string;
  leftAt: string | null;
  isActive: boolean;
}

export interface MeetingInviteRecord {
  id: string;
  sessionId: string;
  walletAddress: string | null;
  role: 'buyer' | 'seller' | 'arbiter' | 'guest';
  token: string;
  status: 'Pending' | 'Accepted' | 'Expired' | 'Revoked';
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingTranslationRecord {
  id: string;
  transcriptId: string;
  sessionId: string;
  targetLanguage: string;
  content: string;
  provider: string;
  cacheKey: string;
  createdAt: string;
}

export interface MeetingRiskEventRecord {
  id: string;
  sessionId: string;
  transcriptId: string | null;
  type: string;
  severity: string;
  description: string;
  evidence: unknown;
  createdAt: string;
}

export interface MeetingTranscriptRecord {
  id: string;
  sessionId: string;
  participantId: string | null;
  speakerLabel: string;
  content: string;
  confidence: number | null;
  startTime: number;
  endTime: number | null;
  language: string;
  createdAt: string;
  translations?: MeetingTranslationRecord[];
  riskEvents?: MeetingRiskEventRecord[];
}

export interface MeetingSttStateRecord {
  enabled: boolean;
  mode: 'demo_manual' | 'asr_only' | 'asr_translate';
  status:
    | 'idle'
    | 'starting'
    | 'running'
    | 'fallback_asr_only'
    | 'stopping'
    | 'error';
  agentId: string | null;
  pusherUid: number | null;
  languages: string[];
  targetLanguages: string[];
  fallbackReason?: string | null;
}

export interface MeetingSessionRecord {
  id: string;
  dealId: string;
  title: string;
  status: 'Scheduled' | 'Active' | 'Ended';
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  participants?: MeetingParticipantRecord[];
  invites?: MeetingInviteRecord[];
  transcripts?: MeetingTranscriptRecord[];
  riskEvents?: MeetingRiskEventRecord[];
  _count?: { transcripts: number; invites: number };
}

export interface AgoraTokenResult {
  token: string;
  channel: string;
  uid: number;
  expiresAt: number;
}

export interface SessionUser {
  sub?: string;
  userId?: string;
  wallet: string;
  walletAddress?: string;
}

export interface AuthResult {
  accessToken: string;
  userId: string;
  walletAddress: string;
}

export interface NonceResult {
  challengeId: string;
  nonce: string;
  message: string;
  expiresAt: string;
}

// Realtime risk event broadcast by the Scam Guard over the deal-room socket.
export interface RiskEventLive {
  dealId: string;
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  intents: string[];
  reasons: string[];
  triggerText: string;
  speaker: string;
  timestamp: string;
}

export interface ChatMessageLive {
  dealId: string;
  message: string;
  sender: string;
  speakerRole: 'buyer' | 'seller' | 'ai' | 'system';
  timestamp: string;
}
