-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('Draft', 'Created', 'WaitingForCounterparty', 'WalletVerified', 'EscrowCreated', 'Deposited', 'Negotiating', 'TermsConfirmed', 'DeliverySubmitted', 'ReadyToRelease', 'Released', 'Disputed', 'ResolvedRelease', 'ResolvedRefund', 'ResolvedSplit', 'Refunded', 'Cancelled', 'Expired');

-- CreateEnum
CREATE TYPE "DealType" AS ENUM ('freelance_service', 'nft', 'token_otc', 'digital_goods', 'domain', 'other');

-- CreateEnum
CREATE TYPE "Token" AS ENUM ('SOL', 'USDC', 'SPL_TOKEN');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('buyer', 'seller');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('Created', 'Funded', 'Released', 'Refunded', 'Disputed');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('Open', 'UnderReview', 'Resolved', 'Escalated');

-- CreateEnum
CREATE TYPE "DisputeResolution" AS ENUM ('ReleaseToSeller', 'RefundToBuyer', 'SplitPayment');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DealCreated', 'DealStatusChanged', 'DisputeOpened', 'DisputeResolved', 'PaymentReceived', 'PaymentReleased', 'EvidenceUploaded', 'AiAlert', 'SystemMessage');

-- CreateEnum
CREATE TYPE "AgoraStatus" AS ENUM ('OPEN', 'CLOSED', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('Scheduled', 'Active', 'Ended');

-- CreateEnum
CREATE TYPE "MeetingParticipantRole" AS ENUM ('buyer', 'seller', 'arbiter', 'guest');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('Pending', 'Accepted', 'Expired', 'Revoked');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthNonce" (
    "challengeId" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "nonceHash" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthNonce_pkey" PRIMARY KEY ("challengeId")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "DealType" NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "token" "Token" NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'Draft',
    "deadline" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "termsHash" TEXT,
    "evidenceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealParticipant" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "role" "ParticipantRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DealParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealEvent" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "actorWallet" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escrow" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "sellerAddress" TEXT NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'Created',
    "txSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Escrow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "raisedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'Open',
    "resolution" "DisputeResolution",
    "aiSummary" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "url" TEXT,
    "hash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "dealId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reputation" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "completedDeals" INTEGER NOT NULL DEFAULT 0,
    "successfulDeals" INTEGER NOT NULL DEFAULT 0,
    "disputedDeals" INTEGER NOT NULL DEFAULT 0,
    "totalVolume" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reputation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agora" (
    "id" TEXT NOT NULL,
    "creatorWallet" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tokenMint" TEXT,
    "status" "AgoraStatus" NOT NULL DEFAULT 'OPEN',
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalStaked" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "agoraId" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "support" BOOLEAN NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "votePower" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingSession" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'Scheduled',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "role" "MeetingParticipantRole" NOT NULL,
    "agoraUid" INTEGER,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingInvite" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "walletAddress" TEXT,
    "role" "MeetingParticipantRole" NOT NULL DEFAULT 'guest',
    "token" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'Pending',
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingTranscript" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT,
    "speakerLabel" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "startTime" DOUBLE PRECISION NOT NULL,
    "endTime" DOUBLE PRECISION,
    "language" TEXT NOT NULL DEFAULT 'vi',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingTranslation" (
    "id" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'ai',
    "cacheKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingRiskEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "transcriptId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "description" TEXT NOT NULL,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingRiskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_address_key" ON "Wallet"("address");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "AuthNonce_wallet_createdAt_idx" ON "AuthNonce"("wallet", "createdAt");

-- CreateIndex
CREATE INDEX "AuthNonce_wallet_usedAt_expiresAt_idx" ON "AuthNonce"("wallet", "usedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "Deal_status_idx" ON "Deal"("status");

-- CreateIndex
CREATE INDEX "Deal_updatedAt_id_idx" ON "Deal"("updatedAt", "id");

-- CreateIndex
CREATE INDEX "DealParticipant_walletAddress_idx" ON "DealParticipant"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "DealParticipant_dealId_role_key" ON "DealParticipant"("dealId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "DealParticipant_dealId_walletAddress_key" ON "DealParticipant"("dealId", "walletAddress");

-- CreateIndex
CREATE INDEX "DealEvent_dealId_createdAt_idx" ON "DealEvent"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "DealEvent_dealId_type_idx" ON "DealEvent"("dealId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Escrow_dealId_key" ON "Escrow"("dealId");

-- CreateIndex
CREATE INDEX "Dispute_dealId_idx" ON "Dispute"("dealId");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "Evidence_disputeId_idx" ON "Evidence"("disputeId");

-- CreateIndex
CREATE INDEX "Notification_wallet_read_createdAt_idx" ON "Notification"("wallet", "read", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_wallet_type_idx" ON "Notification"("wallet", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Reputation_wallet_key" ON "Reputation"("wallet");

-- CreateIndex
CREATE INDEX "Reputation_score_idx" ON "Reputation"("score");

-- CreateIndex
CREATE INDEX "Agora_creatorWallet_idx" ON "Agora"("creatorWallet");

-- CreateIndex
CREATE INDEX "Agora_status_idx" ON "Agora"("status");

-- CreateIndex
CREATE INDEX "Agora_category_idx" ON "Agora"("category");

-- CreateIndex
CREATE INDEX "Vote_agoraId_idx" ON "Vote"("agoraId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_agoraId_wallet_key" ON "Vote"("agoraId", "wallet");

-- CreateIndex
CREATE INDEX "MeetingSession_dealId_idx" ON "MeetingSession"("dealId");

-- CreateIndex
CREATE INDEX "MeetingSession_status_idx" ON "MeetingSession"("status");

-- CreateIndex
CREATE INDEX "MeetingParticipant_sessionId_idx" ON "MeetingParticipant"("sessionId");

-- CreateIndex
CREATE INDEX "MeetingParticipant_walletAddress_idx" ON "MeetingParticipant"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingParticipant_sessionId_walletAddress_key" ON "MeetingParticipant"("sessionId", "walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingInvite_token_key" ON "MeetingInvite"("token");

-- CreateIndex
CREATE INDEX "MeetingInvite_sessionId_idx" ON "MeetingInvite"("sessionId");

-- CreateIndex
CREATE INDEX "MeetingInvite_token_idx" ON "MeetingInvite"("token");

-- CreateIndex
CREATE INDEX "MeetingInvite_walletAddress_idx" ON "MeetingInvite"("walletAddress");

-- CreateIndex
CREATE INDEX "MeetingTranscript_sessionId_startTime_idx" ON "MeetingTranscript"("sessionId", "startTime");

-- CreateIndex
CREATE INDEX "MeetingTranscript_sessionId_idx" ON "MeetingTranscript"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingTranslation_cacheKey_key" ON "MeetingTranslation"("cacheKey");

-- CreateIndex
CREATE INDEX "MeetingTranslation_transcriptId_idx" ON "MeetingTranslation"("transcriptId");

-- CreateIndex
CREATE INDEX "MeetingTranslation_sessionId_idx" ON "MeetingTranslation"("sessionId");

-- CreateIndex
CREATE INDEX "MeetingRiskEvent_sessionId_idx" ON "MeetingRiskEvent"("sessionId");

-- CreateIndex
CREATE INDEX "MeetingRiskEvent_sessionId_type_idx" ON "MeetingRiskEvent"("sessionId", "type");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealParticipant" ADD CONSTRAINT "DealParticipant_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealEvent" ADD CONSTRAINT "DealEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escrow" ADD CONSTRAINT "Escrow_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_agoraId_fkey" FOREIGN KEY ("agoraId") REFERENCES "Agora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingSession" ADD CONSTRAINT "MeetingSession_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MeetingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingInvite" ADD CONSTRAINT "MeetingInvite_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MeetingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingTranscript" ADD CONSTRAINT "MeetingTranscript_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MeetingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingTranslation" ADD CONSTRAINT "MeetingTranslation_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "MeetingTranscript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingTranslation" ADD CONSTRAINT "MeetingTranslation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MeetingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRiskEvent" ADD CONSTRAINT "MeetingRiskEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MeetingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRiskEvent" ADD CONSTRAINT "MeetingRiskEvent_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "MeetingTranscript"("id") ON DELETE SET NULL ON UPDATE CASCADE;
