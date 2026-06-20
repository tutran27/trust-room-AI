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
  sellerAddress: string;
  status: 'Created' | 'Funded' | 'Released' | 'Refunded' | 'Disputed';
  txSignature: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EscrowActionResult {
  escrow: Escrow;
  simulated: boolean;
  txSignature?: string;
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
