# TrustRoom AI — System Design Document

> **Version:** 1.1  
> **Date:** 2026-06-20  
> **Status:** Authoritative technical design — bridges product brief → implementation plans  
> **Scope:** MVP (8 must-have modules + 4 nice-to-have)  
> **Changelog:** v1.1 — Added Sections 38-40 (API specs, DB optimization, Frontend implementation details)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Monorepo Structure & Module Map](#2-monorepo-structure--module-map)
3. [Database Schema (Complete)](#3-database-schema-complete)
4. [API Design (All Endpoints)](#4-api-design-all-endpoints)
5. [Frontend Architecture](#5-frontend-architecture)
6. [AI Pipeline Architecture](#6-ai-pipeline-architecture)
7. [Realtime Architecture (Agora + WebSocket)](#7-realtimearchitecture-agora--websocket)
8. [Solana Escrow Smart Contract](#8-solana-escrow-smart-contract)
9. [Evidence Vault Design](#9-evidence-vault-design)
10. [Security Architecture](#10-security-architecture)
11. [Deployment Architecture](#11-deployment-architecture)
12. [Phase Breakdown & Implementation Order](#12-phase-breakdown--implementation-order)
13. [Error Handling & Resilience](#13-error-handling--resilience)
14. [Testing Strategy](#14-testing-strategy)
15. [CI/CD Pipeline](#15-cicd-pipeline)
16. [Monitoring & Observability](#16-monitoring--observability)
17. [Dispute Resolution Flow](#17-dispute-resolution-flow)
18. [Reputation System Design](#18-reputation-system-design)
19. [Canonicalization & Hashing Specification](#19-canonicalization--hashing-specification)
20. [LLM Guardrails & Output Validation](#20-llm-guardrails--output-validation)
21. [Wallet Risk Scoring (On-chain Analysis)](#21-wallet-risk-scoring-on-chain-analysis)
22. [Speaker Diarization & Voice Activity Detection](#22-speaker-diarization--voice-activity-detection)
23. [Embeddings & RAG Safety Playbook](#23-embeddings--rag-safety-playbook)
24. [Transaction Simulation](#24-transaction-simulation)
25. [Audit Log Design](#25-audit-log-design)
26. [Encryption at Rest](#26-encryption-at-rest)
27. [AI Evaluation Metrics](#27-ai-evaluation-metrics)
28. [Secret Management](#28-secret-management)
29. [Observability Deep Dive](#29-observability-deep-dive)
30. [MVP Scope Clarification](#30-mvp-scope-clarification)
31. [Frontend Component Architecture](#section-31-frontend-component-architecture)
32. [Solana Escrow Program Specification](#section-32-solana-escrow-program-specification)
33. [AI Pipeline Implementation Guide](#section-33-ai-pipeline-implementation-guide)
34. [CI/CD Pipeline — Detailed Workflow](#section-34-cicd-pipeline--detailed-workflow)
35. [Cost Estimation (MVP Budget)](#section-35-cost-estimation-mvp-budget)
36. [Error Recovery & Idempotency Patterns](#section-36-error-recovery--idempotency-patterns)
37. [Frontend Enhancements](#section-37-frontend-enhancements)
38. [API Endpoint Specifications (Detailed)](#section-38-api-endpoint-specifications-detailed)
39. [Database Query Patterns & Optimization](#section-39-database-query-patterns--optimization)
40. [Frontend Component Implementation Details](#section-40-frontend-component-implementation-details)

**Appendices:**
- [Appendix A: Type Definitions](#appendix-a-type-definitions-packages-types)
- [Appendix B: Key Design Decisions Log](#appendix-b-key-design-decisions-log)

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │   Next.js Web    │  │  Mobile (Future) │  │  API Clients     │  │
│  │   (App Router)   │  │                  │  │  (B2B/MCP)       │  │
│  └────────┬─────────┘  └──────────────────┘  └──────────────────┘  │
└───────────┼─────────────────────────────────────────────────────────┘
            │ HTTPS / WSS
┌───────────┼─────────────────────────────────────────────────────────┐
│           ▼              API GATEWAY LAYER                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  NestJS API (apps/api)                                       │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │   │
│  │  │  Auth   │ │  Deals  │ │ Agora   │ │  AI     │           │   │
│  │  │ Module  │ │ Module  │ │ Module  │ │ Module  │           │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │   │
│  │  │ Escrow  │ │Evidence │ │Dispute  │ │ Notif   │           │   │
│  │  │ Module  │ │ Module  │ │ Module  │ │ Module  │           │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │  WebSocket Gateway (realtime events to frontend)    │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└───────────┬─────────────────────────────────────────────────────────┘
            │
┌───────────┼─────────────────────────────────────────────────────────┐
│           ▼              SERVICE LAYER                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐      │
│  │  AI Engine │ │  Agora     │ │  Solana    │ │  Storage   │      │
│  │  (packages │ │  Service   │ │  Service   │ │  Service   │      │
│  │   /ai)     │ │            │ │            │ │            │      │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘      │
└────────┼───────────────┼───────────────┼───────────────┼────────────┘
         │               │               │               │
┌────────┼───────────────┼───────────────┼───────────────┼────────────┐
│        ▼               ▼               ▼               ▼            │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ OpenAI/  │  │ Agora RTC +  │  │ Solana   │  │ S3/R2/       │   │
│  │ Claude   │  │ STT Pipeline │  │ Devnet   │  │ Supabase     │   │
│  │ API      │  │              │  │          │  │ Storage      │   │
│  └──────────┘  └──────────────┘  └──────────┘  └──────────────┘   │
│                     DATA LAYER                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  PostgreSQL  │  │    Redis     │  │   pgvector   │             │
│  │  (Prisma)    │  │  (BullMQ)   │  │  (embeddings)│             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo | pnpm workspaces + Turborepo | Shared types, coordinated builds, single lockfile |
| API Framework | NestJS | Module system, DI, WebSocket gateway, Guards, Pipes |
| ORM | Prisma | Type-safe, migration workflow, good NestJS integration |
| Frontend | Next.js (App Router) | SSR for landing, client components for deal room |
| Realtime | Agora RTC + NestJS WebSocket Gateway | Agora for A/V, custom WS for deal events + AI warnings |
| AI | OpenAI API (GPT-4o + Whisper) | Best balance of quality, speed, cost for MVP |
| Blockchain | Solana + Anchor | Fast finality, low fees, mature escrow patterns |
| Storage | Cloudflare R2 | S3-compatible, free egress, good for evidence files |
| Queue | BullMQ + Redis | Background AI processing, evidence hashing, notifications |

### 1.3 Data Flow Summary

```text
User Action → Next.js Client → NestJS API → Business Logic
                                              ├→ Prisma → PostgreSQL
                                              ├→ BullMQ → Redis → Background Jobs
                                              ├→ Solana RPC → On-chain Tx
                                              ├→ Agora API → Room/Token
                                              ├→ AI API → Term Extraction / Risk Classification
                                              └→ WebSocket → Client (realtime updates)
```

---

## 2. Monorepo Structure & Module Map

### 2.1 Directory Layout

```text
TrustRoomAI/
├── apps/
│   ├── api/                          # NestJS backend
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── health/               # Health check endpoint
│   │       ├── auth/                 # Wallet-based JWT auth
│   │       ├── deals/                # Deal CRUD + state machine
│   │       ├── agora/                # Agora token + room management
│   │       ├── ai/                   # AI Notary + Scam Guard endpoints
│   │       ├── escrow/               # Escrow tx recording + status
│   │       ├── evidence/             # Evidence vault endpoints
│   │       ├── disputes/             # Dispute management
│   │       ├── reputation/           # Reputation scoring
│   │       ├── notifications/        # In-app notifications
│   │       ├── websocket/            # WebSocket gateway + events
│   │       └── common/               # Guards, interceptors, filters, pipes
│   │
│   └── web/                          # Next.js frontend
│       └── src/
│           ├── app/                  # App Router pages
│           │   ├── page.tsx          # Landing page
│           │   ├── dashboard/        # User dashboard
│           │   ├── deals/            # Deal management
│           │   │   ├── new/          # Create deal
│           │   │   └── [id]/         # Deal room workspace
│           │   │       ├── page.tsx  # Main deal room
│           │   │       ├── evidence/ # Evidence vault view
│           │   │       └── dispute/  # Dispute workspace
│           │   ├── profile/          # Reputation profile
│           │   └── api/              # Next.js API routes (if needed)
│           ├── components/
│           │   ├── ui/               # Shadcn/UI primitives
│           │   ├── layout/           # Header, Sidebar, Footer
│           │   ├── wallet/           # Wallet connect components
│           │   ├── deal/             # Deal-related components
│           │   ├── agora/            # Video/voice room components
│           │   ├── ai/               # AI monitor panel, warnings
│           │   ├── escrow/           # Escrow controls
│           │   └── evidence/         # Evidence display components
│           ├── hooks/                # Custom React hooks
│           ├── lib/                  # Utilities, API client, config
│           ├── stores/               # Zustand stores
│           └── types/                # Frontend-specific types
│
├── packages/
│   ├── types/                        # Shared TypeScript types
│   │   └── src/
│   │       ├── deal.ts               # Deal, DealStatus, DealType
│   │       ├── user.ts               # User, Wallet
│   │       ├── escrow.ts             # EscrowTransaction, EscrowStatus
│   │       ├── ai.ts                 # RiskEvent, AiSummary, ExtractedTerms
│   │       ├── evidence.ts           # EvidenceFile, EvidenceBundle
│   │       ├── dispute.ts            # Dispute, DisputeMessage
│   │       ├── agora.ts              # AgoraTokenResponse, RoomConfig
│   │       ├── websocket.ts          # WS event types
│   │       └── api.ts                # ApiResponse, PaginatedResponse
│   │
│   ├── db/                           # Prisma schema + client
│   │   ├── prisma/
│   │   │   └── schema.prisma         # Complete database schema
│   │   └── src/
│   │       ├── index.ts              # Re-exports
│   │       ├── prisma.service.ts     # PrismaClient service
│   │       └── database.module.ts    # Global DB module
│   │
│   ├── ai/                           # AI engine package
│   │   └── src/
│   │       ├── index.ts
│   │       ├── llm.ts                # LLM client wrapper (OpenAI/Claude)
│   │       ├── embeddings.ts         # Embedding generation
│   │       ├── term-extractor.ts     # Structured term extraction
│   │       ├── risk-classifier.ts    # Intent classification + risk scoring
│   │       ├── scam-detector.ts      # Rule-based + LLM scam detection
│   │       ├── summarizer.ts         # Deal summarization
│   │       ├── prompts/              # System prompts for each task
│   │       │   ├── term-extraction.ts
│   │       │   ├── risk-classification.ts
│   │       │   ├── scam-detection.ts
│   │       │   └── summarization.ts
│   │       └── schemas/              # Zod schemas for structured output
│   │           ├── extracted-terms.ts
│   │           ├── risk-assessment.ts
│   │           └── scam-intent.ts
│   │
│   ├── solana/                       # Solana interaction package
│   │   └── src/
│   │       ├── index.ts
│   │       ├── connection.ts         # Solana RPC connection
│   │       ├── escrow-client.ts      # Client for escrow program
│   │       ├── token.ts              # SPL token helpers
│   │       └── types.ts              # Solana-specific types
│   │
│   └── ui/                           # Shared UI components (Shadcn)
│       └── src/
│           ├── index.ts
│           └── components/           # Reusable UI primitives
│
├── programs/
│   └── escrow/                       # Anchor escrow smart contract
│       ├── Anchor.toml
│       ├── Cargo.toml
│       └── programs/
│           └── escrow/
│               ├── Cargo.toml
│               └── src/
│                   ├── lib.rs        # Entry point
│                   ├── state.rs      # Account structures
│                   ├── errors.rs     # Custom errors
│                   ├── instructions/ # Instruction handlers
│                   │   ├── initialize.rs
│                   │   ├── deposit.rs
│                   │   ├── release.rs
│                   │   ├── refund.rs
│                   │   └── dispute.rs
│                   └── utils.rs      # Helpers
│
├── infra/
│   └── docker/
│       └── docker-compose.yml        # PostgreSQL + Redis
│
└── process/                          # Project management
    ├── context/                      # Repository context
    ├── development-protocols/        # Development protocols
    ├── features/                     # Feature-scoped plans
    └── general-plans/                # General plans + references
```

### 2.2 Module Responsibility Matrix

| Module | Package | Owner | Depends On | Key Interfaces |
|--------|---------|-------|------------|----------------|
| Auth | `apps/api/auth` | API | `packages/db`, `packages/types` | `POST /auth/nonce`, `POST /auth/verify`, `GET /auth/me` |
| Deals | `apps/api/deals` | API | `packages/db`, `packages/types` | `POST /deals`, `GET /deals`, `PATCH /deals/:id`, `POST /deals/:id/transition` |
| Agora | `apps/api/agora` | API | `packages/types` | `POST /agora/token`, `POST /agora/agent/join` |
| AI | `apps/api/ai` + `packages/ai` | API + Package | `packages/ai`, `packages/types` | `POST /ai/extract-terms`, `POST /ai/classify-risk`, `POST /ai/summarize` |
| Escrow | `apps/api/escrow` + `packages/solana` | API + Package | `packages/solana`, `packages/db` | `POST /escrow/create`, `POST /escrow/deposit-tx`, `GET /escrow/:dealId/status` |
| Evidence | `apps/api/evidence` | API | `packages/db`, `packages/types` | `POST /evidence/event`, `POST /evidence/file`, `GET /evidence/:dealId` |
| Disputes | `apps/api/disputes` | API | `packages/db`, `packages/types` | `POST /disputes`, `GET /disputes/:dealId`, `PATCH /disputes/:id/resolve` |
| Reputation | `apps/api/reputation` | API | `packages/db` | `GET /reputation/:wallet`, `POST /reputation/recalculate` |
| WebSocket | `apps/api/websocket` | API | NestJS WS Gateway | `deal:{id}` room events, `user:{wallet}` personal events |
| Frontend | `apps/web` | Web | All API endpoints | Pages, components, hooks, stores |

---

## 3. Database Schema (Complete)

### 3.1 Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Auth & Users ───────────────────────────────────────────────

model User {
  id            String   @id @default(uuid())
  wallet        String   @unique
  nonce         String?
  nonceExpiresAt DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  deals              DealParticipant[]
  reputation         ReputationScore?
  notifications      Notification[]
  auditLogs          AuditLog[]
  evidenceFiles      EvidenceFile[]     @relation("EvidenceUploader")
  disputeMessages    DisputeMessage[]
}

// ─── Deals ──────────────────────────────────────────────────────

enum DealStatus {
  DRAFT
  CREATED
  WAITING_FOR_COUNTERPARTY
  WALLET_VERIFIED
  ESCROW_CREATED
  DEPOSITED
  NEGOTIATING
  TERMS_CONFIRMED
  DELIVERY_SUBMITTED
  READY_TO_RELEASE
  RELEASED
  DISPUTED
  RESOLVED_RELEASE
  RESOLVED_REFUND
  RESOLVED_SPLIT
  CANCELLED
  REFUNDED
  EXPIRED
}

enum DealType {
  nft
  token_otc
  freelance_service
  digital_goods
  domain
  other
}

enum AiMonitoringLevel {
  BASIC
  STANDARD
  STRICT
}

model Deal {
  id                String           @id @default(uuid())
  title             String
  type              DealType
  description       String?
  amount            Decimal          @db.Decimal(18, 9)
  token             String           @default("USDC")
  status            DealStatus       @default(DRAFT)
  deadline          DateTime?
  deliveryCondition String?
  releaseCondition  String?
  refundCondition   String?
  disputeCondition  String?
  specialTerms      String[]         @default([])
  aiMonitoringLevel AiMonitoringLevel @default(STANDARD)

  // Wallet addresses
  buyerWallet       String
  sellerWallet      String?

  // On-chain references
  escrowAccountPubkey String?
  escrowVaultPubkey   String?

  // Hashes for integrity
  termsHash        String?
  evidenceHash     String?

  // Agora
  agoraChannelName String?
  agoraAppId       String?

  // Timestamps
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
  depositedAt      DateTime?
  confirmedAt      DateTime?
  deliveredAt      DateTime?
  releasedAt       DateTime?
  disputedAt       DateTime?
  resolvedAt       DateTime?
  cancelledAt      DateTime?

  // Relations
  participants     DealParticipant[]
  terms            DealTerm?
  escrowTxs        EscrowTransaction[]
  transcripts      Transcript[]
  aiSummaries      AiSummary[]
  riskEvents       RiskEvent[]
  evidenceFiles    EvidenceFile[]
  disputes         Dispute[]
  notifications    Notification[]
  auditLogs        AuditLog[]

  @@index([buyerWallet])
  @@index([sellerWallet])
  @@index([status])
  @@index([createdAt])
}

model DealParticipant {
  id        String @id @default(uuid())
  dealId    String
  wallet    String
  role      String // "buyer" | "seller"
  joinedAt  DateTime @default(now())
  confirmed Boolean @default(false)

  deal Deal @relation(fields: [dealId], references: [id], onDelete: Cascade)

  @@unique([dealId, wallet])
}

// ─── Deal Terms ─────────────────────────────────────────────────

model DealTerm {
  id                String @id @default(uuid())
  dealId            String @unique
  dealType          String
  buyerWallet       String
  sellerWallet      String
  assetOrService    String
  amount            Decimal @db.Decimal(18, 9)
  token             String
  deadline          DateTime?
  deliveryCondition String
  releaseCondition  String
  refundCondition   String?
  disputeCondition  String?
  specialTerms      String[]
  riskNotes         String[]
  version           Int    @default(1)
  confirmedByBuyer  Boolean @default(false)
  confirmedBySeller Boolean @default(false)
  buyerSignature    String?
  sellerSignature   String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  deal Deal @relation(fields: [dealId], references: [id], onDelete: Cascade)
}

// ─── Escrow ─────────────────────────────────────────────────────

enum EscrowTxType {
  DEPOSIT
  RELEASE
  REFUND
  DISPUTE
  RESOLVE
}

enum EscrowTxStatus {
  PENDING
  CONFIRMED
  FAILED
}

model EscrowTransaction {
  id            String          @id @default(uuid())
  dealId        String
  type          EscrowTxType
  status        EscrowTxStatus  @default(PENDING)
  txSignature   String?
  fromWallet    String
  toWallet      String?
  amount        Decimal         @db.Decimal(18, 9)
  token         String
  blockhash     String?
  slot          BigInt?
  confirmedAt   DateTime?
  createdAt     DateTime        @default(now())

  deal Deal @relation(fields: [dealId], references: [id], onDelete: Cascade)

  @@index([dealId])
  @@index([txSignature])
}

// ─── AI & Transcript ────────────────────────────────────────────

model Transcript {
  id          String   @id @default(uuid())
  dealId      String
  speaker     String   // "buyer" | "seller" | "ai_observer"
  wallet      String?
  content     String
  timestamp   DateTime
  sequenceNum Int
  createdAt   DateTime @default(now())

  deal Deal @relation(fields: [dealId], references: [id], onDelete: Cascade)

  @@index([dealId, sequenceNum])
}

model AiSummary {
  id        String   @id @default(uuid())
  dealId    String
  type      String   // "term_extraction" | "negotiation_summary" | "dispute_summary" | "deal_recap"
  content   String   // JSON string of structured data or markdown summary
  version   Int      @default(1)
  createdAt DateTime @default(now())

  deal Deal @relation(fields: [dealId], references: [id], onDelete: Cascade)

  @@index([dealId, type])
}

// ─── Risk & Scam Guard ──────────────────────────────────────────

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

model RiskEvent {
  id                String    @id @default(uuid())
  dealId            String
  speakerWallet     String?
  intent            String    // "early_release_request" | "off_platform" | "credential_request" | etc.
  riskLevel         RiskLevel
  score             Int       // 0-100
  reason            String
  transcriptSnippet String?
  ruleId            String?   // "SCAM_EARLY_RELEASE" | "SCAM_EXTERNAL_WALLET" | etc.
  metadata          Json?     // Additional context
  acknowledged      Boolean   @default(false)
  timestamp         DateTime
  createdAt         DateTime  @default(now())

  deal Deal @relation(fields: [dealId], references: [id], onDelete: Cascade)

  @@index([dealId, riskLevel])
  @@index([dealId, timestamp])
}

// ─── Evidence Vault ─────────────────────────────────────────────

model EvidenceFile {
  id          String   @id @default(uuid())
  dealId      String
  uploaderId  String
  fileName    String
  fileType    String   // "delivery_proof" | "screenshot" | "document" | "recording"
  fileUrl     String
  fileHash    String   // SHA-256
  fileSize    Int
  description String?
  createdAt   DateTime @default(now())

  deal     Deal @relation(fields: [dealId], references: [id], onDelete: Cascade)
  uploader User @relation("EvidenceUploader", fields: [uploaderId], references: [id])

  @@index([dealId])
}

// ─── Disputes ───────────────────────────────────────────────────

enum DisputeStatus {
  OPEN
  UNDER_REVIEW
  RESOLVED
  DISMISSED
}

enum DisputeResolution {
  RELEASE_TO_BUYER
  REFUND_TO_BUYER
  SPLIT
  DISMISSED
}

model Dispute {
  id              String            @id @default(uuid())
  dealId          String
  raisedBy        String            // wallet address
  reason          String
  status          DisputeStatus     @default(OPEN)
  resolution      DisputeResolution?
  resolutionNote  String?
  resolvedBy      String?           // arbitrator wallet
  resolvedAt      DateTime?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  deal     Deal             @relation(fields: [dealId], references: [id], onDelete: Cascade)
  messages DisputeMessage[]

  @@index([dealId])
  @@index([status])
}

model DisputeMessage {
  id         String   @id @default(uuid())
  disputeId  String
  senderWallet String
  content    String
  messageType String  @default("text") // "text" | "evidence" | "system"
  createdAt  DateTime @default(now())

  dispute Dispute @relation(fields: [disputeId], references: [id], onDelete: Cascade)

  @@index([disputeId, createdAt])
}

// ─── Reputation ─────────────────────────────────────────────────

model ReputationScore {
  id                  String  @id @default(uuid())
  wallet              String  @unique
  completedDeals      Int     @default(0)
  totalVolume         Decimal @default(0) @db.Decimal(18, 9)
  disputeCount        Int     @default(0)
  disputeRate         Float   @default(0)
  refundRate          Float   @default(0)
  onTimeDeliveryRate  Float   @default(0)
  avgRating           Float   @default(0)
  badges              String[] @default([])
  lastUpdated         DateTime @default(now())

  user User @relation(fields: [wallet], references: [wallet])
}

// ─── Notifications ──────────────────────────────────────────────

enum NotificationType {
  DEAL_INVITE
  DEAL_STATUS_CHANGE
  RISK_WARNING
  TERMS_CONFIRMED
  DELIVERY_SUBMITTED
  DISPUTE_OPENED
  DISPUTE_RESOLVED
  ESCROW_RELEASED
  ESCROW_REFUNDED
}

model Notification {
  id        String           @id @default(uuid())
  wallet    String
  type      NotificationType
  title     String
  message   String
  dealId    String?
  read      Boolean          @default(false)
  metadata  Json?
  createdAt DateTime         @default(now())

  user User @relation(fields: [wallet], references: [wallet])

  @@index([wallet, read])
  @@index([wallet, createdAt])
}

// ─── Audit Log ──────────────────────────────────────────────────

model AuditLog {
  id        String   @id @default(uuid())
  wallet    String?
  action    String   // "deal.created" | "deal.transitioned" | "escrow.deposited" | etc.
  entity    String   // "deal" | "escrow" | "dispute" | "evidence"
  entityId  String
  metadata  Json?
  ipAddress String?
  createdAt DateTime @default(now())

  user User? @relation(fields: [wallet], references: [wallet])

  @@index([entity, entityId])
  @@index([wallet])
  @@index([createdAt])
}
```

### 3.2 Schema Design Principles

1. **No PII on-chain**: All personal data stays in PostgreSQL. Only hashes go on-chain.
2. **Full audit trail**: Every state change logged in `AuditLog`.
3. **Soft references**: Wallet addresses used as identifiers (no foreign key to User for public data).
4. **JSON metadata**: Flexible fields for extensible data without schema changes.
5. **Indexing**: Strategic indexes on query-heavy columns (status, wallet, timestamps).

---

## 4. API Design (All Endpoints)

### 4.1 Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/nonce` | No | Request challenge nonce for wallet |
| `POST` | `/auth/verify` | No | Verify Ed25519 signature → JWT |
| `GET` | `/auth/me` | Yes | Get current user profile |

**Nonce Request:**
```json
// POST /auth/nonce
{ "wallet": "5FHwkrdxntdK24gQUSeqA..." }
// Response: { "nonce": "Sign this message to verify: abc123..." }
```

**Verify Request:**
```json
// POST /auth/verify
{ "wallet": "5FHwkrdxntdK24gQUSeqA...", "signature": "3sy..." }
// Response: { "accessToken": "eyJ...", "wallet": "5FHwk..." }
```

### 4.2 Deals

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/deals` | Yes | Create new deal |
| `GET` | `/deals` | Yes | List user's deals (filterable by status) |
| `GET` | `/deals/:id` | Yes | Get deal detail |
| `PATCH` | `/deals/:id` | Yes | Update deal (DRAFT/CREATED only) |
| `POST` | `/deals/:id/transition` | Yes | Transition deal state |
| `POST` | `/deals/:id/invite` | Yes | Generate invite link / notify seller |
| `POST` | `/deals/:id/join` | Yes | Seller joins deal via invite |
| `POST` | `/deals/:id/confirm-terms` | Yes | Confirm terms by wallet signature |
| `POST` | `/deals/:id/submit-delivery` | Yes | Seller submits delivery proof |
| `POST` | `/deals/:id/release` | Yes | Buyer releases escrow |
| `POST` | `/deals/:id/dispute` | Yes | Raise dispute |

**Create Deal:**
```json
// POST /deals
{
  "title": "Logo design package",
  "type": "freelance_service",
  "description": "Custom logo design with 2 revisions",
  "amount": 100,
  "token": "USDC",
  "deadline": "2026-06-25T00:00:00Z",
  "deliveryCondition": "Final logo files delivered via Google Drive link",
  "releaseCondition": "Buyer confirms delivery receipt",
  "refundCondition": "No delivery within deadline",
  "disputeCondition": "Disagreement on delivery quality",
  "aiMonitoringLevel": "STANDARD",
  "sellerWallet": "7Ytt..." // optional at creation
}
// Response: { "id": "deal_xxx", "status": "CREATED", "inviteLink": "..." }
```

**Transition Deal:**
```json
// POST /deals/:id/transition
{
  "action": "DEPOSIT",
  "metadata": {
    "txSignature": "5Kj3...",
    "amount": 100,
    "token": "USDC"
  }
}
// Valid transitions:
// CREATED → WAITING_FOR_COUNTERPARTY (after invite sent)
// WAITING_FOR_COUNTERPARTY → WALLET_VERIFIED (after seller joins)
// WALLET_VERIFIED → ESCROW_CREATED (after escrow account created on-chain)
// ESCROW_CREATED → DEPOSITED (after buyer deposits)
// DEPOSITED → NEGOTIATING (after both join Agora room)
// NEGOTIATING → TERMS_CONFIRMED (after both confirm terms)
// TERMS_CONFIRMED → DELIVERY_SUBMITTED (after seller submits proof)
// DELIVERY_SUBMITTED → READY_TO_RELEASE (after buyer verifies)
// READY_TO_RELEASE → RELEASED (after buyer releases)
// Any active state → DISPUTED (after dispute raised)
```

### 4.3 Agora

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/agora/token` | Yes | Generate Agora RTC token for deal room |
| `POST` | `/agora/agent/join` | Yes (internal) | AI agent joins room for STT |
| `POST` | `/agora/transcript-event` | Yes (internal) | Receive transcript event from Agora STT |

**Agora Token:**
```json
// POST /agora/token
{ "dealId": "deal_xxx", "role": "publisher" }
// Response: { "token": "...", "channel": "deal_deal_xxx", "appId": "...", "uid": 123 }
```

**Transcript Event (from Agora STT webhook):**
```json
// POST /agora/transcript-event
{
  "dealId": "deal_xxx",
  "speaker": "seller",
  "wallet": "7Ytt...",
  "content": "I will send the files after you release the payment",
  "timestamp": "2026-06-20T10:05:22Z",
  "sequenceNum": 42
}
```

### 4.4 AI

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/ai/extract-terms` | Yes | Extract structured terms from transcript |
| `POST` | `/ai/classify-risk` | Yes (internal) | Classify risk of a transcript segment |
| `POST` | `/ai/summarize-deal` | Yes | Generate deal summary |
| `POST` | `/ai/generate-dispute-report` | Yes | Generate dispute evidence report |
| `GET` | `/ai/risk-score/:dealId` | Yes | Get current aggregated risk score |

**Extract Terms:**
```json
// POST /ai/extract-terms
{ "dealId": "deal_xxx" }
// Response: {
//   "dealType": "freelance_service",
//   "assetOrService": "Logo design package with 2 revisions",
//   "amount": 100,
//   "token": "USDC",
//   "deadline": "2026-06-25T00:00:00Z",
//   "deliveryCondition": "Final logo files via Google Drive",
//   "releaseCondition": "Buyer confirms receipt",
//   "refundCondition": "No delivery by deadline",
//   "disputeCondition": "Quality disagreement",
//   "specialTerms": ["2 revisions included"],
//   "riskNotes": ["Deadline is tight for design work"],
//   "confidence": 0.92
// }
```

**Classify Risk:**
```json
// POST /ai/classify-risk
{
  "dealId": "deal_xxx",
  "content": "Release first, I will send the file later",
  "speaker": "seller",
  "wallet": "7Ytt..."
}
// Response: {
//   "intent": "early_release_request",
//   "riskLevel": "HIGH",
//   "score": 40,
//   "reason": "Seller requesting escrow release before delivery proof",
//   "ruleId": "SCAM_EARLY_RELEASE",
//   "suggestedAction": "Warn buyer. Do not release until delivery is verified."
// }
```

### 4.5 Escrow

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/escrow/create` | Yes | Create escrow account on-chain |
| `POST` | `/escrow/deposit-tx` | Yes | Record deposit transaction |
| `POST` | `/escrow/release-tx` | Yes | Record release transaction |
| `POST` | `/escrow/refund-tx` | Yes | Record refund transaction |
| `POST` | `/escrow/dispute-tx` | Yes | Record dispute lock transaction |
| `GET` | `/escrow/:dealId/status` | Yes | Get escrow status + tx history |

### 4.6 Evidence

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/evidence/event` | Yes (internal) | Record evidence event (risk, transcript, etc.) |
| `POST` | `/evidence/file` | Yes | Upload evidence file |
| `GET` | `/evidence/:dealId` | Yes | Get all evidence for a deal |
| `POST` | `/evidence/:dealId/anchor-hash` | Yes | Compute and anchor evidence hash on-chain |
| `GET` | `/evidence/:dealId/report` | Yes | Generate dispute report |

### 4.7 Disputes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/disputes` | Yes | Raise dispute for a deal |
| `GET` | `/disputes/:dealId` | Yes | Get dispute detail |
| `POST` | `/disputes/:id/messages` | Yes | Add message to dispute |
| `PATCH` | `/disputes/:id/resolve` | Yes (admin) | Resolve dispute |

### 4.8 Reputation

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/reputation/:wallet` | No | Get public reputation profile |
| `POST` | `/reputation/recalculate` | Yes (internal) | Recalculate reputation after deal |

### 4.9 Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/notifications` | Yes | List user notifications |
| `PATCH` | `/notifications/:id/read` | Yes | Mark as read |
| `PATCH` | `/notifications/read-all` | Yes | Mark all as read |

### 4.10 WebSocket Events

```typescript
// Client → Server
interface ClientEvents {
  'deal:join': { dealId: string };
  'deal:leave': { dealId: string };
  'deal:typing': { dealId: string; content: string };
}

// Server → Client
interface ServerEvents {
  // Deal state changes
  'deal:status-changed': { dealId: string; status: DealStatus; timestamp: string };

  // AI events
  'ai:transcript': { dealId: string; speaker: string; content: string; sequenceNum: number };
  'ai:term-extracted': { dealId: string; terms: ExtractedTerms };
  'ai:summary': { dealId: string; summary: string };

  // Risk events
  'risk:warning': {
    dealId: string;
    intent: string;
    riskLevel: RiskLevel;
    score: number;
    message: string;
    speaker: string;
  };
  'risk:score-updated': { dealId: string; totalScore: number; level: RiskLevel };

  // Escrow events
  'escrow.deposit.confirmed': { dealId: string; amount: string; txSignature: string };
  'escrow.release.confirmed': { dealId: string; txSignature: string };

  // Notifications
  'notification:new': { id: string; type: string; title: string; message: string };
}
```

---

## 5. Frontend Architecture

### 5.1 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 14+ (App Router) | SSR landing, client-side deal room |
| Styling | Tailwind CSS + shadcn/ui | Consistent, accessible UI components |
| State | Zustand | Lightweight global state (auth, deals, websocket) |
| Server State | TanStack Query (React Query) | API data fetching, caching, mutations |
| Wallet | @solana/wallet-adapter-react | Phantom/Solflare connection |
| Realtime | Socket.io client | WebSocket connection to NestJS gateway |
| Video/Voice | Agora RTC SDK (@videosdk or @agora-rtc) | Realtime communication |
| Forms | React Hook Form + Zod | Form validation |
| Charts | Recharts or Tremor | Dashboard visualizations |

### 5.2 Page Structure

```text
/                           → Landing Page (SSR)
/login                      → Wallet connect page
/dashboard                  → User dashboard (deals list, stats)
/deals/new                  → Create deal form
/deals/:id                  → Deal Room Workspace (main screen)
/deals/:id/evidence         → Evidence Vault view
/deals/:id/dispute          → Dispute workspace
/profile/:wallet            → Public reputation profile
/profile                    → Own profile + settings
```

### 5.3 Key Components

#### Landing Page (`/`)
```text
LandingPage
├── HeroSection          # "Secure high-risk P2P deals..."
├── ProblemSection       # Pain points
├── SolutionSection      # AI + Escrow + Evidence
├── UseCasesSection      # NFT, OTC, Freelance, etc.
├── HowItWorksSection    # Step-by-step flow
├── CTASection           # Start/Join deal buttons
└── Footer
```

#### Dashboard (`/dashboard`)
```text
DashboardPage
├── StatsCards           # Active deals, escrowed amount, reputation
├── DealsTable           # Filterable deal list
│   ├── DealRow          # Status badge, counterparty, amount, actions
│   └── StatusFilter     # Filter by deal status
├── RiskAlertsPanel      # Recent risk warnings
└── CreateDealButton     # Primary CTA
```

#### Deal Room Workspace (`/deals/:id`) — Most Important Screen
```text
DealRoomPage
├── DealHeader           # Deal ID, Status, Risk Level, Escrow State
├── MainContent
│   ├── VideoVoiceRoom   # Agora RTC integration
│   │   ├── RemoteVideo  # Counterparty video
│   │   ├── LocalVideo   # Self video
│   │   ├── AIObserver   # AI avatar/indicator
│   │   └── RoomControls # Mute, camera, leave
│   └── DealControlPanel # Right sidebar
│       ├── DealInfo     # Amount, token, wallets
│       ├── EscrowStatus # Deposit/Release/Dispute buttons
│       ├── DeliveryProof # Upload proof button (seller)
│       └── TermConfirmation # Confirm terms button
├── AIMonitorPanel       # Bottom panel
│   ├── RiskIndicator    # Current risk level (color-coded)
│   ├── LatestWarning    # Most recent risk warning
│   ├── ExtractedTerms   # AI-extracted deal terms
│   └── SuggestedAction  # AI recommended next step
└── TranscriptTimeline   # Bottom expandable panel
    ├── TranscriptEntry  # Speaker-separated lines with timestamps
    ├── RiskEventMarker  # Risk events inline
    └── TxHashMarker     # Transaction hashes inline
```

#### Evidence Vault (`/deals/:id/evidence`)
```text
EvidenceVaultPage
├── DealSummary          # Final deal overview
├── TermsSection         # Confirmed terms with signatures
├── TranscriptSection    # Full transcript
├── RiskEventsSection    # All risk warnings
├── DeliveryProofSection # Uploaded proof files
├── EscrowHistorySection # All escrow transactions
├── EvidenceHashSection  # On-chain anchored hash
└── ExportButton         # Download dispute report (PDF)
```

### 5.4 State Management

```typescript
// stores/auth-store.ts
interface AuthStore {
  wallet: string | null;
  token: string | null;
  isAuthenticated: boolean;
  connect: (wallet: string) => Promise<void>;
  disconnect: () => void;
}

// stores/deal-store.ts
interface DealStore {
  currentDeal: Deal | null;
  dealStatus: DealStatus;
  riskScore: number;
  riskLevel: RiskLevel;
  latestWarning: RiskEvent | null;
  extractedTerms: ExtractedTerms | null;
  setCurrentDeal: (deal: Deal) => void;
  updateRiskScore: (score: number, level: RiskLevel) => void;
  addRiskWarning: (warning: RiskEvent) => void;
}

// stores/websocket-store.ts
interface WebSocketStore {
  connected: boolean;
  joinDealRoom: (dealId: string) => void;
  leaveDealRoom: (dealId: string) => void;
  onRiskWarning: (handler: (event: RiskEvent) => void) => void;
  onTranscript: (handler: (event: TranscriptEvent) => void) => void;
}
```

### 5.5 Key Hooks

```typescript
// hooks/use-deal.ts — Fetch + cache deal data
// hooks/use-deal-transitions.ts — State machine transitions
// hooks/use-agora.ts — Agora RTC connection + events
// hooks/use-websocket.ts — WebSocket connection + event handlers
// hooks/use-risk-monitor.ts — Realtime risk score + warnings
// hooks/use-transcript.ts — Transcript stream + display
// hooks/use-escrow.ts — Escrow status + actions
// hooks/use-wallet.ts — Wallet connection wrapper
```

---

## 6. AI Pipeline Architecture

### 6.1 Pipeline Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                    AI PIPELINE                                   │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Agora STT   │───→│  Transcript  │───→│  Rule-Based  │      │
│  │  (Realtime)  │    │  Normalizer  │    │  Detector    │      │
│  └──────────────┘    └──────────────┘    └──────┬───────┘      │
│                                                  │               │
│                                          ┌───────▼───────┐      │
│                                          │  LLM Intent   │      │
│                                          │  Classifier   │      │
│                                          └───────┬───────┘      │
│                                                  │               │
│  ┌──────────────┐    ┌──────────────┐    ┌───────▼───────┐      │
│  │  Scam Playbook│───→│   Risk       │◄───│  Deal State   │      │
│  │  Similarity  │    │  Aggregator  │    │  Checker      │      │
│  └──────────────┘    └──────┬───────┘    └───────────────┘      │
│                              │                                    │
│                    ┌─────────▼─────────┐                         │
│                    │  WebSocket Event  │                         │
│                    │  → Frontend       │                         │
│                    │  → Evidence Vault │                         │
│                    └───────────────────┘                         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  BACKGROUND (BullMQ)                                      │   │
│  │  • Term Extraction (periodic or on-demand)                │   │
│  │  • Deal Summarization (on state change)                   │   │
│  │  • Dispute Report Generation                              │   │
│  │  • Evidence Hash Computation                              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 AI Tasks & Models

| Task | Model | Latency Target | Trigger |
|------|-------|---------------|---------|
| Speech-to-Text | Agora STT / Whisper | < 2s | Realtime audio stream |
| Term Extraction | GPT-4o (structured output) | < 5s | On-demand or periodic |
| Risk Classification | GPT-4o-mini (fast) | < 1s | Each transcript segment |
| Scam Detection (rules) | Custom rules engine | < 10ms | Each transcript segment |
| Scam Playbook Similarity | Embeddings + cosine similarity | < 100ms | Each transcript segment |
| Deal Summarization | GPT-4o | < 5s | On state change |
| Dispute Report | GPT-4o | < 10s | On dispute creation |

### 6.3 Risk Scoring Algorithm

```typescript
function calculateRiskScore(events: RiskEvent[], dealState: DealStatus): RiskAssessment {
  // Base scores from detection layers
  const conversationRisk = sumRiskScores(events.filter(e => e.source === 'conversation'));
  const walletRisk = getWalletRiskScore(dealState.buyerWallet); // 0-20
  const escrowStateRisk = getEscrowStateRisk(dealState);        // 0-15
  const evidenceRisk = getEvidenceRisk(dealState);               // 0-10

  // Repetition penalty: same intent detected multiple times
  const repetitionPenalty = calculateRepetitionPenalty(events);  // 0-20

  const totalScore = Math.min(100,
    conversationRisk + walletRisk + escrowStateRisk + evidenceRisk + repetitionPenalty
  );

  const level: RiskLevel =
    totalScore >= 80 ? 'CRITICAL' :
    totalScore >= 50 ? 'HIGH' :
    totalScore >= 25 ? 'MEDIUM' : 'LOW';

  const actions: string[] = [];
  if (level === 'HIGH') actions.push('STRONG_WARNING', 'REQUIRE_CONFIRMATION');
  if (level === 'CRITICAL') actions.push('LOCK_RELEASE', 'SUGGEST_DISPUTE', 'NOTIFY_ADMIN');

  return { totalScore, level, actions, breakdown: { conversationRisk, walletRisk, escrowStateRisk, evidenceRisk, repetitionPenalty } };
}
```

### 6.4 Scam Detection Rules

```typescript
const SCAM_RULES: ScamRule[] = [
  {
    ruleId: 'SCAM_OFF_PLATFORM',
    keywords: ['telegram', 'zalo', 'whatsapp', 'private chat', 'off platform', 'text me'],
    intent: 'off_platform_request',
    riskLevel: 'HIGH',
    score: 35,
  },
  {
    ruleId: 'SCAM_EARLY_RELEASE',
    patterns: [/release\s+(first|now|before|early)/i, /send\s+(the\s+)?payment\s+first/i],
    intent: 'early_release_request',
    riskLevel: 'HIGH',
    score: 40,
    dealStateGuard: (state) => !['DELIVERY_SUBMITTED', 'READY_TO_RELEASE', 'RELEASED'].includes(state),
  },
  {
    ruleId: 'SCAM_CREDENTIAL_REQUEST',
    keywords: ['seed phrase', 'private key', 'password', 'otp', '2fa code', 'recovery phrase'],
    intent: 'credential_request',
    riskLevel: 'CRITICAL',
    score: 90,
  },
  {
    ruleId: 'SCAM_EXTERNAL_WALLET',
    walletDetector: true,
    intent: 'external_wallet',
    riskLevel: 'CRITICAL',
    score: 80,
    condition: (detectedWallet, deal) =>
      detectedWallet !== deal.buyerWallet && detectedWallet !== deal.sellerWallet && detectedWallet !== deal.escrowAccountPubkey,
  },
  {
    ruleId: 'SCAM_TIME_PRESSURE',
    patterns: [/do it now/i, /last chance/i, /only \d+ minutes/i, /hurry/i, /expir/i],
    intent: 'time_pressure',
    riskLevel: 'MEDIUM',
    score: 20,
  },
  {
    ruleId: 'SCAM_IMPERSONATION',
    keywords: ['i am support', 'i am admin', 'i am arbitrator', 'trust me i work for'],
    intent: 'impersonation',
    riskLevel: 'HIGH',
    score: 45,
  },
  {
    ruleId: 'SCAM_TERM_CHANGE',
    intent: 'term_change_after_deposit',
    riskLevel: 'HIGH',
    score: 35,
    dealStateGuard: (state) => ['DEPOSITED', 'NEGOTIATING', 'TERMS_CONFIRMED'].includes(state),
    llmRequired: true, // Needs LLM to detect semantic term changes
  },
];
```

### 6.5 LLM Prompt Templates

**Term Extraction Prompt:**
```typescript
const TERM_EXTRACTION_PROMPT = `You are a deal notary AI. Extract structured deal terms from the following conversation transcript.

Deal context:
- Deal ID: {dealId}
- Deal type: {dealType}
- Initial amount: {amount} {token}

Transcript:
{transcript}

Extract the following fields as JSON:
{
  "deal_type": "freelance_service | nft | token_otc | digital_goods | domain | other",
  "asset_or_service": "string - what is being traded",
  "amount": "string - agreed amount",
  "token": "SOL | USDC | SPL_TOKEN",
  "deadline": "ISO datetime or null",
  "delivery_condition": "string - what constitutes delivery",
  "release_condition": "string - when funds should be released",
  "refund_condition": "string - when buyer gets refund",
  "dispute_condition": "string - what happens in dispute",
  "special_terms": ["string"],
  "risk_notes": ["string - any concerning aspects"],
  "confidence": "number 0-1"
}

Rules:
- Only extract terms that were explicitly discussed or agreed
- If a term was not discussed, set it to null
- Flag any ambiguous or contradictory terms in risk_notes
- confidence reflects how clearly terms were stated`;
```

**Risk Classification Prompt:**
```typescript
const RISK_CLASSIFICATION_PROMPT = `You are a fraud detection AI for P2P crypto transactions. Analyze the following message for scam indicators.

Current deal state: {dealState}
Speaker role: {speakerRole} (buyer/seller)
Message: "{content}"

Classify the intent and risk:
{
  "intent": "one of: normal_negotiation | early_release_request | off_platform_request | credential_request | external_wallet | time_pressure | impersonation | term_change | fake_proof | ambiguous_terms | other",
  "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
  "score": "number 0-100",
  "reason": "brief explanation",
  "suggested_action": "what the system should do"
}

Be conservative: flag suspicious behavior even if it might be innocent.
Do NOT flag normal negotiation or polite conversation.`;
```

---

## 7. Realtime Architecture (Agora + WebSocket)

### 7.1 Connection Flow

```text
1. Buyer creates deal → API creates Agora channel
2. Both parties join deal room → Frontend connects to Agora RTC
3. AI Agent joins channel via Agora Bot → receives audio stream
4. Agora STT processes audio → sends transcript events to webhook
5. NestJS receives transcript → processes through AI pipeline
6. NestJS WebSocket Gateway → pushes events to connected clients
```

### 7.2 Agora Integration

```typescript
// Agora channel naming: deal_{dealId}
// Participants: buyer, seller, ai_observer (bot)

interface AgoraConfig {
  appId: string;
  appCertificate: string;
  // Token expiry: 24 hours (deal duration)
}

// Token generation (server-side)
function generateAgoraToken(channelName: string, uid: number, role: 'publisher' | 'subscriber'): string {
  // Use Agora RTC Token builder with RtcTokenBuild
  // Role: publisher for buyer/seller, subscriber for AI observer
}
```

### 7.3 WebSocket Gateway

```typescript
// websocket.gateway.ts
@WebSocketGateway({ cors: true, namespace: '/ws' })
export class DealWebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    // Authenticate via JWT token in handshake
    const token = client.handshake.auth.token;
    const payload = this.jwtService.verify(token);
    client.data.wallet = payload.wallet;
  }

  // Client joins a deal room
  @SubscribeMessage('deal:join')
  handleJoinDeal(client: Socket, payload: { dealId: string }) {
    // Verify user is participant
    client.join(`deal:${payload.dealId}`);
  }

  // Emit risk warning to all participants in a deal
  emitRiskWarning(dealId: string, warning: RiskEvent) {
    this.server.to(`deal:${dealId}`).emit('risk:warning', warning);
  }

  // Emit transcript line
  emitTranscript(dealId: string, event: TranscriptEvent) {
    this.server.to(`deal:${dealId}`).emit('ai:transcript', event);
  }

  // Emit deal status change
  emitStatusChange(dealId: string, status: DealStatus) {
    this.server.to(`deal:${dealId}`).emit('deal:status-changed', { dealId, status });
  }
}
```

### 7.4 Event Flow Diagram

```text
Agora Audio → Agora STT → Webhook → NestJS API
                                        │
                                        ├──→ Store transcript in DB
                                        ├──→ Run rule-based detector (< 10ms)
                                        ├──→ Queue LLM classification (BullMQ)
                                        ├──→ Check deal state validity
                                        └──→ Aggregate risk score
                                                │
                                                ├──→ WebSocket → Frontend AI Monitor Panel
                                                ├──→ Store risk event in DB
                                                └──→ If CRITICAL → Lock release + Notify admin
```

---

## 8. Solana Escrow Smart Contract

### 8.1 Account Structure

```rust
#[account]
pub struct EscrowDeal {
    pub buyer: Pubkey,           // 32 bytes
    pub seller: Pubkey,          // 32 bytes
    pub mint: Pubkey,            // 32 bytes (SPL token mint)
    pub amount: u64,             // 8 bytes
    pub deal_id_hash: [u8; 32],  // 32 bytes (SHA-256 of off-chain deal ID)
    pub terms_hash: [u8; 32],    // 32 bytes
    pub evidence_hash: [u8; 32], // 32 bytes
    pub status: EscrowStatus,    // 1 byte (enum)
    pub created_at: i64,         // 8 bytes
    pub updated_at: i64,         // 8 bytes
    pub bump: u8,                // 1 byte
}
// Total: ~178 bytes + 8 byte discriminator = 186 bytes

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EscrowStatus {
    Initialized,    // Escrow created, waiting for deposit
    Deposited,      // Funds deposited
    DeliverySubmitted, // Seller submitted delivery proof
    Released,       // Funds released to seller
    Refunded,       // Funds refunded to buyer
    Disputed,       // Funds locked for dispute resolution
    Resolved,       // Dispute resolved
}
```

### 8.2 Instructions

```rust
// 1. Initialize escrow (creates PDA account)
pub fn initialize(ctx: Context<Initialize>, deal_id_hash: [u8; 32], amount: u64) -> Result<()>

// 2. Deposit funds (buyer transfers tokens to escrow PDA)
pub fn deposit(ctx: Context<Deposit>) -> Result<()>

// 3. Confirm delivery (seller signals delivery submitted)
pub fn submit_delivery(ctx: Context<SubmitDelivery>, evidence_hash: [u8; 32]) -> Result<()>

// 4. Release funds (buyer releases to seller)
pub fn release(ctx: Context<Release>) -> Result<()>

// 5. Refund (timeout or mutual agreement)
pub fn refund(ctx: Context<Refund>) -> Result<()>

// 6. Raise dispute (locks funds)
pub fn raise_dispute(ctx: Context<RaiseDispute>) -> Result<()>

// 7. Resolve dispute (admin/arbitrator)
pub fn resolve(ctx: Context<Resolve>, resolution: DisputeResolution) -> Result<()>

// 8. Update hashes (anchor terms/evidence hash on-chain)
pub fn update_hashes(ctx: Context<UpdateHashes>, terms_hash: [u8; 32], evidence_hash: [u8; 32]) -> Result<()>
```

### 8.3 PDA Derivation

```rust
// Escrow account PDA
let (escrow_pda, bump) = Pubkey::find_program_address(
    &[b"escrow", deal_id_hash.as_ref()],
    &program_id,
);

// Token vault PDA (holds the actual tokens)
let (vault_pda, vault_bump) = Pubkey::find_program_address(
    &[b"vault", escrow_pda.as_ref()],
    &program_id,
);
```

### 8.4 State Transitions (On-Chain)

```text
Initialized → Deposited (buyer deposits)
Deposited → DeliverySubmitted (seller submits)
DeliverySubmitted → Released (buyer releases)
Deposited → Refunded (timeout/mutual)
Deposited → Disputed (either party)
DeliverySubmitted → Disputed (either party)
Disputed → Resolved (admin: release/refund/split)
```

### 8.5 Client Integration (`packages/solana`)

```typescript
// escrow-client.ts
class EscrowClient {
  constructor(private connection: Connection, private program: Program<Escrow>) {}

  async initialize(dealIdHash: string, amount: string, buyerKeypair: Keypair): Promise<string>
  async deposit(escrowPda: PublicKey, buyerKeypair: Keypair, tokenMint: PublicKey): Promise<string>
  async release(escrowPda: PublicKey, buyerKeypair: Keypair): Promise<string>
  async refund(escrowPda: PublicKey, authorityKeypair: Keypair): Promise<string>
  async raiseDispute(escrowPda: PublicKey, authorityKeypair: Keypair): Promise<string>
  async resolve(escrowPda: PublicKey, adminKeypair: Keypair, resolution: DisputeResolution): Promise<string>
  async getEscrowStatus(escrowPda: PublicKey): Promise<EscrowDeal>
  async updateHashes(escrowPda: PublicKey, termsHash: string, evidenceHash: string): Promise<string>
}
```

---

## 9. Evidence Vault Design

### 9.1 Evidence Collection Points

| Event | Collector | Storage | On-Chain Anchor |
|-------|-----------|---------|-----------------|
| Transcript line | Agora STT webhook | PostgreSQL (`transcripts`) | No (too voluminous) |
| Risk warning | AI pipeline | PostgreSQL (`risk_events`) | No (off-chain) |
| Extracted terms | AI notary | PostgreSQL (`ai_summaries`) | `terms_hash` ✓ |
| Deal summary | AI notary | PostgreSQL (`ai_summaries`) | No |
| Delivery proof file | User upload | R2/S3 (`evidence_files`) | File hash ✓ |
| Escrow deposit tx | Solana watcher | PostgreSQL (`escrow_transactions`) | Tx signature ✓ |
| Escrow release tx | Solana watcher | PostgreSQL (`escrow_transactions`) | Tx signature ✓ |
| Terms confirmation | User signature | PostgreSQL (`deal_terms`) | `terms_hash` ✓ |

### 9.2 Evidence Hash Computation

```typescript
async function computeEvidenceHash(dealId: string): Promise<string> {
  const evidence = {
    dealId,
    terms: await prisma.dealTerm.findUnique({ where: { dealId } }),
    transcripts: await prisma.transcript.findMany({ where: { dealId }, orderBy: { sequenceNum: 'asc' } }),
    riskEvents: await prisma.riskEvent.findMany({ where: { dealId }, orderBy: { timestamp: 'asc' } }),
    aiSummaries: await prisma.aiSummary.findMany({ where: { dealId } }),
    escrowTxs: await prisma.escrowTransaction.findMany({ where: { dealId }, orderBy: { createdAt: 'asc' } }),
    evidenceFiles: await prisma.evidenceFile.findMany({ where: { dealId } }),
  };

  const canonical = canonicalize(evidence); // Deterministic JSON serialization
  return createHash('sha256').update(canonical).digest('hex');
}
```

### 9.3 Evidence Bundle Structure

```typescript
interface EvidenceBundle {
  dealId: string;
  deal: Deal;
  terms: DealTerm;
  transcripts: Transcript[];
  riskEvents: RiskEvent[];
  aiSummaries: AiSummary[];
  escrowTransactions: EscrowTransaction[];
  evidenceFiles: EvidenceFile[];
  disputes: Dispute[];
  computedHash: string;
  anchoredAt?: Date;
  onChainTxSignature?: string;
}
```

### 9.4 File Upload Flow

```text
1. Client requests presigned URL from API
2. API generates R2/S3 presigned PUT URL
3. Client uploads file directly to R2/S3
4. Client notifies API with file metadata
5. API computes SHA-256 hash of file
6. API stores file record in evidence_files table
7. Hash is included in next evidence hash computation
```

---

## 10. Security Architecture

### 10.1 Authentication Flow

```text
1. User clicks "Connect Wallet" → Phantom/Solflare popup
2. Wallet returns public key
3. Frontend calls POST /auth/nonce with wallet address
4. API generates random nonce, stores with 5-min expiry
5. Frontend requests wallet to sign the nonce message
6. Frontend calls POST /auth/verify with wallet + signature
7. API verifies Ed25519 signature using @solana/web3.js
8. API returns JWT (expiry: 24h) with wallet address as subject
9. Frontend stores JWT, includes in Authorization header
```

### 10.2 Authorization Rules

| Resource | Rule |
|----------|------|
| Create deal | Any authenticated user |
| View deal | Only buyer or seller participant |
| Update deal | Only creator, only in DRAFT/CREATED status |
| Transition deal | Only relevant party (e.g., only buyer can deposit/release) |
| Submit delivery | Only seller |
| Raise dispute | Only buyer or seller |
| Resolve dispute | Only admin/arbitrator role |
| Upload evidence | Only deal participants |
| View evidence | Only deal participants |

### 10.3 Security Measures

| Layer | Measure |
|-------|---------|
| Transport | HTTPS only (TLS 1.3) |
| Auth | JWT with short expiry (24h), wallet-based (no passwords) |
| API | Rate limiting (100 req/min per wallet), input validation (Zod) |
| Database | Parameterized queries (Prisma), row-level access checks |
| Storage | Presigned URLs with expiry, no public buckets |
| WebSocket | JWT authentication on connection, room-based access control |
| Smart Contract | PDA-based authority, no admin keys, program-owned vaults |
| Evidence | SHA-256 hashing, tamper-evident chain, on-chain anchoring |
| Secrets | Environment variables, never in code or on-chain |

### 10.4 What We NEVER Do

1. ❌ Never ask users for seed phrases, private keys, OTP, or passwords
2. ❌ Never store sensitive data on-chain (transcripts, files, PII)
3. ❌ Never let AI automatically release or seize funds
4. ❌ Never allow cross-deal data access
5. ❌ Never skip signature verification for state transitions

---

## 11. Deployment Architecture

### 11.1 MVP Infrastructure

```text
┌─────────────────────────────────────────────────┐
│  Vercel (Frontend)                               │
│  • Next.js app                                   │
│  • Edge functions for landing page               │
│  • Automatic deployments from main branch        │
└─────────────────────┬───────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────┐
│  Railway / Render (API)                          │
│  • NestJS API server                             │
│  • WebSocket server                              │
│  • BullMQ workers                                │
└──────┬──────────────┬───────────────────────────┘
       │              │
┌──────▼──────┐ ┌─────▼──────────────────────────┐
│  Supabase   │ │  Cloudflare R2                  │
│  (Postgres) │ │  (Evidence file storage)        │
│  + pgvector │ │                                 │
└─────────────┘ └────────────────────────────────┘
       │
┌──────▼──────────────────────────────────────────┐
│  Upstash (Redis)                                 │
│  • BullMQ job queue                              │
│  • Session cache                                 │
│  • Rate limiting                                 │
└─────────────────────────────────────────────────┘
       │
┌──────▼──────────────────────────────────────────┐
│  Solana Devnet                                    │
│  • Escrow smart contract                          │
│  • SPL Token transfers                            │
└─────────────────────────────────────────────────┘
```

### 11.2 Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://...

# JWT
JWT_SECRET=...
JWT_EXPIRY=24h

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
ESCROW_PROGRAM_ID=...

# Agora
AGORA_APP_ID=...
AGORA_APP_CERTIFICATE=...

# AI
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o
OPENAI_FAST_MODEL=gpt-4o-mini

# Storage
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=trustroom-evidence

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws
NEXT_PUBLIC_AGORA_APP_ID=...
NEXT_PUBLIC_SOLANA_NETWORK=devnet
```

---

## 12. Phase Breakdown & Implementation Order

### Phase 1: Foundation (Week 1-2) ✅ IN PROGRESS
**Goal:** Working API with auth + deals + database

- [x] Monorepo setup (pnpm + Turborepo)
- [x] Prisma schema (complete)
- [x] NestJS API scaffold
- [x] Auth module (nonce + verify + JWT)
- [x] Deals module (CRUD + state machine)
- [ ] Database migrations + seed data
- [ ] API tests (unit + e2e)
- [ ] Docker Compose for local dev

### Phase 2: Frontend Foundation (Week 2-3)
**Goal:** Next.js app with wallet connect + deal creation + dashboard

- [ ] Next.js app scaffold (App Router)
- [ ] Tailwind + shadcn/ui setup
- [ ] Wallet adapter integration (Phantom/Solflare)
- [ ] Auth flow (connect → nonce → sign → JWT)
- [ ] Landing page
- [ ] Dashboard page (deal list)
- [ ] Create deal page (form)
- [ ] Deal detail page (basic)
- [ ] API client + TanStack Query setup
- [ ] Zustand stores (auth, deals)

### Phase 3: Deal Room + Agora (Week 3-4)
**Goal:** Realtime deal room with video/voice + transcript

- [ ] Agora token generation (API)
- [ ] Agora RTC integration (frontend)
- [ ] Video/voice room component
- [ ] Transcript pipeline (Agora STT → API → frontend)
- [ ] WebSocket gateway (NestJS)
- [ ] Realtime event handling (frontend)
- [ ] Deal room layout (video + control panel + AI panel)
- [ ] Deal state transition UI

### Phase 4: AI Pipeline (Week 4-5)
**Goal:** AI Deal Notary + Scam Guard working in realtime

- [ ] `packages/ai` — LLM client wrapper
- [ ] Term extraction (structured output)
- [ ] Risk classification (per transcript segment)
- [ ] Rule-based scam detector
- [ ] Risk score aggregation
- [ ] AI Monitor Panel (frontend)
- [ ] Realtime risk warnings (WebSocket → UI)
- [ ] Deal summarization
- [ ] BullMQ background jobs

### Phase 5: Solana Escrow (Week 5-6)
**Goal:** Working escrow on devnet

- [ ] Anchor escrow program (Rust)
- [ ] Deploy to Solana devnet
- [ ] `packages/solana` — Client library
- [ ] Escrow API endpoints
- [ ] Deposit flow (frontend → API → on-chain)
- [ ] Release flow
- [ ] Refund flow
- [ ] Escrow status display (frontend)

### Phase 6: Evidence Vault (Week 6-7)
**Goal:** Complete evidence collection + display

- [ ] Evidence event recording (all pipeline points)
- [ ] File upload (R2 presigned URLs)
- [ ] SHA-256 evidence hashing
- [ ] Evidence hash anchoring (on-chain)
- [ ] Evidence Vault page (frontend)
- [ ] Dispute report generation (PDF)

### Phase 7: Disputes + Reputation (Week 7-8)
**Goal:** Dispute flow + basic reputation

- [ ] Dispute module (API)
- [ ] Dispute workspace (frontend)
- [ ] Admin dispute view (basic)
- [ ] Reputation scoring algorithm
- [ ] Reputation profile page (frontend)
- [ ] Badge system (basic)

### Phase 8: Polish + Deploy (Week 8-9)
**Goal:** Production-ready MVP

- [ ] Error handling + edge cases
- [ ] Rate limiting
- [ ] Monitoring (Sentry + PostHog)
- [ ] Performance optimization
- [ ] Security audit
- [ ] Deployment (Vercel + Railway)
- [ ] Demo script execution
- [ ] Documentation

---

## 13. Error Handling & Resilience

### 13.1 Error Classification

```typescript
// Error taxonomy for TrustRoom AI
enum ErrorCategory {
  AUTH = 'AUTH',               // Authentication/authorization failures
  VALIDATION = 'VALIDATION',   // Input validation errors
  BUSINESS = 'BUSINESS',       // Business logic violations (e.g., invalid state transition)
  EXTERNAL = 'EXTERNAL',       // Third-party service failures (Agora, OpenAI, Solana)
  INFRASTRUCTURE = 'INFRA',    // Database, Redis, network errors
}

interface AppError {
  code: string;           // e.g., 'DEAL_INVALID_TRANSITION'
  category: ErrorCategory;
  message: string;        // Human-readable
  details?: unknown;      // Structured context
  retryable: boolean;     // Whether client should retry
  httpStatus: number;     // HTTP response code
}
```

### 13.2 Error Response Format

```typescript
// Standard API error response
interface ErrorResponse {
  error: {
    code: string;          // Machine-readable error code
    message: string;       // Human-readable message
    details?: unknown;     // Validation errors, context
    requestId: string;     // For log correlation
    timestamp: string;
  };
}

// Example:
// {
//   "error": {
//     "code": "DEAL_INVALID_TRANSITION",
//     "message": "Cannot transition from Draft to Released",
//     "details": { "from": "Draft", "to": "Released", "allowed": ["Created"] },
//     "requestId": "req_abc123",
//     "timestamp": "2025-01-15T10:30:00Z"
//   }
// }
```

### 13.3 Retry & Circuit Breaker Strategy

| Service | Max Retries | Backoff | Circuit Breaker | Timeout |
|---------|------------|---------|-----------------|---------|
| PostgreSQL | 3 | Exponential (100ms base) | No (connection pool handles) | 5s |
| Redis | 3 | Exponential (50ms base) | Yes (5 failures → open 30s) | 2s |
| OpenAI API | 2 | Exponential (1s base) | Yes (10 failures → open 60s) | 30s |
| Agora API | 2 | Linear (500ms) | Yes (5 failures → open 30s) | 10s |
| Solana RPC | 3 | Exponential (500ms base) | Yes (3 failures → open 120s) | 15s |
| R2/S3 | 2 | Exponential (200ms base) | No | 30s |

### 13.4 Graceful Degradation

```text
AI Pipeline Degradation:
  OpenAI unavailable → Skip LLM classification, rely on rule-based detector only
  Agora STT unavailable → Pause transcript processing, buffer audio client-side
  Redis unavailable → Disable rate limiting, use in-memory fallback for BullMQ

Solana Degradation:
  RPC unavailable → Queue on-chain transactions, retry when restored
  Transaction fails → Return to user with retry option, log failure reason

Frontend Degradation:
  WebSocket disconnected → Poll API every 5s for status updates
  API unreachable → Show cached data with "stale" indicator
  Agora disconnected → Show "reconnecting" state, auto-retry
```

### 13.5 Idempotency

```typescript
// All state-changing endpoints accept an idempotency key
// POST /deals/:id/transition
// Header: Idempotency-Key: <uuid>

// Server stores key + response for 24h
// Duplicate requests return cached response without re-executing

// Critical for:
// - Escrow transactions (double-spend prevention)
// - Deal state transitions (double-transition prevention)
// - Evidence uploads (duplicate file prevention)
```

---

## 14. Testing Strategy

### 14.1 Testing Pyramid

```text
                    ┌─────────┐
                    │  E2E    │  5-10 critical flows
                    │(Playwright)│
                    ├─────────┤
                    │Integration│  API + DB + Redis
                    │ (Supertest)│
                    ├─────────┤
                    │  Unit   │  Services, utils, rules
                    │ (Vitest)│
                    └─────────┘
```

### 14.2 Test Categories

| Category | Tool | Scope | Target Coverage |
|----------|------|-------|----------------|
| Unit tests | Vitest | Service logic, utils, scam rules, risk scoring | 80%+ |
| Integration tests | Vitest + Supertest | API endpoints + DB | 70%+ |
| E2E tests | Playwright | Critical user flows | Key paths |
| Smart contract tests | Anchor test framework | Escrow instructions | 100% instructions |
| Load tests | k6 | API throughput, WebSocket concurrency | Baseline metrics |

### 14.3 Critical Test Scenarios

```text
Auth Flow:
  ✓ Nonce generation → wallet sign → verify → JWT issued
  ✓ Expired nonce rejected
  ✓ Invalid signature rejected
  ✓ Replay attack prevented (nonce reuse)

Deal Lifecycle:
  ✓ Create → invite → accept → deposit → deliver → release
  ✓ Invalid state transition rejected
  ✓ Concurrent transitions handled (optimistic locking via version)
  ✓ Only authorized party can perform each transition

AI Pipeline:
  ✓ Rule-based scam detection catches known patterns
  ✓ Risk score aggregation produces correct levels
  ✓ LLM classification returns structured output
  ✓ Pipeline degrades gracefully when LLM unavailable

Escrow:
  ✓ Initialize → deposit → release flow
  ✓ Initialize → deposit → refund flow
  ✓ Initialize → deposit → dispute → resolve flow
  ✓ Double-release prevented
  ✓ Unauthorized release prevented

WebSocket:
  ✓ Client joins deal room, receives events
  ✓ Unauthorized client rejected
  ✓ Events broadcast only to deal participants
  ✓ Reconnection restores event stream
```

### 14.4 Test Data Management

```typescript
// Seed data for development and testing
// packages/db/prisma/seed.ts

// Users: 3 test wallets (buyer, seller, admin)
// Deals: 5 deals in various states
// Events: Sample transcript lines and risk events
// Nonces: Pre-generated for deterministic tests

// Test isolation:
// - Each integration test uses a transaction rollback
// - E2E tests use a dedicated test database
// - Smart contract tests use local validator
```

---

## 15. CI/CD Pipeline

### 15.1 Pipeline Stages

```text
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  Lint &  │──→│  Type    │──→│  Unit &  │──→│  Build   │──→│  Deploy  │
│  Format  │   │  Check   │   │  Int Test│   │          │   │          │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
     │              │              │              │              │
  ESLint       tsc --noEmit    Vitest        turbo build     Vercel/Railway
  Prettier                     coverage                      (on merge to main)
```

### 15.2 GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: trustroom_test
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
      redis:
        image: redis:7
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @trustroom/db db:push
      - run: pnpm --filter @trustroom/db generate
      - run: pnpm test -- --coverage
      - run: pnpm test:e2e

  build:
    needs: [lint-and-typecheck, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

### 15.3 Deployment Triggers

| Branch | Action | Environment |
|--------|--------|-------------|
| `develop` | Auto-deploy | Staging |
| `main` | Auto-deploy | Production |
| PR | Preview deployment | Preview (Vercel) |
| Tag `v*` | Release build | Production |

---

## 16. Monitoring & Observability

### 16.1 Three Pillars

```text
┌─────────────────────────────────────────────────────────┐
│                    OBSERVABILITY                          │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │    Logs      │  │   Metrics    │  │   Traces     │  │
│  │  (Pino)      │  │ (Prometheus) │  │  (OpenTelemetry)│ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │           │
│         └────────┬────────┘                 │           │
│                  ▼                          │           │
│         ┌──────────────┐                   │           │
│         │   Grafana    │◄──────────────────┘           │
│         │  (Dashboard) │                                │
│         └──────────────┘                                │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │   Sentry     │  │   PostHog    │                    │
│  │  (Errors)    │  │ (Analytics)  │                    │
│  └──────────────┘  └──────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

### 16.2 Key Metrics

```typescript
// Business Metrics
const BUSINESS_METRICS = {
  'deals.created': counter,           // Total deals created
  'deals.completed': counter,         // Total deals released
  'deals.disputed': counter,          // Total disputes raised
  'deals.value_total': histogram,     // Total deal value (USD)
  'auth.login_success': counter,      // Successful logins
  'auth.login_failure': counter,      // Failed login attempts
};

// Technical Metrics
const TECHNICAL_METRICS = {
  'api.request.duration': histogram,  // API response time
  'api.request.count': counter,       // Total API requests
  'api.request.errors': counter,      // API errors by status code
  'db.query.duration': histogram,     // Database query time
  'ws.connections': gauge,            // Active WebSocket connections
  'ws.messages_sent': counter,        // WebSocket messages sent
  'ai.pipeline.latency': histogram,   // AI processing time
  'ai.pipeline.errors': counter,      // AI pipeline failures
  'escrow.tx.success': counter,       // Successful on-chain transactions
  'escrow.tx.failure': counter,       // Failed on-chain transactions
  'bullmq.jobs.processed': counter,   // Background jobs completed
  'bullmq.jobs.failed': counter,      // Background jobs failed
};
```

### 16.3 Alerting Rules

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| High error rate | > 5% 5xx in 5min | Critical | Page on-call |
| API latency | p99 > 2s for 5min | Warning | Slack notification |
| DB connection pool | > 80% utilized | Warning | Slack notification |
| Redis memory | > 80% utilized | Warning | Slack notification |
| AI pipeline failures | > 10 in 5min | Critical | Page on-call |
| Escrow tx failures | > 3 in 10min | Critical | Page on-call |
| WebSocket disconnects | > 50 in 1min | Warning | Slack notification |
| BullMQ job backlog | > 100 pending | Warning | Slack notification |

### 16.4 Structured Logging

```typescript
// Standard log format (JSON, newline-delimited)
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  requestId: string;
  wallet?: string;       // Authenticated user
  dealId?: string;       // Deal context
  duration?: number;     // Operation duration (ms)
  error?: {
    name: string;
    message: string;
    stack: string;
    code: string;
  };
  [key: string]: unknown; // Additional context
}

// Example:
// {"timestamp":"2025-01-15T10:30:00Z","level":"info","message":"Deal transition","requestId":"req_abc","dealId":"deal_123","from":"Created","to":"Deposited","duration":45}
```

---

## 17. Dispute Resolution Flow

### 17.1 Dispute Lifecycle

```text
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Dispute    │────→│  Evidence    │────→│  Arbitrator  │────→│  Resolution  │
│  Raised     │     │  Collection  │     │  Review      │     │  Executed    │
└─────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
       │                   │                    │                    │
       │              Auto-collect          Human or AI          On-chain
       │              all evidence          assisted             settlement
       │
  Either party
  can raise
```

### 17.2 Dispute States

```typescript
enum DisputeStatus {
  OPEN = 'OPEN',                    // Dispute raised, evidence collection active
  EVIDENCE_COLLECTING = 'EVIDENCE_COLLECTING', // Auto-collecting evidence (24h window)
  UNDER_REVIEW = 'UNDER_REVIEW',    // Arbitrator reviewing
  RESOLVED_RELEASE = 'RESOLVED_RELEASE',   // Funds released to seller
  RESOLVED_REFUND = 'RESOLVED_REFUND',     // Funds refunded to buyer
  RESOLVED_SPLIT = 'RESOLVED_SPLIT',       // Funds split between parties
  CLOSED = 'CLOSED',                // Resolution executed, dispute closed
}
```

### 17.3 Dispute Evidence Auto-Collection

```typescript
// When dispute is raised, system automatically collects:
async function collectDisputeEvidence(dealId: string): Promise<DisputeEvidenceBundle> {
  return {
    // 1. Full transcript (already stored)
    transcripts: await prisma.transcript.findMany({ where: { dealId } }),

    // 2. All risk events
    riskEvents: await prisma.riskEvent.findMany({ where: { dealId } }),

    // 3. AI summaries and extracted terms
    aiSummaries: await prisma.aiSummary.findMany({ where: { dealId } }),

    // 4. Escrow transaction history
    escrowTxs: await prisma.escrowTransaction.findMany({ where: { dealId } }),

    // 5. Uploaded evidence files
    evidenceFiles: await prisma.evidenceFile.findMany({ where: { dealId } }),

    // 6. Deal terms (if confirmed)
    terms: await prisma.dealTerm.findUnique({ where: { dealId } }),

    // 7. Timeline of all state transitions
    events: await prisma.dealEvent.findMany({ where: { dealId }, orderBy: { createdAt: 'asc' } }),

    // 8. AI-generated dispute summary
    aiSummary: await generateDisputeSummary(dealId),
  };
}
```

### 17.4 Arbitrator Decision Framework

```typescript
// AI-assisted dispute resolution (human final decision)
interface ArbitrationInput {
  evidence: DisputeEvidenceBundle;
  claimByRaiser: string;        // What the disputing party claims
  responseByOther: string;      // Other party's response
  dealTerms: ExtractedTerms;    // Confirmed terms (if any)
}

interface ArbitrationDecision {
  resolution: 'RELEASE' | 'REFUND' | 'SPLIT';
  splitRatio?: number;          // 0-100, percentage to seller (only for SPLIT)
  reasoning: string;            // AI-generated reasoning
  confidence: number;           // 0-1, how confident the AI is
  recommendedAction: string;    // Human-readable recommendation
}

// Decision rules:
// 1. If terms were confirmed AND delivery proof exists → lean toward RELEASE
// 2. If no delivery proof AND no deadline passed → lean toward REFUND
// 3. If both parties partially fulfilled → consider SPLIT
// 4. If scam detected by AI → lean toward REFUND + flag account
// 5. Always require human arbitrator final approval for amounts > threshold
```

---

## 18. Reputation System Design

### 18.1 Reputation Score Algorithm

```typescript
interface ReputationProfile {
  wallet: string;
  score: number;              // 0-1000 (like a credit score)
  level: ReputationLevel;     // Derived from score
  totalDeals: number;
  completedDeals: number;
  disputedDeals: number;
  successfulDeals: number;    // Deals completed without dispute
  avgDealValue: number;
  memberSince: Date;
  badges: Badge[];
}

enum ReputationLevel {
  NEWCOMER = 'NEWCOMER',       // 0-199: 0-5 deals
  TRUSTED = 'TRUSTED',         // 200-499: 5+ deals, <10% dispute rate
  ESTABLISHED = 'ESTABLISHED', // 500-749: 15+ deals, <5% dispute rate
  VERIFIED = 'VERIFIED',       // 750-999: 30+ deals, <3% dispute rate
  GUARANTOR = 'GUARANTOR',     // 1000: Invited only, platform guarantor
}

function calculateReputation(profile: ReputationProfile): number {
  let score = 0;

  // Base: completion rate (0-400 points)
  const completionRate = profile.completedDeals / Math.max(profile.totalDeals, 1);
  score += Math.round(completionRate * 400);

  // Volume bonus (0-200 points)
  score += Math.min(200, profile.completedDeals * 5);

  // Dispute penalty (-50 per dispute, min 0)
  score -= profile.disputedDeals * 50;

  // Recency bonus: deals in last 90 days weighted higher
  // (calculated from actual deal timestamps)

  // Value bonus: higher value deals = more trust
  score += Math.min(100, Math.log2(profile.avgDealValue + 1) * 10);

  return Math.max(0, Math.min(1000, score));
}
```

### 18.2 Badge System

| Badge | Criteria | Icon |
|-------|----------|------|
| First Deal | Complete first deal | 🎉 |
| 10 Deals | Complete 10 deals | 🔟 |
| 50 Deals | Complete 50 deals | 🏆 |
| Zero Disputes | 20+ deals, 0 disputes | ⭐ |
| High Value | Complete deal > 1000 USDC | 💎 |
| Fast Resolver | Average dispute resolution < 24h | ⚡ |
| Trusted Seller | 10+ sales, 0 disputes | 🛡️ |
| Trusted Buyer | 10+ purchases, 0 disputes | ✅ |
| Early Adopter | Active in first 3 months | 🌟 |

### 18.3 Reputation Impact on Platform

```text
Reputation affects:
  1. Deal limits: Higher reputation = higher max deal value
     - NEWCOMER: max 100 USDC per deal
     - TRUSTED: max 1,000 USDC per deal
     - ESTABLISHED: max 10,000 USDC per deal
     - VERIFIED: max 100,000 USDC per deal

  2. Escrow fee discount:
     - NEWCOMER: 1.0% fee
     - TRUSTED: 0.8% fee
     - ESTABLISHED: 0.5% fee
     - VERIFIED: 0.3% fee

  3. Dispute priority: Higher reputation = faster arbitration

  4. Search ranking: Higher reputation = higher in deal partner search
```

---

## 19. Canonicalization & Hashing Specification

### 19.1 Why Canonicalization Matters

Hashes are used for on-chain anchoring (terms_hash, evidence_hash). If the same data produces different hashes due to serialization order, key sorting, or whitespace differences, the on-chain verification will fail. Canonicalization ensures deterministic hashing.

### 19.2 Canonical JSON Serialization

```typescript
// utils/canonicalize.ts
import { createHash } from 'crypto';

/**
 * Deterministic JSON serialization:
 * 1. Sort all object keys lexicographically (deep recursive)
 * 2. Remove undefined values (JSON.stringify already does this)
 * 3. Use no whitespace (compact format)
 * 4. Arrays preserve order (order is semantically meaningful)
 * 5. Numbers serialized as-is (no string conversion)
 */
function canonicalize(obj: unknown): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'string') return JSON.stringify(obj); // preserves escapes
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalize).join(',') + ']';
  }
  if (typeof obj === 'object') {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const pairs = keys.map(k => JSON.stringify(k) + ':' + canonicalize((obj as Record<string, unknown>)[k]));
    return '{' + pairs.join(',') + '}';
  }
  return String(obj);
}

function computeHash(data: unknown): string {
  const canonical = canonicalize(data);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
```

### 19.3 Terms Hash

```typescript
// Computed from confirmed deal terms
function computeTermsHash(terms: ExtractedTerms): string {
  const payload = {
    dealType: terms.dealType,
    assetOrService: terms.assetOrService,
    amount: terms.amount,
    token: terms.token,
    deadline: terms.deadline ?? null,
    deliveryCondition: terms.deliveryCondition,
    releaseCondition: terms.releaseCondition,
    refundCondition: terms.refundCondition ?? null,
    disputeCondition: terms.disputeCondition ?? null,
    specialTerms: terms.specialTerms.sort(), // sort for determinism
  };
  return computeHash(payload);
}

// Both parties sign this hash off-chain
// Hash is stored on-chain via update_hashes instruction
```

### 19.4 Evidence Hash

```typescript
// Computed from all evidence in the deal
function computeEvidenceHash(dealId: string): EvidenceHashResult {
  const evidence = {
    dealId,
    termsHash: deal.termsHash,
    transcriptCount: transcripts.length,
    transcriptRoot: merkleRoot(transcripts.map(t => computeHash(t))),
    riskEventCount: riskEvents.length,
    riskEventRoot: merkleRoot(riskEvents.map(e => computeHash(e))),
    escrowTxSignatures: escrowTxs.map(t => t.signature).sort(),
    evidenceFileHashes: evidenceFiles.map(f => f.fileHash).sort(),
    computedAt: new Date().toISOString(),
  };
  return {
    hash: computeHash(evidence),
    merkleRoot: merkleRoot([computeHash(evidence)]),
    evidence,
  };
}
```

### 19.5 Merkle Tree for Evidence Integrity

```typescript
// utils/merkle.ts
function merkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return computeHash('empty');
  if (hashes.length === 1) return hashes[0];

  const nextLevel: string[] = [];
  for (let i = 0; i < hashes.length; i += 2) {
    const left = hashes[i];
    const right = i + 1 < hashes.length ? hashes[i + 1] : left;
    nextLevel.push(computeHash(left + right));
  }
  return merkleRoot(nextLevel);
}

// Merkle proof: given a leaf hash, prove inclusion in the root
function merkleProof(hashes: string[], leafIndex: number): string[] {
  const proof: string[] = [];
  let level = [...hashes];
  let index = leafIndex;

  while (level.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      if (i === index || i + 1 === index) {
        proof.push(index % 2 === 0 ? right : left);
      }
      nextLevel.push(computeHash(left + right));
    }
    index = Math.floor(index / 2);
    level = nextLevel;
  }
  return proof;
}
```

---

## 20. LLM Guardrails & Output Validation

### 20.1 Problem

LLMs can return malformed JSON, hallucinated fields, or outputs that violate the expected schema. Without guardrails, downstream code will crash or produce incorrect risk assessments.

### 20.2 Validation Pipeline

```typescript
// ai/guardrails.ts
import { z } from 'zod';

// Define strict schemas for every LLM output
const RiskClassificationSchema = z.object({
  intent: z.enum([
    'normal_negotiation', 'early_release_request', 'off_platform_request',
    'credential_request', 'external_wallet', 'time_pressure',
    'impersonation', 'term_change', 'fake_proof', 'ambiguous_terms', 'other',
  ]),
  risk_level: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  score: z.number().min(0).max(100),
  reason: z.string().min(10).max(500),
  suggested_action: z.string().min(5).max(500),
});

const ExtractedTermsSchema = z.object({
  deal_type: z.enum(['freelance_service', 'nft', 'token_otc', 'digital_goods', 'domain', 'other']),
  asset_or_service: z.string().min(1).max(500),
  amount: z.string(),
  token: z.string(),
  deadline: z.string().nullable().optional(),
  delivery_condition: z.string().min(1).max(1000),
  release_condition: z.string().min(1).max(1000),
  refund_condition: z.string().nullable().optional(),
  dispute_condition: z.string().nullable().optional(),
  special_terms: z.array(z.string()),
  risk_notes: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

type RiskClassification = z.infer<typeof RiskClassificationSchema>;
type ExtractedTerms = z.infer<typeof ExtractedTermsSchema>;
```

### 20.3 Retry Strategy for Malformed Output

```typescript
async function callLLMWithGuardrails<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  options: {
    model: string;
    maxRetries?: number;       // default: 2
    temperature?: number;      // default: 0.1 for classification
    fallbackValue?: T;         // returned if all retries fail
  },
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: options.model,
        temperature: options.temperature ?? 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You must respond with valid JSON matching the exact schema requested. No markdown, no explanation, just JSON.' },
          { role: 'user', content: prompt },
        ],
      });

      const raw = response.choices[0]?.message?.content;
      if (!raw) throw new Error('Empty LLM response');

      const parsed = JSON.parse(raw);
      const validated = schema.safeParse(parsed);

      if (validated.success) {
        return validated.data;
      }

      // Validation failed — log and retry with stricter prompt
      logger.warn('LLM output validation failed', {
        attempt,
        errors: validated.error.issues,
        raw: raw.substring(0, 500),
      });

    } catch (error) {
      logger.error('LLM call failed', { attempt, error });
      if (attempt === maxRetries) break;
      await sleep(1000 * (attempt + 1)); // linear backoff
    }
  }

  // All retries exhausted
  if (options.fallbackValue) {
    logger.error('LLM guardrails exhausted, using fallback');
    return options.fallbackValue;
  }
  throw new AppError('LLM_OUTPUT_FAILED', ErrorCategory.EXTERNAL, 'LLM produced invalid output after retries');
}
```

### 20.4 Cost & Token Control

```typescript
const LLM_CONFIG = {
  riskClassification: {
    model: 'gpt-4o-mini',       // Fast, cheap
    maxTokens: 300,
    temperature: 0.0,           // Deterministic
    timeout: 10_000,            // 10s max
    costPer1kInput: 0.00015,    // $0.15/1M input
    costPer1kOutput: 0.0006,    // $0.60/1M output
  },
  termExtraction: {
    model: 'gpt-4o',            // Better quality
    maxTokens: 1000,
    temperature: 0.1,
    timeout: 30_000,
    costPer1kInput: 0.0025,     // $2.50/1M input
    costPer1kOutput: 0.01,      // $10.00/1M output
  },
  dealSummary: {
    model: 'gpt-4o',
    maxTokens: 800,
    temperature: 0.2,
    timeout: 30_000,
  },
  disputeReport: {
    model: 'gpt-4o',
    maxTokens: 2000,
    temperature: 0.3,
    timeout: 60_000,
  },
};

// Daily cost cap per deal
const DAILY_COST_CAP_PER_DEAL = 0.50; // USD
// Total daily cost cap
const DAILY_COST_CAP_TOTAL = 50.00; // USD
```

### 20.5 Prompt Injection Prevention

```typescript
// Sanitize user-provided transcript content before including in prompts
function sanitizeForPrompt(content: string): string {
  // Remove potential prompt injection patterns
  return content
    .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, '[REDACTED]')
    .replace(/you\s+are\s+now\s+/gi, '[REDACTED] ')
    .replace(/system\s*:\s*/gi, '[REDACTED] ')
    .replace(/<\|im_start\|>/g, '[REDACTED]')
    .substring(0, 2000); // Limit length
}
```

---

## 21. Wallet Risk Scoring (On-chain Analysis)

### 21.1 Wallet Risk Factors

```typescript
interface WalletRiskFactors {
  walletAge: number;           // Days since first transaction (0-20 points)
  transactionCount: number;    // Total tx count (0-15 points)
  internalDealHistory: {       // Platform-specific (0-25 points)
    completedDeals: number;
    disputedDeals: number;
    totalDeals: number;
  };
  balanceVolatility: number;   // Balance change pattern (0-10 points)
  knownScamAssociation: boolean; // Connected to known scam wallets (0-30 points)
}

function calculateWalletRiskScore(
  walletAddress: string,
  factors: WalletRiskFactors,
): WalletRiskResult {
  let score = 0;
  const reasons: string[] = [];

  // Wallet age (newer = riskier)
  if (factors.walletAge < 7) {
    score += 20;
    reasons.push('Wallet created less than 7 days ago');
  } else if (factors.walletAge < 30) {
    score += 10;
    reasons.push('Wallet created less than 30 days ago');
  }

  // Transaction count (fewer = riskier)
  if (factors.transactionCount < 5) {
    score += 15;
    reasons.push('Very few on-chain transactions');
  } else if (factors.transactionCount < 20) {
    score += 8;
    reasons.push('Low transaction history');
  }

  // Internal deal history
  if (factors.internalDealHistory.totalDeals === 0) {
    score += 25;
    reasons.push('No previous deals on TrustRoom');
  } else {
    const disputeRate = factors.internalDealHistory.disputedDeals / factors.internalDealHistory.totalDeals;
    if (disputeRate > 0.3) {
      score += 25;
      reasons.push(`High dispute rate: ${(disputeRate * 100).toFixed(0)}%`);
    } else if (disputeRate > 0.1) {
      score += 10;
      reasons.push(`Moderate dispute rate: ${(disputeRate * 100).toFixed(0)}%`);
    }
  }

  // Known scam association
  if (factors.knownScamAssociation) {
    score += 30;
    reasons.push('Wallet connected to known scam addresses');
  }

  return {
    score: Math.min(100, score),
    level: score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW',
    reasons,
    factors,
  };
}
```

### 21.2 External Wallet Address Parser

```typescript
// Detects if a message contains a wallet address that is NOT part of the deal
const SOLANA_ADDRESS_REGEX = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
const EVM_ADDRESS_REGEX = /0x[0-9a-fA-F]{40}/g;

function detectExternalWallets(
  content: string,
  deal: Deal,
): DetectedWallet[] {
  const detected: DetectedWallet[] = [];
  const knownAddresses = new Set([
    deal.buyerWallet,
    deal.sellerWallet,
    deal.escrowAccountPubkey,
  ].filter(Boolean));

  // Check Solana addresses
  const solanaMatches = content.match(SOLANA_ADDRESS_REGEX) || [];
  for (const addr of solanaMatches) {
    if (!knownAddresses.has(addr) && isValidSolanaAddress(addr)) {
      detected.push({
        address: addr,
        chain: 'solana',
        isExternal: true,
        context: extractSurroundingText(content, addr, 50),
      });
    }
  }

  // Check EVM addresses (cross-chain scam indicator)
  const evmMatches = content.match(EVM_ADDRESS_REGEX) || [];
  for (const addr of evmMatches) {
    detected.push({
      address: addr,
      chain: 'evm',
      isExternal: true,
      context: extractSurroundingText(content, addr, 50),
    });
  }

  return detected;
}

function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}
```

### 21.3 Wallet Risk Integration with Scam Guard

```typescript
// When a new deal is created or buyer wallet changes, fetch on-chain data
async function enrichWalletRisk(deal: Deal): Promise<WalletRiskFactors> {
  const [buyerRisk, sellerRisk] = await Promise.all([
    fetchWalletRiskFactors(deal.buyerWallet),
    deal.sellerWallet ? fetchWalletRiskFactors(deal.sellerWallet) : null,
  ]);

  return {
    walletAge: buyerRisk.walletAge,
    transactionCount: buyerRisk.transactionCount,
    internalDealHistory: buyerRisk.internalDealHistory,
    balanceVolatility: buyerRisk.balanceVolatility,
    knownScamAssociation: buyerRisk.knownScamAssociation || sellerRisk?.knownScamAssociation || false,
  };
}

// Cache wallet risk for 1 hour (on-chain data doesn't change fast)
// Use Redis with TTL
const WALLET_RISK_CACHE_TTL = 3600; // 1 hour
```

---

## 22. Speaker Diarization & Voice Activity Detection

### 22.1 Pipeline Overview

```text
Agora Audio Stream
    │
    ├──→ VAD (Voice Activity Detection)
    │    └── Filter silence, detect speech segments
    │
    ├──→ Speaker Diarization
    │    └── Identify WHO is speaking (buyer vs seller)
    │    └── Map Agora UID → speaker role
    │
    └──→ STT (Speech-to-Text)
         └── Transcribe each speech segment
         └── Attach speaker identity
```

### 22.2 Agora UID → Role Mapping

```typescript
// When deal room is created, assign UIDs
interface AgoraParticipant {
  uid: number;           // Agora-assigned UID
  wallet: string;        // User's wallet address
  role: 'buyer' | 'seller' | 'ai_observer';
}

// Channel naming: deal_{dealId}
// UID assignment:
//   buyer: hash(buyerWallet) % 10000 + 10000  (range 10000-19999)
//   seller: hash(sellerWallet) % 10000 + 20000 (range 20000-29999)
//   ai_observer: 1 (fixed)

function mapAgoraUidToRole(uid: number, participants: AgoraParticipant[]): 'buyer' | 'seller' | 'unknown' {
  const participant = participants.find(p => p.uid === uid);
  return participant?.role === 'ai_observer' ? 'unknown' : (participant?.role ?? 'unknown');
}
```

### 22.3 VAD Configuration

```typescript
// Agora has built-in VAD, or use external like Silero VAD
interface VADConfig {
  threshold: number;        // Speech probability threshold (0.5-0.8)
  minSpeechDuration: number; // Minimum speech segment (ms)
  minSilenceDuration: number; // Minimum silence to split (ms)
  speechPad: number;        // Padding around speech (ms)
}

const DEFAULT_VAD_CONFIG: VADConfig = {
  threshold: 0.6,
  minSpeechDuration: 300,    // 300ms minimum
  minSilenceDuration: 500,   // 500ms silence = new segment
  speechPad: 200,            // 200ms padding
};
```

### 22.4 Transcript Normalization

```typescript
interface NormalizedTranscript {
  dealId: string;
  sequenceNum: number;
  speakerRole: 'buyer' | 'seller';
  speakerWallet: string;
  text: string;
  confidence: number;
  language: string;          // Detected language (vi, en, etc.)
  startTime: number;         // Segment start (ms)
  endTime: number;           // Segment end (ms)
  wordCount: number;
  containsUrl: boolean;      // Pre-flag for URL detection
  containsWalletAddress: boolean; // Pre-flag for wallet detection
  createdAt: Date;
}

// Normalize raw STT output
function normalizeTranscript(
  raw: AgoraSTTEvent,
  participants: AgoraParticipant[],
): NormalizedTranscript {
  const role = mapAgoraUidToRole(raw.uid, participants);
  const participant = participants.find(p => p.uid === raw.uid);

  return {
    dealId: raw.channelName.replace('deal_', ''),
    sequenceNum: raw.sequence,
    speakerRole: role,
    speakerWallet: participant?.wallet ?? 'unknown',
    text: raw.text.trim(),
    confidence: raw.confidence,
    language: raw.language ?? 'unknown',
    startTime: raw.startTime,
    endTime: raw.endTime,
    wordCount: raw.text.split(/\s+/).length,
    containsUrl: /https?:\/\/|www\./i.test(raw.text),
    containsWalletAddress: /[1-9A-HJ-NP-Za-km-z]{32,44}/.test(raw.text) || /0x[0-9a-fA-F]{40}/.test(raw.text),
    createdAt: new Date(),
  };
}
```

---

## 23. Embeddings & RAG Safety Playbook

### 23.1 Concept

Beyond keyword rules and LLM classification, we maintain a curated "scam playbook" — a collection of known scam conversation patterns. Each pattern is embedded as a vector. When a new transcript segment arrives, we compute its embedding and find the most similar playbook entries using cosine similarity.

### 23.2 Playbook Schema

```typescript
interface ScamPlaybookEntry {
  id: string;
  category: string;           // 'early_release', 'off_platform', 'impersonation', etc.
  pattern: string;            // Example scam conversation snippet
  embedding: number[];        // 1536-dim vector (OpenAI text-embedding-3-small)
  riskLevel: RiskLevel;
  score: number;              // Base risk score for this pattern
  explanation: string;        // Why this is a scam pattern
  createdAt: Date;
  updatedAt: Date;
}

// Example entries:
const PLAYBOOK_EXAMPLES: Omit<ScamPlaybookEntry, 'embedding' | 'id'>[] = [
  {
    category: 'early_release',
    pattern: 'Bạn release trước đi, tôi sẽ gửi file sau. Đừng lo, tôi là người tử tế.',
    riskLevel: 'HIGH',
    score: 40,
    explanation: 'Seller requests release before delivery, uses reassurance language',
  },
  {
    category: 'off_platform',
    pattern: 'Chuyển sang Telegram nói chuyện đi, ở đây不方便. Gửi tôi địa chỉ Zalo.',
    riskLevel: 'HIGH',
    score: 35,
    explanation: 'Request to move communication off-platform to avoid monitoring',
  },
  {
    category: 'credential_request',
    pattern: 'Cho tôi seed phrase để verify ví của bạn. Cần kiểm tra để hoàn tất giao dịch.',
    riskLevel: 'CRITICAL',
    score: 90,
    explanation: 'Requesting seed phrase under false pretense of verification',
  },
  {
    category: 'fake_proof',
    pattern: 'Tôi đã gửi rồi, check lại đi. Đây là screenshot (file giả). Transaction hash: ...',
    riskLevel: 'HIGH',
    score: 45,
    explanation: 'Claims delivery with fake proof, may include fabricated screenshots',
  },
];
```

### 23.3 Similarity Search

```typescript
// ai/embeddings.ts
import { OpenAI } from 'openai';

const openai = new OpenAI();

async function computeEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 1536,
  });
  return response.data[0].embedding;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

interface PlaybookMatch {
  entry: ScamPlaybookEntry;
  similarity: number;        // 0-1
  adjustedScore: number;     // score * similarity
}

async function findPlaybookMatches(
  transcriptText: string,
  playbook: ScamPlaybookEntry[],
  threshold: number = 0.75,  // Minimum similarity
  maxResults: number = 3,
): Promise<PlaybookMatch[]> {
  const embedding = await computeEmbedding(transcriptText);

  const matches = playbook
    .map(entry => ({
      entry,
      similarity: cosineSimilarity(embedding, entry.embedding),
    }))
    .filter(m => m.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults)
    .map(m => ({
      ...m,
      adjustedScore: Math.round(m.entry.score * m.similarity),
    }));

  return matches;
}
```

### 23.4 pgvector Storage

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Playbook table with embedding column
CREATE TABLE scam_playbook (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  pattern TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  risk_level TEXT NOT NULL,
  score INTEGER NOT NULL,
  explanation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX scam_playbook_embedding_idx
  ON scam_playbook
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Query: find similar patterns
-- SELECT * FROM scam_playbook
-- ORDER BY embedding <=> $1::vector
-- LIMIT 5;
```

### 23.5 Playbook Update Mechanism

```typescript
// Periodically (weekly) or on-demand:
// 1. New scam patterns identified by dispute resolution → add to playbook
// 2. False positives identified → add negative examples
// 3. Re-embed all entries if embedding model is upgraded

async function addPlaybookEntry(entry: Omit<ScamPlaybookEntry, 'id' | 'embedding'>): Promise<void> {
  const embedding = await computeEmbedding(entry.pattern);
  await prisma.scamPlaybook.create({
    data: {
      id: `playbook_${nanoid()}`,
      ...entry,
      embedding: JSON.stringify(embedding),
    },
  });
}
```

---

## 24. Transaction Simulation

### 24.1 Why Simulate

Before broadcasting any Solana transaction, simulate it first. This catches:
- Insufficient funds
- Incorrect program arguments
- Account not found
- Program errors (e.g., invalid state transition)
- Potential loss of funds

### 24.2 Simulation Flow

```typescript
// packages/solana/src/simulation.ts
import { Connection, TransactionMessage, VersionedTransaction } from '@solana/web3.js';

interface SimulationResult {
  success: boolean;
  error?: string;
  logs?: string[];
  unitsConsumed?: number;
  accounts?: string[];
}

async function simulateTransaction(
  connection: Connection,
  transaction: VersionedTransaction,
): Promise<SimulationResult> {
  try {
    const simulation = await connection.simulateTransaction(transaction, {
      sigVerify: false,        // Don't verify signatures in simulation
      replaceRecentBlockhash: true,
      commitment: 'processed',
    });

    if (simulation.value.err) {
      return {
        success: false,
        error: JSON.stringify(simulation.value.err),
        logs: simulation.value.logs ?? [],
        unitsConsumed: simulation.value.unitsConsumed ?? undefined,
      };
    }

    return {
      success: true,
      logs: simulation.value.logs ?? [],
      unitsConsumed: simulation.value.unitsConsumed ?? undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Simulation failed',
    };
  }
}
```

### 24.3 Pre-flight Checks Before Escrow Operations

```typescript
async function safeEscrowOperation(
  operation: () => Promise<VersionedTransaction>,
  connection: Connection,
  wallet: Keypair,
  dealId: string,
): Promise<string> {
  // 1. Build transaction
  const tx = await operation();

  // 2. Simulate
  const simResult = await simulateTransaction(connection, tx);
  if (!simResult.success) {
    logger.error('Transaction simulation failed', {
      dealId,
      error: simResult.error,
      logs: simResult.logs,
    });
    throw new AppError(
      'ESCROW_SIMULATION_FAILED',
      ErrorCategory.BUSINESS,
      `Transaction would fail: ${simResult.error}`,
      { simulationLogs: simResult.logs },
    );
  }

  // 3. Check compute units (prevent DoS)
  if (simResult.unitsConsumed && simResult.unitsConsumed > 200_000) {
    logger.warn('High compute unit usage', {
      dealId,
      units: simResult.unitsConsumed,
    });
  }

  // 4. Sign and send
  tx.sign([wallet]);
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,     // Use preflight (another simulation layer)
    maxRetries: 3,
  });

  // 5. Confirm
  const confirmation = await connection.confirmTransaction(signature, 'confirmed');
  if (confirmation.value.err) {
    throw new AppError(
      'ESCROW_TX_FAILED',
      ErrorCategory.EXTERNAL,
      'Transaction confirmed but failed on-chain',
      { signature },
    );
  }

  // 6. Log success
  logger.info('Escrow transaction confirmed', { dealId, signature });

  return signature;
}
```

---

## 25. Audit Log Design

### 25.1 Audit Event Schema

```typescript
interface AuditEvent {
  id: string;                    // UUID
  timestamp: Date;
  eventType: AuditEventType;
  actor: {
    wallet: string;              // Who performed the action
    role: 'buyer' | 'seller' | 'admin' | 'system' | 'ai';
  };
  resource: {
    type: 'deal' | 'escrow' | 'evidence' | 'dispute' | 'user' | 'auth';
    id: string;                  // Resource ID
  };
  action: string;                // 'create', 'transition', 'upload', 'sign', etc.
  details: Record<string, unknown>; // Action-specific context
  ipAddress?: string;
  userAgent?: string;
  result: 'success' | 'failure';
  errorMessage?: string;
}

enum AuditEventType {
  // Auth events
  AUTH_NONCE_GENERATED = 'auth.nonce.generated',
  AUTH_LOGIN_SUCCESS = 'auth.login.success',
  AUTH_LOGIN_FAILURE = 'auth.login.failure',

  // Deal events
  DEAL_CREATED = 'deal.created',
  DEAL_UPDATED = 'deal.updated',
  DEAL_TRANSITIONED = 'deal.transitioned',
  DEAL_JOINED = 'deal.joined',

  // Escrow events
  ESCROW_INITIALIZED = 'escrow.initialized',
  ESCROW_DEPOSITED = 'escrow.deposited',
  ESCROW_RELEASED = 'escrow.released',
  ESCROW_REFUNDED = 'escrow.refunded',
  ESCROW_DISPUTED = 'escrow.disputed',
  ESCROW_RESOLVED = 'escrow.resolved',

  // Evidence events
  EVIDENCE_UPLOADED = 'evidence.uploaded',
  EVIDENCE_HASHED = 'evidence.hashed',
  EVIDENCE_ANCHORED = 'evidence.anchored',

  // AI events
  AI_RISK_DETECTED = 'ai.risk.detected',
  AI_WARNING_SHOWN = 'ai.warning.shown',
  AI_TERMS_EXTRACTED = 'ai.terms.extracted',

  // Dispute events
  DISPUTE_OPENED = 'dispute.opened',
  DISPUTE_RESOLVED = 'dispute.resolved',

  // System events
  SYSTEM_ERROR = 'system.error',
  SYSTEM_DEGRADED = 'system.degraded',
}
```

### 25.2 Audit Log Storage

```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type TEXT NOT NULL,
  actor_wallet TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  result TEXT NOT NULL CHECK (result IN ('success', 'failure')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX audit_logs_timestamp_idx ON audit_logs (timestamp DESC);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_wallet, timestamp DESC);
CREATE INDEX audit_logs_resource_idx ON audit_logs (resource_type, resource_id, timestamp DESC);
CREATE INDEX audit_logs_event_type_idx ON audit_logs (event_type, timestamp DESC);

-- Partition by month for performance (optional, for production scale)
-- CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs
--   FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### 25.3 Audit Log Middleware

```typescript
// Interceptor that automatically logs all state-changing operations
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.auditService.log({
            actor: { wallet: request.user?.wallet, role: request.user?.role ?? 'system' },
            resource: this.extractResource(request),
            action: request.method,
            result: 'success',
            details: { duration: Date.now() - startTime },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          });
        },
        error: (error) => {
          this.auditService.log({
            actor: { wallet: request.user?.wallet, role: request.user?.role ?? 'system' },
            resource: this.extractResource(request),
            action: request.method,
            result: 'failure',
            errorMessage: error.message,
            details: { duration: Date.now() - startTime },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          });
        },
      }),
    );
  }
}
```

---

## 26. Encryption at Rest

### 26.1 What to Encrypt

| Data | Encryption Method | Rationale |
|------|-------------------|-----------|
| Transcript text | Application-level AES-256-GCM | Contains sensitive conversation content |
| Evidence files | R2/S3 server-side encryption (SSE-S3) | File storage encryption |
| JWT secrets | Environment variable, never stored | Secret management |
| Wallet private keys | NEVER STORED | Users manage their own keys |
| Risk event reasons | Plaintext (not sensitive) | Needed for fast querying |
| Deal terms | Application-level AES-256-GCM | Contains financial agreement details |

### 26.2 Application-Level Encryption

```typescript
// utils/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes

interface EncryptedData {
  iv: string;       // Hex-encoded initialization vector
  tag: string;      // Hex-encoded auth tag
  data: string;     // Hex-encoded ciphertext
}

function encrypt(plaintext: string): EncryptedData {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    data: encrypted,
  };
}

function decrypt(encrypted: EncryptedData): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    KEY,
    Buffer.from(encrypted.iv, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'hex'));

  let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Prisma middleware for transparent encryption/decryption
// Applied to specific fields in Transcript and DealTerm models
```

### 26.3 Key Rotation Strategy

```typescript
// Encryption key rotation:
// 1. Generate new key, store as ENCRYPTION_KEY_V2
// 2. Re-encrypt all data with new key
// 3. Update ENCRYPTION_KEY to point to new key
// 4. Remove old key after verification period (30 days)

// For MVP: single key, manual rotation
// For production: use a KMS (AWS KMS, GCP KMS, or HashiCorp Vault)
```

---

## 27. AI Evaluation Metrics

### 27.1 Metrics Framework

```typescript
interface AIMetrics {
  // Classification metrics
  truePositives: number;   // Correctly flagged scam
  falsePositives: number;  // Incorrectly flagged legitimate conversation
  trueNegatives: number;   // Correctly passed legitimate conversation
  falseNegatives: number;  // Missed scam (most dangerous)

  // Derived metrics
  precision: number;       // TP / (TP + FP) — how many flagged were actually scams
  recall: number;          // TP / (TP + FN) — how many scams were caught
  f1Score: number;         // Harmonic mean of precision and recall
  falsePositiveRate: number; // FP / (FP + TN) — how many legit conversations were flagged

  // Business metrics
  avgClassificationLatency: number;  // ms
  avgTermExtractionLatency: number;  // ms
  dailyLLMCost: number;              // USD
  dailyClassifications: number;
  dailyTermExtractions: number;
}
```

### 27.2 Ground Truth Collection

```typescript
// After dispute resolution, the outcome provides ground truth:
// - If dispute resolved in favor of buyer (scam confirmed) → flagged conversations were TP
// - If dispute resolved in favor of seller (no scam) → flagged conversations were FP
// - If no dispute but scam occurred → missed detections are FN

interface GroundTruthRecord {
  dealId: string;
  actualOutcome: 'scam_confirmed' | 'no_scam' | 'inconclusive';
  flaggedByAI: boolean;
  riskEvents: RiskEvent[];
  disputeId?: string;
  resolution?: 'RELEASE' | 'REFUND' | 'SPLIT';
  recordedAt: Date;
}

// Store in dedicated table for metrics computation
// Recompute metrics weekly
```

### 27.3 Metrics Dashboard Queries

```sql
-- Weekly precision/recall
SELECT
  COUNT(*) FILTER (WHERE flagged_by_ai = true AND actual_outcome = 'scam_confirmed') AS true_positives,
  COUNT(*) FILTER (WHERE flagged_by_ai = true AND actual_outcome = 'no_scam') AS false_positives,
  COUNT(*) FILTER (WHERE flagged_by_ai = false AND actual_outcome = 'scam_confirmed') AS false_negatives,
  COUNT(*) FILTER (WHERE flagged_by_ai = false AND actual_outcome = 'no_scam') AS true_negatives
FROM ground_truth
WHERE recorded_at >= NOW() - INTERVAL '7 days';

-- Per-rule effectiveness
SELECT
  re.rule_id,
  COUNT(*) AS total_detections,
  COUNT(*) FILTER (WHERE gt.actual_outcome = 'scam_confirmed') AS true_positives,
  ROUND(COUNT(*) FILTER (WHERE gt.actual_outcome = 'scam_confirmed')::numeric / COUNT(*), 3) AS precision
FROM risk_events re
JOIN ground_truth gt ON re.deal_id = gt.deal_id
WHERE re.created_at >= NOW() - INTERVAL '7 days'
GROUP BY re.rule_id
ORDER BY precision DESC;
```

### 27.4 Target Metrics for MVP

| Metric | Target | Action if Below |
|--------|--------|-----------------|
| Precision (scam detection) | ≥ 0.80 | Tune rules, reduce false alarms |
| Recall (scam detection) | ≥ 0.70 | Add new rules, expand playbook |
| F1 Score | ≥ 0.75 | Balance precision/recall |
| False Positive Rate | ≤ 0.15 | Critical — too many false alarms erode trust |
| Classification Latency | < 1s | Switch to faster model |
| Term Extraction Accuracy | ≥ 0.85 | Improve prompts, add examples |

---

## 28. Secret Management

### 28.1 Environment-Based Strategy

```text
Development:
  • .env.local files (gitignored)
  • Docker Compose env_file
  • No secrets in code

Staging/Production:
  • Railway/Vercel environment variables
  • Never commit secrets to git
  • Use secret manager for sensitive values
```

### 28.2 Secret Inventory

| Secret | Where Used | Sensitivity | Rotation |
|--------|-----------|-------------|----------|
| DATABASE_URL | API, workers | High | On compromise |
| REDIS_URL | API, workers | Medium | On compromise |
| JWT_SECRET | API | Critical | Every 90 days |
| SOLANA_PRIVATE_KEY | API (escrow ops) | Critical | On compromise |
| ESCROW_PROGRAM_ID | API, frontend | Medium | Never changes |
| AGORA_APP_CERTIFICATE | API (token gen) | High | Every 180 days |
| OPENAI_API_KEY | API, AI workers | High | Every 90 days |
| R2_SECRET_ACCESS_KEY | API (uploads) | High | Every 90 days |
| ENCRYPTION_KEY | API | Critical | On compromise |

### 28.3 Validation at Startup

```typescript
// main.ts — validate all required env vars at startup
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'SOLANA_RPC_URL',
  'ESCROW_PROGRAM_ID',
  'AGORA_APP_ID',
  'AGORA_APP_CERTIFICATE',
  'OPENAI_API_KEY',
];

function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Validate JWT_SECRET length
  if (process.env.JWT_SECRET!.length < 32) {
    console.error('JWT_SECRET must be at least 32 characters');
    process.exit(1);
  }
}
```

---

## 29. Observability Deep Dive

### 29.1 OpenTelemetry Setup

```typescript
// tracing.ts — Initialize before any other imports
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
    }),
    exportIntervalMillis: 15_000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-nestjs-core': { enabled: true },
      '@opentelemetry/instrumentation-pg': { enabled: true },
      '@opentelemetry/instrumentation-redis': { enabled: true },
    }),
  ],
});

sdk.start();
```

### 29.2 Prometheus Metrics Export

```typescript
// metrics/prometheus.ts
import { Counter, Histogram, Gauge, register } from 'prom-client';

// Business metrics
export const dealsCreated = new Counter({
  name: 'trustroom_deals_created_total',
  help: 'Total deals created',
  labelNames: ['deal_type'],
});

export const dealsCompleted = new Counter({
  name: 'trustroom_deals_completed_total',
  help: 'Total deals completed (released)',
});

export const dealsDisputed = new Counter({
  name: 'trustroom_deals_disputed_total',
  help: 'Total disputes raised',
});

// Technical metrics
export const apiRequestDuration = new Histogram({
  name: 'trustroom_api_request_duration_seconds',
  help: 'API request duration',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const aiPipelineLatency = new Histogram({
  name: 'trustroom_ai_pipeline_latency_seconds',
  help: 'AI pipeline processing latency',
  labelNames: ['task_type'], // 'risk_classification', 'term_extraction', etc.
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

export const wsActiveConnections = new Gauge({
  name: 'trustroom_ws_active_connections',
  help: 'Active WebSocket connections',
});

export const escrowTxSuccess = new Counter({
  name: 'trustroom_escrow_tx_success_total',
  help: 'Successful escrow transactions',
  labelNames: ['operation'], // 'deposit', 'release', 'refund'
});

export const escrowTxFailure = new Counter({
  name: 'trustroom_escrow_tx_failure_total',
  help: 'Failed escrow transactions',
  labelNames: ['operation', 'error_type'],
});

export const bullmqJobsProcessed = new Counter({
  name: 'trustroom_bullmq_jobs_processed_total',
  help: 'BullMQ jobs processed',
  labelNames: ['queue', 'status'], // 'completed', 'failed'
});

// Expose metrics endpoint
// GET /metrics — scraped by Prometheus
```

### 29.3 Grafana Dashboard Layout

```text
Dashboard: TrustRoom MVP Overview

Row 1: Business KPIs
  • Deals Created (24h) — stat panel
  • Deals Completed (24h) — stat panel
  • Disputes Opened (24h) — stat panel
  • Total Escrow Value (24h) — stat panel

Row 2: API Health
  • Request Rate (req/s) — time series
  • Error Rate (% 5xx) — time series
  • P50/P95/P99 Latency — time series
  • Active WebSocket Connections — gauge

Row 3: AI Pipeline
  • Risk Classifications (24h) — counter
  • Term Extractions (24h) — counter
  • AI Pipeline Latency (P95) — time series
  • LLM Cost (24h) — stat panel
  • Scam Detections by Type — pie chart

Row 4: Escrow
  • Escrow Operations (24h) — bar chart
  • Escrow Success Rate — gauge
  • On-chain Transaction Latency — time series

Row 5: Infrastructure
  • PostgreSQL Connection Pool — gauge
  • Redis Memory Usage — gauge
  • BullMQ Job Queue Depth — gauge
  • Error Rate by Service — time series
```

### 29.4 PostHog Event Tracking

```typescript
// analytics/posthog.ts
import PostHog from 'posthog-node';

const posthog = new PostHog(process.env.POSTHOG_API_KEY!);

// Frontend events (tracked in Next.js)
const FRONTEND_EVENTS = {
  'wallet_connected': { chain: 'solana', wallet_type: string },
  'deal_created': { deal_type: string, amount: number, token: string },
  'deal_joined': { deal_id: string, role: 'buyer' | 'seller' },
  'deal_room_entered': { deal_id: string },
  'risk_warning_shown': { risk_level: string, intent: string },
  'terms_confirmed': { deal_id: string, role: string },
  'delivery_submitted': { deal_id: string },
  'escrow_action': { action: string, deal_id: string },
  'evidence_exported': { deal_id: string, format: string },
};

// Backend events (tracked in API)
const BACKEND_EVENTS = {
  'api_auth_success': { wallet: string },
  'api_deal_transition': { from: string, to: string },
  'api_ai_classification': { intent: string, risk_level: string, latency_ms: number },
  'api_escrow_simulation': { success: boolean, operation: string },
  'api_evidence_hash_computed': { deal_id: string, hash: string },
};
```

---

## 30. MVP Scope Clarification

### 30.1 Must Build (Core Demo Flow)

| # | Feature | Components | Priority |
|---|---------|-----------|----------|
| 1 | Deal Room Workspace | Video call + escrow panel + AI monitor + transcript | P0 |
| 2 | Wallet Login | Solana Wallet Adapter + nonce signature | P0 |
| 3 | Deal Lifecycle | Finite state machine with all transitions | P0 |
| 4 | Agora Voice/Video Room | RTC by deal ID + STT | P0 |
| 5 | AI Transcript + Term Summary | STT + LLM structured output | P0 |
| 6 | Scam Guard MVP | Rules + LLM intent classification | P0 |
| 7 | Solana Devnet Escrow | Anchor/Rust/SPL token deposit/release/refund | P0 |
| 8 | Evidence Vault Basic | Transcript + risk events + terms + tx hashes | P0 |

### 30.2 Can Simplify

| Feature | Simplified Approach |
|---------|-------------------|
| Wallet Risk Check | Only wallet age, tx count, internal deal history |
| Reputation | Simple score from completed deals / disputes |
| Dispute Assistant | Generate report only, no complex arbitration |
| Notifications | In-app only (no email/push) |
| Speaker Diarization | Map Agora UID to role (no ML-based diarization) |
| Embeddings/RAG | Start with 20-30 playbook entries, grow over time |
| Encryption at Rest | R2 server-side encryption only (skip app-level for MVP) |
| Audit Logs | Structured logging to file/DB (skip partitioning) |

### 30.3 Should NOT Build in MVP

| Feature | Reason |
|---------|--------|
| Full deepfake detection | Requires specialized ML models, not feasible for MVP |
| Full AML/KYC | Regulatory complexity, use basic wallet checks instead |
| Complex ML fraud model | Rule-based + LLM is sufficient for MVP |
| Advanced marketplace API | Focus on deal flow, not discovery |
| Full meeting platform | Agora handles the call, don't rebuild |
| Production-grade legal arbitration | AI-assisted report only, human reviews |
| Multi-chain support | Solana only for MVP |
| Mobile app | Web-first, responsive design |
| Email/push notifications | In-app only |
| Admin dashboard | Basic dispute view only |

### 30.4 Demo Script (Hackathon)

```text
1. Buyer opens web app → connects Phantom wallet
2. Buyer creates "Logo Design" deal for 100 USDC
3. Seller joins via invite link → connects wallet
4. System initializes Solana devnet escrow
5. Buyer deposits 100 mock USDC
6. Both join Agora Deal Room (video call)
7. Seller says: "Bạn release trước đi rồi tôi gửi file sau."
8. Agora STT transcribes in realtime
9. Scam Guard detects early_release_request (rule + LLM)
10. UI shows HIGH RISK warning with explanation
11. AI Deal Notary extracts and summarizes safe terms
12. Both parties review and sign terms
13. Seller submits delivery proof (file upload)
14. Buyer reviews → releases funds
15. Evidence Vault shows: transcript, warning, terms, tx hashes, evidence
```

---

## Section 31: Frontend Component Architecture

### 31.1 Component Tree

```text
apps/web/
├── app/
│   ├── layout.tsx                    # Root layout (providers, fonts, theme)
│   ├── page.tsx                      # Landing / redirect to /deals
│   ├── deals/
│   │   ├── page.tsx                  # Deal list view
│   │   └── [id]/
│   │       ├── page.tsx              # Deal detail (overview, terms, status)
│   │       └── room/
│   │           └── page.tsx          # Deal Room (video + transcript + AI)
│   ├── disputes/
│   │   └── [id]/
│   │       └── page.tsx              # Dispute resolution view
│   └── settings/
│       └── page.tsx                  # User settings (wallet, notifications)
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx              # Main layout wrapper (sidebar + content)
│   │   ├── Sidebar.tsx               # Navigation sidebar
│   │   ├── Header.tsx                # Top bar (wallet connect, notifications)
│   │   └── MobileNav.tsx             # Mobile bottom navigation
│   ├── deals/
│   │   ├── DealList.tsx              # Paginated deal list with filters
│   │   ├── DealCard.tsx              # Single deal card (status, amount, parties)
│   │   ├── DealDetail.tsx            # Full deal detail view
│   │   ├── DealStatusBadge.tsx       # Status badge with color coding
│   │   ├── CreateDealForm.tsx        # Multi-step deal creation form
│   │   ├── TermsEditor.tsx           # Deal terms editor (structured fields)
│   │   └── DealTimeline.tsx          # Visual timeline of deal state transitions
│   ├── room/
│   │   ├── DealRoom.tsx              # Main room container (video + sidebar)
│   │   ├── VideoPanel.tsx            # Agora video call integration
│   │   ├── TranscriptPanel.tsx       # Live transcript with speaker labels
│   │   ├── TranscriptEntry.tsx       # Single transcript line
│   │   ├── AIMonitorPanel.tsx        # AI risk monitor sidebar
│   │   ├── RiskIndicator.tsx         # Traffic-light risk gauge
│   │   ├── RiskWarning.tsx           # Individual risk warning card
│   │   ├── EscrowPanel.tsx           # Escrow status + actions
│   │   └── RoomControls.tsx          # Mute, camera, screen share, end call
│   ├── escrow/
│   │   ├── EscrowStatus.tsx          # Escrow state visualization
│   │   ├── DepositButton.tsx         # Deposit funds action
│   │   ├── ReleaseButton.tsx         # Release funds action
│   │   └── RefundButton.tsx          # Request refund action
│   ├── disputes/
│   │   ├── DisputePanel.tsx          # Dispute creation + evidence upload
│   │   ├── EvidenceList.tsx          # List of uploaded evidence
│   │   └── ResolutionCard.tsx        # Resolution outcome display
│   ├── shared/
│   │   ├── WalletConnect.tsx         # Phantom wallet connection button
│   │   ├── LoadingSpinner.tsx        # Loading indicator
│   │   ├── ErrorBoundary.tsx         # React error boundary
│   │   ├── Toast.tsx                 # Notification toast
│   │   ├── Modal.tsx                 # Reusable modal dialog
│   │   └── EmptyState.tsx            # Empty state placeholder
│   └── providers/
│       ├── WalletProvider.tsx        # Solana wallet context provider
│       ├── QueryProvider.tsx         # TanStack Query provider
│       └── WebSocketProvider.tsx     # Socket.io connection provider
├── hooks/
│   ├── useDeal.ts                    # Single deal data + mutations
│   ├── useDeals.ts                   # Deal list with pagination
│   ├── useTranscript.ts              # Transcript subscription + messages
│   ├── useRiskMonitor.ts             # Risk events subscription
│   ├── useEscrow.ts                  # Escrow state + actions
│   ├── useWebSocket.ts               # Socket.io connection management
│   └── useWallet.ts                  # Wallet connection + signing
├── lib/
│   ├── api.ts                        # API client (axios/fetch wrapper)
│   ├── socket.ts                     # Socket.io client setup
│   ├── solana.ts                     # Solana connection + program helpers
│   └── utils.ts                      # Date formatting, truncation, etc.
├── stores/
│   ├── dealStore.ts                  # Zustand: active deal state
│   ├── transcriptStore.ts            # Zustand: transcript messages
│   ├── riskStore.ts                  # Zustand: risk warnings
│   └── uiStore.ts                    # Zustand: UI state (sidebar, modals)
└── styles/
    └── globals.css                   # Tailwind base + custom properties
```

### 31.2 Zustand Store Definitions

```typescript
// stores/dealStore.ts
interface DealStore {
  deals: Deal[];
  activeDeal: Deal | null;
  isLoading: boolean;
  error: string | null;
  fetchDeals: (page: number, filters?: DealFilters) => Promise<void>;
  fetchDeal: (id: string) => Promise<void>;
  createDeal: (input: CreateDealInput) => Promise<Deal>;
  transitionDeal: (id: string, to: DealStatus) => Promise<void>;
  updateDealStatus: (deal: Deal) => void;
}

// stores/transcriptStore.ts
interface TranscriptStore {
  messages: TranscriptMessage[];
  isLive: boolean;
  sequenceNum: number;
  addMessage: (msg: TranscriptMessage) => void;
  setMessages: (msgs: TranscriptMessage[]) => void;
  clearMessages: () => void;
}

// stores/riskStore.ts
interface RiskStore {
  warnings: RiskWarning[];
  currentLevel: RiskLevel;
  totalScore: number;
  addWarning: (warning: RiskWarning) => void;
  updateScore: (score: number, level: RiskLevel) => void;
  clearWarnings: () => void;
}

// stores/uiStore.ts
interface UIStore {
  sidebarOpen: boolean;
  activeModal: string | null;
  toasts: Toast[];
  toggleSidebar: () => void;
  openModal: (id: string) => void;
  closeModal: () => void;
  addToast: (toast: Toast) => void;
  removeToast: (id: string) => void;
}
```

### 31.3 Route Structure (Next.js App Router)

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `page.tsx` | Landing page → redirect to `/deals` |
| `/deals` | `DealList` | All deals with filters (status, type, date) |
| `/deals/new` | `CreateDealForm` | Multi-step deal creation wizard |
| `/deals/[id]` | `DealDetail` | Deal overview, terms, status timeline |
| `/deals/[id]/room` | `DealRoom` | Video call + transcript + AI monitor |
| `/disputes/[id]` | `DisputePanel` | Dispute resolution with evidence |
| `/settings` | `SettingsPage` | Wallet, notifications, preferences |

### 31.4 Data Fetching Pattern

```typescript
// TanStack Query + Zustand hybrid pattern
// Query for server state, Zustand for client state

// hooks/useDeals.ts
export function useDeals(filters?: DealFilters) {
  return useQuery({
    queryKey: ['deals', filters],
    queryFn: () => api.get('/deals', { params: filters }),
    staleTime: 30_000,
  });
}

// hooks/useDeal.ts
export function useDeal(id: string) {
  const updateDealStatus = useDealStore(s => s.updateDealStatus);
  const query = useQuery({
    queryKey: ['deal', id],
    queryFn: () => api.get(`/deals/${id}`),
  });
  useEffect(() => {
    const unsub = socket.on('deal:status', (deal: Deal) => {
      if (deal.id === id) updateDealStatus(deal);
    });
    return unsub;
  }, [id]);
  return query;
}
```

### 31.5 Responsive Breakpoints

| Breakpoint | Layout | Components |
|------------|--------|------------|
| `< 768px` (mobile) | Single column, bottom nav | Stacked panels, collapsible sidebar |
| `768-1024px` (tablet) | Two-column, collapsible sidebar | Side-by-side video + transcript |
| `> 1024px` (desktop) | Three-column, fixed sidebar | Full layout: sidebar + video + AI panel |

### 31.6 Loading & Error States

```typescript
// Each data-dependent component follows this pattern:
// 1. Loading → Skeleton placeholder
// 2. Error → ErrorBoundary with retry
// 3. Empty → EmptyState with CTA
// 4. Success → Render data

if (isLoading) return <DealListSkeleton />;
if (error) return <ErrorBoundary error={error} onRetry={refetch} />;
if (deals.length === 0) return <EmptyState message="No deals yet" action="Create Deal" />;
return <DealListItems deals={deals} />;
```

---

## Section 32: Solana Escrow Program Specification

### 32.1 Program Overview

Anchor-based Solana program holding buyer funds in a PDA, releasing based on
multi-party consensus (buyer + seller + optional AI oracle).

**Program ID:** `TRstRoOM111111111111111111111111111111111111` (devnet)

### 32.2 Account Structures

```rust
use anchor_lang::prelude::*;

#[account]
pub struct EscrowState {
    pub deal_id: [u8; 32],
    pub bump: u8,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub amount: u64,
    pub state: EscrowStatus,
    pub deposited_at: Option<i64>,
    pub resolved_at: Option<i64>,
    pub release_condition_hash: [u8; 32],
    pub required_signers: u8,
    pub buyer_approved: bool,
    pub seller_approved: bool,
    pub oracle_approved: bool,
    pub oracle: Option<Pubkey>,
    pub is_disputed: bool,
    pub vault_bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EscrowStatus {
    Initialized,
    Funded,
    DeliveryConfirmed,
    ReadyToRelease,
    Released,
    Refunded,
    Disputed,
    Resolved,
}
```

### 32.3 Instruction Set

```rust
// Initialize: Create escrow PDA + vault
pub fn initialize(ctx: Context<Initialize>, deal_id: [u8; 32]) -> Result<()>

// Deposit: Buyer transfers tokens to vault
pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()>

// ApproveRelease: Buyer/seller/oracle approves release
pub fn approve_release(ctx: Context<ApproveRelease>) -> Result<()>

// Release: Transfer funds from vault to seller (requires consensus)
pub fn release(ctx: Context<Release>) -> Result<()>

// Refund: Return funds to buyer (before delivery or on dispute)
pub fn refund(ctx: Context<Refund>) -> Result<()>

// RaiseDispute: Lock funds for dispute resolution
pub fn raise_dispute(ctx: Context<RaiseDispute>) -> Result<()>
```

### 32.4 Error Codes

```rust
#[error_code]
pub enum EscrowError {
    #[msg("Invalid state transition")]
    InvalidStateTransition,
    #[msg("Unauthorized signer")]
    UnauthorizedSigner,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Escrow already resolved")]
    AlreadyResolved,
    #[msg("Dispute already raised")]
    DisputeAlreadyRaised,
    #[msg("Not all required approvals received")]
    InsufficientApprovals,
    #[msg("Release condition not met")]
    ReleaseConditionNotMet,
    #[msg("Invalid deal ID length")]
    InvalidDealIdLength,
}
```

### 32.5 PDA Derivation

```typescript
// packages/solana/src/pda.ts
import { PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('TRstRoOM111111111111111111111111111111111111');

export function findEscrowPda(dealId: string): [PublicKey, number] {
  const dealIdBuffer = Buffer.from(dealId.padEnd(32, '\0'));
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), dealIdBuffer],
    PROGRAM_ID,
  );
}

export function findVaultPda(escrowPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), escrowPda.toBuffer()],
    PROGRAM_ID,
  );
}
```

### 32.6 Client SDK (packages/solana)

```typescript
// packages/solana/src/client.ts
export class EscrowClient {
  private program: Program<EscrowProgram>;

  constructor(provider: AnchorProvider) {
    this.program = new Program(IDL, PROGRAM_ID, provider);
  }

  async initialize(dealId: string, buyer: PublicKey, mint: PublicKey) { /* ... */ }
  async deposit(dealId: string, amount: BN) { /* ... */ }
  async approveRelease(dealId: string) { /* ... */ }
  async release(dealId: string) { /* ... */ }
  async refund(dealId: string) { /* ... */ }
  async raiseDispute(dealId: string) { /* ... */ }
  async getEscrowState(dealId: string) { /* ... */ }
}
```

### 32.7 Test Plan

```typescript
describe('Escrow Program', () => {
  it('initializes escrow with correct PDA');
  it('deposits funds and updates vault balance');
  it('prevents non-buyer from depositing');
  it('allows buyer to approve release');
  it('allows seller to approve release');
  it('releases funds when both parties approve');
  it('prevents release without sufficient approvals');
  it('allows buyer to refund before delivery');
  it('prevents refund after release');
  it('allows either party to raise dispute');
  it('prevents state transitions after resolution');
  it('handles USDC and SOL deposits correctly');
});
```

---

## Section 33: AI Pipeline Implementation Guide

### 33.1 Package Structure

```text
packages/ai/
├── src/
│   ├── index.ts                    # Public API exports
│   ├── scam-guard/
│   │   ├── index.ts                # ScamGuard class
│   │   ├── classifier.ts           # Risk classification engine
│   │   ├── rules-engine.ts         # Rule-based detection (Layer 1)
│   │   ├── llm-classifier.ts       # LLM-based classification (Layer 2)
│   │   ├── embedding-scorer.ts     # Semantic similarity (Layer 3)
│   │   └── playbook.ts             # Scam playbook seed data
│   ├── term-extraction/
│   │   ├── index.ts                # TermExtractor class
│   │   ├── prompt-templates.ts     # GPT-4o prompt templates
│   │   └── post-processors.ts      # Validation & normalization
│   ├── prompts/
│   │   ├── risk-classification.md  # System prompt for risk scoring
│   │   ├── term-extraction.md      # System prompt for term extraction
│   │   └── scam-playbook.md        # Scam pattern catalog
│   └── utils/
│       ├── token-counter.ts        # Token usage tracking
│       ├── cost-calculator.ts      # Cost estimation
│       └── retry.ts                # Retry with exponential backoff
├── package.json
├── tsconfig.json
└── tests/
    ├── scam-guard.test.ts
    ├── term-extraction.test.ts
    └── fixtures/
        ├── clean-conversation.json
        ├── scam-conversation.json
        └── edge-cases.json
```

### 33.2 Risk Classification Prompt Template

```markdown
## System Prompt

You are TrustRoom's Scam Guard AI. Analyze a conversation transcript between
buyer and seller and classify the risk level.

## Classification Rules

Analyze for these scam intents:
- early_release_request: Ask to release escrow before delivery
- move_off_platform: Suggesting communication outside TrustRoom
- fake_payment_proof: Fabricated transaction screenshots
- credential_request: Asking for wallet keys or seed phrases
- external_wallet: Requesting payment to different wallet
- time_pressure: Urgency to bypass verification
- impersonation: Pretending to be support/admin
- term_change_after_deposit: Modifying terms after escrow funded
- ambiguous_terms: Vague language that could be exploited
- unverified_delivery: Claiming delivery without proof
- phishing_link: Sharing suspicious links

## Output Format

{
  "totalScore": 0-100,
  "level": "low" | "medium" | "high" | "critical",
  "intents": [{ "intent", "confidence", "triggerText", "reason", "suggestedAction" }],
  "breakdown": { "conversationRisk", "walletRisk", "escrowStateRisk", "evidenceRisk", "repetitionPenalty" },
  "actions": ["<recommended actions>"]
}

## Scoring: 0-24 low, 25-49 medium, 50-79 high, 80-100 critical
## NEVER release funds based solely on AI recommendation
```

### 33.3 Term Extraction Prompt Template

```markdown
## System Prompt

You are TrustRoom's Term Extraction AI. Extract structured deal terms from
a conversation between buyer and seller.

## Output Format

{
  "deliveryCondition": "<what constitutes delivery>",
  "releaseCondition": "<when funds should be released>",
  "refundCondition": "<refund conditions or null>",
  "disputeCondition": "<dispute resolution or null>",
  "deadline": "<ISO 8601 or null>",
  "specialTerms": ["<term1>", "<term2>"],
  "riskNotes": ["<concerning aspects>"],
  "confidence": 0.0-1.0
}

## Rules: Only extract explicitly stated terms. Flag ambiguities in riskNotes.
```

### 33.4 Scam Playbook Seed Data

```typescript
// packages/ai/src/scam-guard/playbook.ts
export interface ScamPattern {
  id: string;
  name: string;
  intent: string;
  severity: string;
  patterns: string[];
  keywords: string[];
  examples: string[];
  countermeasures: string[];
}

export const SCAM_PLAYBOOK: ScamPattern[] = [
  {
    id: 'SP001', name: 'Early Release Request',
    intent: 'early_release_request', severity: 'high',
    patterns: [/release\s+(the\s+)?(funds?|money)/i, /trust\s+me/i],
    keywords: ['release', 'funds', 'delivered', 'trust me'],
    examples: ["I've already sent you the files, please release the funds"],
    countermeasures: ['Warn buyer to verify delivery', 'Request verifiable proof'],
  },
  {
    id: 'SP002', name: 'Move Off Platform',
    intent: 'move_off_platform', severity: 'high',
    patterns: [/let's?\s+(?:chat|talk)\s+(?:on|via)\s+(?:telegram|discord|whatsapp)/i],
    keywords: ['telegram', 'discord', 'whatsapp', 'email', 'external wallet'],
    examples: ["Let's continue on Telegram: @username"],
    countermeasures: ['Warn about platform policy', 'Log the attempt'],
  },
  {
    id: 'SP003', name: 'Fake Payment Proof',
    intent: 'fake_payment_proof', severity: 'critical',
    patterns: [/here(?:'s| is)\s+(?:the\s+)?(?:proof|screenshot)/i],
    keywords: ['proof', 'screenshot', 'already paid', 'transaction'],
    examples: ["Here's the proof of payment: [screenshot]"],
    countermeasures: ['Never trust screenshots', 'Verify on-chain directly'],
  },
  {
    id: 'SP004', name: 'Credential Request',
    intent: 'credential_request', severity: 'critical',
    patterns: [/(?:give|send|share)\s+(?:me\s+)?(?:your\s+)?(?:seed\s+phrase|private\s+key)/i],
    keywords: ['seed phrase', 'private key', 'password', 'mnemonic'],
    examples: ["Can you share your seed phrase to verify the wallet?"],
    countermeasures: ['IMMEDIATELY warn victim', 'Freeze escrow', 'Flag as security incident'],
  },
  {
    id: 'SP005', name: 'External Wallet Request',
    intent: 'external_wallet', severity: 'high',
    patterns: [/(?:send|pay|transfer)\s+(?:to|into)\s+(?:this\s+)?(?:wallet|address)/i],
    keywords: ['external wallet', 'different address', 'send to'],
    examples: ["Send the payment to this wallet: 0x1234..."],
    countermeasures: ['Reject external wallet changes after deposit', 'Log the attempt'],
  },
  {
    id: 'SP006', name: 'Time Pressure',
    intent: 'time_pressure', severity: 'medium',
    patterns: [/(?:hurry|quick|rush|urgent|asap|immediately)\b/i, /(?:i(?:'ll| will)\s+(?:cancel|leave))/i],
    keywords: ['hurry', 'urgent', 'asap', 'immediately', 'cancel'],
    examples: ["Hurry up and release the funds, I need them now!"],
    countermeasures: ['Remind of actual deadline', 'Warn against rushing'],
  },
  {
    id: 'SP007', name: 'Impersonation',
    intent: 'impersonation', severity: 'critical',
    patterns: [/(?:i\s+am|this\s+is)\s+(?:from\s+)?(?:support|admin|moderator)/i],
    keywords: ['support', 'admin', 'moderator', 'official', 'team'],
    examples: ["I'm from TrustRoom support, I need to verify your account"],
    countermeasures: ['TrustRoom staff NEVER DM users', 'Flag impersonation'],
  },
  {
    id: 'SP008', name: 'Term Change After Deposit',
    intent: 'term_change_after_deposit', severity: 'high',
    patterns: [/(?:let(?:'s| us)\s+)?(?:change|modify|update)\s+(?:the\s+)?(?:terms?|conditions?)/i],
    keywords: ['change terms', 'modify', 'new price', 'different deal'],
    examples: ["Let's change the terms - I want 20% more"],
    countermeasures: ['Reject term changes after escrow funded', 'Suggest new deal'],
  },
  {
    id: 'SP009', name: 'Ambiguous Terms',
    intent: 'ambiguous_terms', severity: 'medium',
    patterns: [/(?:we(?:'ll| will)\s+)?(?:figure\s+it\s+out|work\s+it\s+out)/i],
    keywords: ['figure it out', 'work it out', 'decide later', 'something like'],
    examples: ["We'll figure out the delivery details later"],
    countermeasures: ['Prompt parties to clarify', 'Suggest structured term fields'],
  },
  {
    id: 'SP010', name: 'Unverified Delivery',
    intent: 'unverified_delivery', severity: 'high',
    patterns: [/(?:i(?:'ve| have)\s+)?(?:sent|delivered|completed)\s+(?:it|the\s+work)/i],
    keywords: ['delivered', 'completed', 'finished', 'check your'],
    examples: ["I've delivered the work, check your email"],
    countermeasures: ['Request verifiable proof', 'Use evidence upload feature'],
  },
  {
    id: 'SP011', name: 'Phishing Link',
    intent: 'phishing_link', severity: 'critical',
    patterns: [/(?:click|open|visit)\s+(?:this\s+)?(?:link|url|website)/i],
    keywords: ['click this link', 'verify wallet', 'confirm account'],
    examples: ["Click this link to verify your wallet: https://fake-site.com"],
    countermeasures: ['IMMEDIATELY warn about phishing', 'Block the link', 'Flag as security incident'],
  },
];
```

### 33.5 Cost Estimation (MVP)

| Component | Unit Cost | Monthly (100 deals) | Notes |
|-----------|-----------|---------------------|-------|
| GPT-4o-mini (classification) | $0.15/1M input | ~$2.25 | ~500 tokens × 100 deals × 3 |
| GPT-4o-mini (extraction) | $0.15/1M input | ~$0.75 | ~500 tokens × 100 deals |
| GPT-4o (complex cases) | $2.50/1M input | ~$1.25 | ~10% of deals |
| OpenAI Embeddings | $0.02/1M tokens | ~$0.01 | Minimal |
| **Total AI Cost** | | **~$4.26/month** | Very affordable for MVP |

### 33.6 Evaluation Dataset

```typescript
// tests/fixtures/evaluation-dataset.ts
export const EVALUATION_DATASET = [
  {
    id: 'eval-001', name: 'Clean freelance deal',
    transcript: [
      { speaker: 'buyer', text: 'Hi, I need a logo design for my startup' },
      { speaker: 'seller', text: 'Sure! What style are you looking for?' },
      { speaker: 'buyer', text: 'Modern, minimalist, blue and white' },
      { speaker: 'seller', text: "I'll deliver within 5 days. Okay?" },
      { speaker: 'buyer', text: "Perfect, let's proceed" },
    ],
    expectedRiskLevel: 'low', expectedIntents: [],
  },
  {
    id: 'eval-002', name: 'Early release scam',
    transcript: [
      { speaker: 'seller', text: "I've already sent you the files via email" },
      { speaker: 'seller', text: 'Please release the funds now, urgently' },
      { speaker: 'buyer', text: "I haven't received anything yet" },
      { speaker: 'seller', text: 'Trust me, I sent it. Check your spam' },
    ],
    expectedRiskLevel: 'high', expectedIntents: ['early_release_request', 'time_pressure'],
  },
  {
    id: 'eval-003', name: 'Off-platform redirect',
    transcript: [
      { speaker: 'seller', text: "Let's continue on Telegram, it's easier" },
      { speaker: 'seller', text: 'My Telegram is @scammer123' },
      { speaker: 'buyer', text: "Shouldn't we keep everything in TrustRoom?" },
    ],
    expectedRiskLevel: 'high', expectedIntents: ['move_off_platform'],
  },
  {
    id: 'eval-004', name: 'Credential phishing',
    transcript: [
      { speaker: 'seller', text: 'I need to verify your wallet to send the NFT' },
      { speaker: 'seller', text: 'Can you share your seed phrase?' },
      { speaker: 'buyer', text: "What? That doesn't sound right" },
    ],
    expectedRiskLevel: 'critical', expectedIntents: ['credential_request'],
  },
  {
    id: 'eval-005', name: 'Term change after deposit',
    transcript: [
      { speaker: 'buyer', text: "I've deposited the 5 SOL into escrow" },
      { speaker: 'seller', text: 'Actually, I want 7 SOL now' },
      { speaker: 'buyer', text: 'We agreed on 5 SOL' },
    ],
    expectedRiskLevel: 'high', expectedIntents: ['term_change_after_deposit'],
  },
];
```

---

## Appendix A: Type Definitions (packages/types)

```typescript
// deal.ts
export enum DealStatus { /* ... all 18 statuses ... */ }
export enum DealType { nft, token_otc, freelance_service, digital_goods, domain, other }
export enum AiMonitoringLevel { BASIC, STANDARD, STRICT }

export interface Deal {
  id: string;
  title: string;
  type: DealType;
  description?: string;
  amount: string;
  token: string;
  status: DealStatus;
  deadline?: string;
  buyerWallet: string;
  sellerWallet?: string;
  escrowAccountPubkey?: string;
  termsHash?: string;
  evidenceHash?: string;
  agoraChannelName?: string;
  aiMonitoringLevel: AiMonitoringLevel;
  createdAt: string;
  updatedAt: string;
}

// ai.ts
export enum RiskLevel { LOW, MEDIUM, HIGH, CRITICAL }

export interface RiskEvent {
  id: string;
  dealId: string;
  speakerWallet?: string;
  intent: string;
  riskLevel: RiskLevel;
  score: number;
  reason: string;
  transcriptSnippet?: string;
  ruleId?: string;
  timestamp: string;
}

export interface ExtractedTerms {
  dealType: string;
  assetOrService: string;
  amount: string;
  token: string;
  deadline?: string;
  deliveryCondition: string;
  releaseCondition: string;
  refundCondition?: string;
  disputeCondition?: string;
  specialTerms: string[];
  riskNotes: string[];
  confidence: number;
}

export interface RiskAssessment {
  totalScore: number;
  level: RiskLevel;
  actions: string[];
  breakdown: {
    conversationRisk: number;
    walletRisk: number;
    escrowStateRisk: number;
    evidenceRisk: number;
    repetitionPenalty: number;
  };
}

// websocket.ts
export interface WSRiskWarning {
  dealId: string;
  intent: string;
  riskLevel: RiskLevel;
  score: number;
  message: string;
  speaker: string;
  timestamp: string;
}

export interface WSTranscriptEvent {
  dealId: string;
  speaker: string;
  wallet?: string;
  content: string;
  sequenceNum: number;
  timestamp: string;
}

export interface WSDealStatusChange {
  dealId: string;
  status: DealStatus;
  timestamp: string;
}
```

---

## Appendix B: Key Design Decisions Log

| # | Decision | Rationale | Trade-off |
|---|----------|-----------|-----------|
| 1 | NestJS over Express | Module system, DI, built-in WS gateway, Guards | Steeper learning curve |
| 2 | Prisma over Drizzle | Better DX, migration workflow, type safety | Slightly larger bundle |
| 3 | Zustand over Redux | Minimal boilerplate, no providers needed | Less middleware ecosystem |
| 4 | Agora over Daily/WebRTC | Built-in STT, global infrastructure, AI agent support | Vendor lock-in |
| 5 | GPT-4o for AI | Best structured output, reliable classification | Cost per call |
| 6 | R2 over S3 | Free egress, S3-compatible | Smaller ecosystem |
| 7 | Anchor for escrow | Industry standard for Solana programs | Rust learning curve |
| 8 | pgvector over Qdrant | Fewer moving parts, already using PostgreSQL | Less performant at scale |
| 9 | JWT over session cookies | Stateless, works with wallet auth flow | No server-side revocation |
| 10 | BullMQ over native setTimeout | Reliable job queue, retries, concurrency | Redis dependency |

---

## Section 38: API Endpoint Specifications (Detailed)

### 38.1 Authentication Endpoints

#### POST /api/auth/nonce
Generate a random nonce for SIWS signing.

**Request:**
```json
{
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"
}
```

**Response (200):**
```json
{
  "nonce": "TrustRoom wants you to sign in with your Solana wallet:\n\nWallet: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU\nNonce: a1b2c3d4-e5f6-7890-abcd-ef1234567890\nIssued At: 2026-06-20T10:00:00.000Z"
}
```

**Error (400):** `{ "error": "Invalid wallet address format" }`

#### POST /api/auth/verify
Verify SIWS signature and return JWT.

**Request:**
```json
{
  "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "signature": "3Kc9zGh...",
  "message": "TrustRoom wants you to sign in..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "usr_abc123",
    "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "displayName": null,
    "reputationScore": 50,
    "createdAt": "2026-06-20T10:00:00.000Z"
  }
}
```

**Error (401):** `{ "error": "Invalid signature" }`
**Error (429):** `{ "error": "Too many attempts", "retryAfter": 60 }`

### 38.2 Deal Endpoints

#### GET /api/deals
List deals for the authenticated user with pagination and filters.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 50) |
| `status` | string | — | Filter by DealStatus |
| `type` | string | — | Filter by DealType |
| `role` | string | — | `buyer` or `seller` |
| `sort` | string | `createdAt` | Sort field |
| `order` | string | `desc` | `asc` or `desc` |

**Response (200):**
```json
{
  "data": [
    {
      "id": "deal_xyz789",
      "title": "NFT Art Commission",
      "type": "nft",
      "amount": 5.0,
      "token": "SOL",
      "status": "NEGOTIATING",
      "buyerWallet": "7xKX...AsU",
      "sellerWallet": "9yMZ...Bq2",
      "aiMonitoringLevel": "STANDARD",
      "createdAt": "2026-06-20T10:00:00.000Z",
      "updatedAt": "2026-06-20T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

#### POST /api/deals
Create a new deal.

**Request:**
```json
{
  "title": "NFT Art Commission",
  "type": "nft",
  "description": "Custom pixel art NFT, 100x100",
  "amount": 5.0,
  "token": "SOL",
  "sellerWallet": "9yMZ...Bq2",
  "deadline": "2026-07-01T00:00:00.000Z",
  "aiMonitoringLevel": "STANDARD",
  "terms": {
    "deliveryCondition": "Seller delivers 100x100 PNG + metadata JSON",
    "releaseCondition": "Buyer confirms delivery in room",
    "refundCondition": "Full refund if not delivered by deadline",
    "specialTerms": ["3 revision rounds included"]
  }
}
```

**Response (201):** Full Deal object with `id`, `status: "Created"`, `termsHash`.

**Error (400):** `{ "error": "Validation failed", "details": [...] }`
**Error (409):** `{ "error": "Deal already exists with this title and parties" }`

#### GET /api/deals/:id
Get deal detail including terms, risk summary, and escrow status.

**Response (200):**
```json
{
  "id": "deal_xyz789",
  "title": "NFT Art Commission",
  "status": "DEPOSITED",
  "terms": {
    "deliveryCondition": "Seller delivers 100x100 PNG + metadata JSON",
    "releaseCondition": "Buyer confirms delivery in room",
    "refundCondition": "Full refund if not delivered by deadline",
    "specialTerms": ["3 revision rounds included"],
    "riskNotes": [],
    "confidence": 0.92
  },
  "escrow": {
    "pubkey": "Esc789...",
    "amount": 5.0,
    "token": "SOL",
    "state": "Funded",
    "depositedAt": "2026-06-20T11:00:00.000Z"
  },
  "riskSummary": {
    "currentScore": 12,
    "currentLevel": "low",
    "totalEvents": 2,
    "latestEvent": {
      "intent": "off_platform_redirect",
      "riskLevel": "medium",
      "score": 25,
      "timestamp": "2026-06-20T11:30:00.000Z"
    }
  },
  "transcriptCount": 47,
  "evidenceCount": 0
}
```

#### PATCH /api/deals/:id
Update deal details (only in `Created` or `Negotiating` status).

**Request:** Partial update of `title`, `description`, `amount`, `token`, `deadline`, `aiMonitoringLevel`.

**Response (200):** Updated Deal object.

**Error (409):** `{ "error": "Cannot update deal in current status: Deposited" }`

#### POST /api/deals/:id/transition
Transition deal to next state.

**Request:**
```json
{
  "toStatus": "Negotiating",
  "reason": "Both parties agreed to terms"
}
```

**Response (200):** Updated Deal object with new status.

**Error (400):** `{ "error": "Invalid transition from Created to Deposited" }`
**Error (403):** `{ "error": "Only buyer can perform this transition" }`

### 38.3 Transcript Endpoints

#### GET /api/deals/:dealId/transcript
Get paginated transcript for a deal.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 100 | Items per page (max 500) |
| `after` | string | — | ISO timestamp for incremental fetch |
| `speaker` | string | — | Filter by speaker wallet |

**Response (200):**
```json
{
  "data": [
    {
      "id": "msg_001",
      "speaker": "buyer",
      "speakerWallet": "7xKX...AsU",
      "content": "Hi, I need a logo design",
      "sequenceNum": 1,
      "timestamp": "2026-06-20T10:05:00.000Z",
      "riskEvents": []
    },
    {
      "id": "msg_002",
      "speaker": "seller",
      "speakerWallet": "9yMZ...Bq2",
      "content": "Sure! What style are you looking for?",
      "sequenceNum": 2,
      "timestamp": "2026-06-20T10:05:30.000Z",
      "riskEvents": []
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 47,
    "totalPages": 1
  }
}
```

### 38.4 Risk Event Endpoints

#### GET /api/deals/:dealId/risk-events
Get risk events for a deal.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `level` | string | — | Filter by RiskLevel |
| `intent` | string | — | Filter by intent type |
| `limit` | number | 50 | Max results |

**Response (200):**
```json
{
  "data": [
    {
      "id": "risk_001",
      "dealId": "deal_xyz789",
      "speakerWallet": "9yMZ...Bq2",
      "intent": "off_platform_redirect",
      "riskLevel": "medium",
      "score": 25,
      "reason": "Seller suggested moving to Telegram",
      "transcriptSnippet": "Let's continue on Telegram for faster communication",
      "ruleId": "OFF_PLATFORM",
      "timestamp": "2026-06-20T11:30:00.000Z"
    }
  ],
  "summary": {
    "totalScore": 12,
    "currentLevel": "low",
    "breakdown": {
      "conversationRisk": 8,
      "walletRisk": 0,
      "escrowStateRisk": 0,
      "evidenceRisk": 0,
      "repetitionPenalty": 4
    }
  }
}
```

### 38.5 Evidence Endpoints

#### POST /api/deals/:dealId/evidence
Upload evidence file (multipart/form-data).

**Request:** `multipart/form-data` with `file` field (max 50MB, accepted: images, PDFs, videos).

**Response (201):**
```json
{
  "id": "ev_001",
  "dealId": "deal_xyz789",
  "uploadedBy": "usr_abc123",
  "fileUrl": "https://pub-xxx.r2.dev/evidence/deal_xyz789/ev_001.png",
  "fileHash": "sha256:abc123...",
  "fileType": "image/png",
  "fileSize": 1048576,
  "description": "Screenshot of delivered artwork",
  "createdAt": "2026-06-20T12:00:00.000Z"
}
```

**Error (413):** `{ "error": "File size exceeds 50MB limit" }`
**Error (415):** `{ "error": "Unsupported file type" }`

#### GET /api/deals/:dealId/evidence
List evidence for a deal.

**Response (200):**
```json
{
  "data": [
    {
      "id": "ev_001",
      "fileUrl": "https://pub-xxx.r2.dev/evidence/...",
      "fileHash": "sha256:abc123...",
      "fileType": "image/png",
      "fileSize": 1048576,
      "description": "Screenshot of delivered artwork",
      "uploadedBy": "usr_abc123",
      "createdAt": "2026-06-20T12:00:00.000Z"
    }
  ],
  "totalHash": "sha256:combined_hash_of_all_evidence"
}
```

### 38.6 Dispute Endpoints

#### POST /api/deals/:dealId/dispute
Raise a dispute for a deal.

**Request:**
```json
{
  "reason": "Seller did not deliver the agreed artwork",
  "evidenceIds": ["ev_001", "ev_002"]
}
```

**Response (201):**
```json
{
  "id": "disp_001",
  "dealId": "deal_xyz789",
  "raisedBy": "usr_abc123",
  "reason": "Seller did not deliver the agreed artwork",
  "status": "Open",
  "evidenceIds": ["ev_001", "ev_002"],
  "createdAt": "2026-06-20T13:00:00.000Z"
}
```

**Error (409):** `{ "error": "Dispute already exists for this deal" }`
**Error (400):** `{ "error": "Cannot raise dispute in current deal status" }`

#### GET /api/disputes/:id
Get dispute detail with evidence and resolution status.

#### POST /api/disputes/:id/resolve
Resolve a dispute (admin/oracle only).

**Request:**
```json
{
  "resolution": "Refund to buyer",
  "resolutionType": "REFUND",
  "notes": "Evidence confirms non-delivery"
}
```

### 38.7 Notification Endpoints

#### GET /api/notifications
Get paginated notifications for the authenticated user.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `unreadOnly` | boolean | false | Filter unread only |

**Response (200):**
```json
{
  "data": [
    {
      "id": "notif_001",
      "type": "RISK_WARNING",
      "title": "Risk Detected",
      "message": "Off-platform redirect detected in NFT Art Commission deal",
      "dealId": "deal_xyz789",
      "read": false,
      "createdAt": "2026-06-20T11:30:00.000Z"
    }
  ],
  "unreadCount": 3,
  "pagination": { "page": 1, "limit": 20, "total": 15, "totalPages": 1 }
}
```

#### PATCH /api/notifications/:id/read
Mark a notification as read.

#### POST /api/notifications/read-all
Mark all notifications as read.

### 38.8 WebSocket Events (Real-time)

#### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `room:join` | `{ dealId: string }` | Join a deal room |
| `room:leave` | `{ dealId: string }` | Leave a deal room |
| `transcript:send` | `{ dealId, content, speakerWallet }` | Send transcript message |
| `typing:start` | `{ dealId, wallet }` | Typing indicator |
| `typing:stop` | `{ dealId, wallet }` | Stop typing indicator |

#### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `transcript:message` | `WSTranscriptEvent` | New transcript entry |
| `risk:warning` | `WSRiskWarning` | Risk event detected |
| `risk:score-updated` | `{ dealId, totalScore, level, breakdown }` | Risk score changed |
| `deal:status` | `WSDealStatusChange` | Deal status transition |
| `escrow:updated` | `{ dealId, escrowState, txHash }` | Escrow state changed |
| `notification:new` | `Notification` | New notification |
| `room:users` | `{ dealId, users: string[] }` | Active users in room |

### 38.9 Rate Limiting (Per Endpoint)

| Endpoint Group | Limit | Window | Key |
|---------------|-------|--------|-----|
| Auth (nonce, verify) | 10 req | 1 min | IP |
| Deal CRUD | 60 req | 1 min | User |
| Transcript send | 30 msg | 1 min | User + Deal |
| Evidence upload | 10 req | 5 min | User + Deal |
| Dispute create | 3 req | 1 hour | User + Deal |
| General API | 120 req | 1 min | User |

---

## Section 39: Database Query Patterns & Optimization

### 39.1 Critical Query Patterns

#### Hot Path: Deal Listing (Most Frequent)
```sql
-- Optimized with composite index
SELECT d.*, 
  (SELECT COUNT(*) FROM "Transcript" t WHERE t."dealId" = d.id) as "transcriptCount",
  (SELECT COUNT(*) FROM "RiskEvent" r WHERE r."dealId" = d.id AND r."riskLevel" IN ('high', 'critical')) as "highRiskCount"
FROM "Deal" d
WHERE (d."buyerWallet" = $1 OR d."sellerWallet" = $1)
  AND ($2::text IS NULL OR d."status" = $2)
  AND ($3::text IS NULL OR d."type" = $3)
ORDER BY d."createdAt" DESC
LIMIT $4 OFFSET $5;
```

**Required Indexes:**
```sql
-- Composite index for deal listing
CREATE INDEX idx_deal_party_status ON "Deal" ("buyerWallet", "status") INCLUDE ("title", "type", "amount", "token");
CREATE INDEX idx_deal_party_status_seller ON "Deal" ("sellerWallet", "status") INCLUDE ("title", "type", "amount", "token");

-- Transcript count subquery
CREATE INDEX idx_transcript_deal ON "Transcript" ("dealId", "sequenceNum");

-- Risk event aggregation
CREATE INDEX idx_risk_event_deal_level ON "RiskEvent" ("dealId", "riskLevel") INCLUDE ("intent", "score", "timestamp");
```

#### Hot Path: Transcript Pagination (Real-time)
```sql
-- Incremental fetch for real-time sync
SELECT * FROM "Transcript"
WHERE "dealId" = $1
  AND ($2::timestamp IS NULL OR "timestamp" > $2)
ORDER BY "sequenceNum" ASC
LIMIT $3;
```

**Required Index:**
```sql
CREATE INDEX idx_transcript_deal_seq ON "Transcript" ("dealId", "sequenceNum") INCLUDE ("speaker", "speakerWallet", "content", "timestamp");
```

#### Hot Path: Risk Score Aggregation
```sql
-- Current risk score for a deal (used in DealRoom header)
SELECT 
  COALESCE(SUM(CASE WHEN "riskLevel" = 'critical' THEN 40 WHEN "riskLevel" = 'high' THEN 25 WHEN "riskLevel" = 'medium' THEN 10 ELSE 3 END), 0) as "totalScore",
  COUNT(*) as "totalEvents",
  MAX("timestamp") as "lastEventAt"
FROM "RiskEvent"
WHERE "dealId" = $1;
```

**Required Index:**
```sql
CREATE INDEX idx_risk_event_deal_score ON "RiskEvent" ("dealId") INCLUDE ("riskLevel", "score", "timestamp");
```

#### Hot Path: Evidence Hash Chain
```sql
-- Verify evidence integrity
SELECT id, "fileHash", "createdAt"
FROM "Evidence"
WHERE "dealId" = $1
ORDER BY "createdAt" ASC;
```

### 39.2 N+1 Query Prevention

#### Deal List with Relations
```typescript
// ❌ N+1: Separate queries for each deal's relations
const deals = await prisma.deal.findMany({ where });
for (const deal of deals) {
  deal.terms = await prisma.dealTerms.findUnique({ where: { dealId: deal.id } });
  deal.riskEvents = await prisma.riskEvent.findMany({ where: { dealId: deal.id } });
}

// ✅ Batch: Single query with includes
const deals = await prisma.deal.findMany({
  where,
  include: {
    terms: { select: { deliveryCondition: true, releaseCondition: true, confidence: true } },
    _count: { select: { riskEvents: true, transcripts: true, evidence: true } },
  },
  orderBy: { createdAt: 'desc' },
  take: limit,
  skip: offset,
});
```

#### Deal Detail with Aggregated Risk
```typescript
// ✅ Single query with aggregation
const deal = await prisma.deal.findUnique({
  where: { id: dealId },
  include: {
    terms: true,
    escrow: true,
    _count: { select: { transcripts: true, evidence: true } },
  },
});

// Separate aggregation for risk (cannot be done in single Prisma query)
const riskAgg = await prisma.riskEvent.aggregate({
  where: { dealId: dealId },
  _sum: { score: true },
  _count: true,
  _max: { timestamp: true },
});
```

### 39.3 Connection Pooling Configuration

```typescript
// prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', async () => {
      await app.close();
    });
  }
}

// datasource in schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  // Connection pooling via PgBouncer or Prisma Accelerate
  // For serverless: use Prisma Accelerate or connection pooler
  // For monolith: direct connection with pool_size=10
}
```

**Recommended Pool Settings:**
| Environment | Pool Size | Timeout | Connection Limit |
|-------------|-----------|---------|-----------------|
| Development | 5 | 10s | Direct |
| Production | 10 | 5s | PgBouncer (min=5, max=20) |
| Serverless | — | — | Prisma Accelerate |

### 39.4 Read Replica Strategy (Post-MVP)

For MVP, single PostgreSQL instance is sufficient. For scale:
- **Read replicas** for transcript queries (high read volume)
- **Write primary** for deal mutations, risk events, evidence
- **Prisma Accelerate** for automatic read/write splitting

---

## Section 40: Frontend Component Implementation Details

### 40.1 Component Tree (Full Hierarchy)

```text
App
├── providers/
│   ├── WalletProvider.tsx          # Solana wallet context
│   ├── QueryProvider.tsx           # TanStack Query
│   ├── WebSocketProvider.tsx       # Socket.io connection
│   └── ThemeProvider.tsx           # Dark/light mode
├── layout/
│   ├── AppLayout.tsx               # Main layout (sidebar + content)
│   ├── Sidebar.tsx                 # Navigation sidebar
│   ├── Header.tsx                  # Top bar (wallet, notifications)
│   └── MobileNav.tsx               # Bottom navigation (mobile)
├── pages/
│   ├── LandingPage.tsx             # / → redirect to /deals
│   ├── DealListPage.tsx            # /deals
│   ├── DealDetailPage.tsx          # /deals/[id]
│   ├── DealRoomPage.tsx            # /deals/[id]/room
│   ├── CreateDealPage.tsx          # /deals/new
│   ├── DisputePage.tsx             # /disputes/[id]
│   └── SettingsPage.tsx            # /settings
├── components/
│   ├── deals/
│   │   ├── DealList.tsx            # Paginated list with filters
│   │   ├── DealCard.tsx            # Card: title, status, amount, parties
│   │   ├── DealDetail.tsx          # Full detail view
│   │   ├── DealStatusBadge.tsx     # Color-coded status badge
│   │   ├── CreateDealForm.tsx      # Multi-step wizard (3 steps)
│   │   ├── TermsEditor.tsx         # Structured terms input
│   │   └── DealTimeline.tsx        # Visual state transition timeline
│   ├── room/
│   │   ├── DealRoom.tsx            # Main room container
│   │   ├── VideoPanel.tsx          # Agora video (2-up grid)
│   │   ├── TranscriptPanel.tsx     # Scrollable transcript list
│   │   ├── TranscriptEntry.tsx     # Single line: avatar + name + text + time
│   │   ├── AIMonitorPanel.tsx      # Risk gauge + warnings + actions
│   │   ├── RiskIndicator.tsx       # Traffic-light circle (green/yellow/orange/red)
│   │   ├── RiskWarning.tsx         # Warning card: icon + message + timestamp
│   │   ├── EscrowPanel.tsx         # Escrow status + deposit/release/refund buttons
│   │   └── RoomControls.tsx        # Mic, camera, screen share, end call
│   ├── escrow/
│   │   ├── EscrowStatus.tsx        # State visualization (step indicator)
│   │   ├── DepositButton.tsx       # Phantom wallet deposit flow
│   │   ├── ReleaseButton.tsx       # Release confirmation dialog
│   │   └── RefundButton.tsx        # Refund request dialog
│   ├── disputes/
│   │   ├── DisputePanel.tsx        # Dispute creation form
│   │   ├── EvidenceList.tsx        # Uploaded evidence grid
│   │   └── ResolutionCard.tsx      # Resolution outcome display
│   ├── shared/
│   │   ├── WalletConnect.tsx       # Phantom connect/disconnect
│   │   ├── LoadingSkeleton.tsx     # Skeleton placeholder
│   │   ├── ErrorBoundary.tsx       # React error boundary
│   │   ├── Toast.tsx               # Notification toast (top-right)
│   │   ├── Modal.tsx               # Reusable modal
│   │   ├── EmptyState.tsx          # Empty state with CTA
│   │   ├── Badge.tsx               # Generic badge component
│   │   └── Button.tsx              # Primary/secondary/ghost variants
│   └── providers/
│       ├── WalletProvider.tsx
│       ├── QueryProvider.tsx
│       └── WebSocketProvider.tsx
├── hooks/
│   ├── useDeal.ts                  # Single deal query + WS updates
│   ├── useDeals.ts                 # Deal list with pagination
│   ├── useTranscript.ts            # Transcript subscription
│   ├── useRiskMonitor.ts           # Risk event subscription
│   ├── useEscrow.ts                # Escrow state + actions
│   ├── useWebSocket.ts             # Socket.io connection
│   └── useWallet.ts                # Wallet connection + signing
├── lib/
│   ├── api.ts                      # Axios wrapper with JWT interceptor
│   ├── socket.ts                   # Socket.io client singleton
│   ├── solana.ts                   # Connection + program helpers
│   └── utils.ts                    # Date formatting, truncation
├── stores/
│   ├── dealStore.ts                # Active deal state
│   ├── transcriptStore.ts          # Transcript messages
│   ├── riskStore.ts                # Risk warnings + score
│   └── uiStore.ts                  # Sidebar, modals, toasts
└── styles/
    └── globals.css                 # Tailwind + custom properties
```

### 40.2 Zustand Store Implementations

```typescript
// stores/dealStore.ts
import { create } from 'zustand';
import type { Deal, DealStatus } from '@trustroom/types';

interface DealFilters {
  status?: DealStatus;
  type?: string;
  role?: 'buyer' | 'seller';
  page?: number;
  limit?: number;
}

interface DealStore {
  deals: Deal[];
  activeDeal: Deal | null;
  isLoading: boolean;
  error: string | null;
  filters: DealFilters;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  
  setFilters: (filters: DealFilters) => void;
  fetchDeals: () => Promise<void>;
  fetchDeal: (id: string) => Promise<void>;
  createDeal: (input: CreateDealInput) => Promise<Deal>;
  transitionDeal: (id: string, to: DealStatus, reason?: string) => Promise<void>;
  updateDealStatus: (deal: Deal) => void;
}

// stores/transcriptStore.ts
interface TranscriptMessage {
  id: string;
  speaker: string;
  speakerWallet?: string;
  content: string;
  sequenceNum: number;
  timestamp: string;
  riskEvents?: RiskEvent[];
}

interface TranscriptStore {
  messages: TranscriptMessage[];
  isLive: boolean;
  sequenceNum: number;
  addMessage: (msg: TranscriptMessage) => void;
  setMessages: (msgs: TranscriptMessage[]) => void;
  clearMessages: () => void;
}

// stores/riskStore.ts
interface RiskWarning {
  id: string;
  intent: string;
  riskLevel: RiskLevel;
  score: number;
  message: string;
  speaker: string;
  timestamp: string;
}

interface RiskStore {
  warnings: RiskWarning[];
  currentLevel: RiskLevel;
  totalScore: number;
  breakdown: RiskBreakdown;
  addWarning: (warning: RiskWarning) => void;
  updateScore: (score: number, level: RiskLevel, breakdown: RiskBreakdown) => void;
  clearWarnings: () => void;
}

// stores/uiStore.ts
interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface UIStore {
  sidebarOpen: boolean;
  activeModal: string | null;
  toasts: Toast[];
  toggleSidebar: () => void;
  openModal: (id: string) => void;
  closeModal: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}
```

### 40.3 CreateDealForm (Multi-Step Wizard)

```text
Step 1: Basic Info
├── Title (text input, required)
├── Type (select: nft, token_otc, freelance_service, digital_goods, domain, other)
├── Description (textarea, optional)
├── Amount (number input, required)
├── Token (select: SOL, USDC)
└── Seller Wallet (text input, required)

Step 2: Terms
├── Delivery Condition (textarea, required)
├── Release Condition (textarea, required)
├── Refund Condition (textarea, optional)
├── Deadline (datetime picker, optional)
└── Special Terms (tag input, optional)

Step 3: Review & Create
├── Summary card (all fields read-only)
├── AI Monitoring Level (radio: BASIC, STANDARD, STRICT)
├── Terms Hash preview
└── [Create Deal] button
```

### 40.4 DealRoom Layout (Desktop)

```text
┌─────────────────────────────────────────────────────────────────┐
│ DealHeader                                                       │
│ [← Back] NFT Art Commission  [Negotiating]  [Risk: ● Low]  [💰]│
├───────────────────────────────────────┬──────────────────────────┤
│                                       │ DealControlPanel         │
│  VideoPanel (Agora RTC)               │ ├─ Deal Info             │
│  ┌─────────────────┬────────────────┐ │ ├─ Escrow Status         │
│  │   Remote Video  │   Local Video  │ │ ├─ Delivery Proof        │
│  │   (seller)      │   (buyer)      │ │ └─ Term Confirmation    │
│  │                 │                │ │                          │
│  └─────────────────┴────────────────┘ ├──────────────────────────┤
│                                       │ AIMonitorPanel           │
│  RoomControls                         │ ├─ RiskIndicator (●)     │
│  [🎤] [📷] [🖥️] [📞 End]            │ ├─ Latest Warning        │
│                                       │ └─ Suggested Actions     │
├───────────────────────────────────────┴──────────────────────────┤
│ TranscriptPanel (expandable, max 40% height)                     │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ [Buyer] Hi, I need a logo design              10:05 AM     │ │
│ │ [Seller] Sure! What style?                   10:05 AM     │ │
│ │ ⚠️ [Risk] Off-platform redirect detected      10:15 AM     │ │
│ │ [Buyer] Let's keep it here                    10:16 AM     │ │
│ │ [Seller] OK, I'll send the draft soon         10:20 AM     │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ [Type a message...]                              [Send] [📎]     │
└─────────────────────────────────────────────────────────────────┘
```

### 40.5 Responsive Behavior

| Breakpoint | Video | Transcript | AI Panel | Controls |
|------------|-------|------------|----------|----------|
| `< 768px` | Full width, stacked | Below video, collapsible | Bottom sheet | Floating FAB |
| `768-1024px` | Left 60% | Right 40%, tabbed with AI | Tab view | Inline |
| `> 1024px` | Left 50% | Bottom 30% | Right sidebar 25% | Inline |

### 40.6 Loading States

```typescript
// Skeleton patterns for each view
DealListSkeleton: 6 × DealCardSkeleton (pulse animation)
DealDetailSkeleton: HeaderSkeleton + TermsSkeleton + TimelineSkeleton
DealRoomSkeleton: VideoPlaceholder + TranscriptSkeleton(10 lines) + PanelSkeleton
```

### 40.7 Error States

```typescript
// ErrorBoundary per page
DealListPage → "Failed to load deals" + [Retry]
DealDetailPage → "Deal not found" or "Access denied" + [Go Back]
DealRoomPage → "Connection lost" + [Reconnect] | "Room closed" + [Back to Deal]
```

---

## Section 34: CI/CD Pipeline — Detailed Workflow

### 34.1 GitHub Actions Workflow (Full)

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '8'

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with: { version: '${{ env.PNPM_VERSION }}' }
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint
      - run: pnpm turbo typecheck

  test:
    runs-on: ubuntu-latest
    needs: lint
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_USER: test, POSTGRES_PASSWORD: test, POSTGRES_DB: trustroom_test }
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 10s
          --health-timeout 5s --health-retries 5
    env:
      DATABASE_URL: postgresql://test:test@localhost:5432/trustroom_test
      JWT_SECRET: test-jwt-secret-for-ci-min-32-chars!!
      SOLANA_RPC_URL: https://api.devnet.solana.com
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with: { version: '${{ env.PNPM_VERSION }}' }
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @trustroom/db db:push
      - run: pnpm --filter @trustroom/db db:generate
      - run: pnpm turbo test -- --coverage

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with: { version: '${{ env.PNPM_VERSION }}' }
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build

  deploy-staging:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop'
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - name: Deploy API (Railway staging)
        run: curl -X POST "$RAILWAY_DEPLOY_URL" -H "Authorization: Bearer $RAILWAY_TOKEN" -d '{"service":"api-staging"}'
      - name: Deploy Web (Vercel staging)
        run: cd apps/web && npx vercel --token $VERCEL_TOKEN --prod --yes

  deploy-production:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Deploy API (Railway production)
        run: curl -X POST "$RAILWAY_DEPLOY_URL" -H "Authorization: Bearer $RAILWAY_TOKEN" -d '{"service":"api-production"}'
      - name: Deploy Web (Vercel production)
        run: cd apps/web && npx vercel --token $VERCEL_TOKEN --prod --yes
```

### 34.2 Environment Promotion & Rollback

```text
Feature Branch ──PR──→ Staging (develop) ──PR──→ Production (main)
  CI gates: lint + test + build        Manual approval + smoke test
```

| Scenario | Rollback Procedure | RTO |
|----------|-------------------|-----|
| Bad API deploy | Railway instant rollback | < 1 min |
| Bad Web deploy | Vercel CLI rollback | < 1 min |
| Bad DB migration | `prisma migrate resolve --rolled-back` + redeploy | < 5 min |
| Breaking change | Feature flag toggle | < 30s |

---

## Section 35: Cost Estimation (MVP Budget)

### 35.1 Monthly Cost Breakdown

| Category | Service | Monthly Cost (MVP) |
|----------|---------|-------------------|
| LLM | GPT-4o (term extraction, summaries) | ~$50 |
| LLM | GPT-4o-mini (risk classification) | ~$5 |
| Video | Agora SD-RTN (~200 hrs) | ~$20 |
| STT | Agora STT (~200 hrs audio) | ~$280 |
| Infra | Railway (API) | ~$10 |
| Infra | Vercel (Web) | $0 (Hobby) |
| Storage | Cloudflare R2 | ~$5 |
| Cache | Upstash Redis | ~$5 |
| Monitoring | Sentry (Developer) | $0 |
| Domain | .com | ~$1 |
| **Total** | | **~$376/month** |

### 35.2 Hackathon Budget (2 Weeks)

```text
Agora free tier:    10K min/mo        → saves ~$280
Railway credits:    trial             → saves ~$10
OpenAI credits:     trial             → saves ~$30
───────────────────────────────────────────────
Hackathon cost:     ~$56 for 2 weeks
```

### 35.3 Scaling Projections

| Scale | Deals/mo | Monthly Cost | Cost/Deal |
|-------|----------|-------------|-----------|
| MVP | 50 | ~$376 | $7.52 |
| Growth | 500 | ~$1,200 | $2.40 |
| Scale | 5,000 | ~$8,500 | $1.70 |

### 35.4 Cost Optimization Strategies

- **Cache LLM responses** (Redis, 30-40% savings on repeated extractions)
- **Batch risk classification** (process 5-10 segments per call, 20% savings)
- **Pre-classify with rules** (rule engine catches 60%, skip LLM for obvious cases)
- **Agora free tier** (hackathon: 10K free minutes ≈ 167 hrs)

---

## Section 36: Error Recovery & Idempotency Patterns

### 36.1 Idempotency Keys

All escrow operations require idempotency keys to prevent double-execution:

```typescript
function generateIdempotencyKey(
  operation: 'deposit' | 'release' | 'dispute',
  dealId: string,
  retryAttempt: number = 0
): string {
  return `trustroom:${operation}:${dealId}:${Date.now()}:${retryAttempt}`;
}

async function withIdempotency<T>(
  key: string,
  operation: () => Promise<T>,
  ttlMs: number = 300_000
): Promise<T> {
  const existing = await redis.get(`idempotency:${key}`);
  if (existing) return JSON.parse(existing) as T;

  const inProgress = await redis.get(`idempotency:${key}:in_progress`);
  if (inProgress) throw new ConflictError('Operation in progress');

  await redis.set(`idempotency:${key}:in_progress`, '1', 'PX', ttlMs);
  try {
    const result = await operation();
    await redis.set(`idempotency:${key}`, JSON.stringify(result), 'PX', ttlMs);
    return result;
  } finally {
    await redis.del(`idempotency:${key}:in_progress`);
  }
}
```

### 36.2 Retry Strategies

| Service | Max Retries | Backoff | Timeout | Circuit Breaker |
|---------|------------|---------|---------|-----------------|
| PostgreSQL | 3 | Exponential (100ms) | 5s | No (pool) |
| Redis | 3 | Exponential (50ms) | 2s | Yes (5 failures → open 30s) |
| OpenAI | 2 | Exponential (1s) | 30s | Yes (10 failures → open 60s) |
| Agora | 2 | Linear (500ms) | 10s | Yes (5 failures → open 30s) |
| Solana RPC | 3 | Exponential (500ms) | 15s | Yes (3 failures → open 120s) |

### 36.3 Dead Letter Queue (DLQ)

```typescript
// BullMQ DLQ: jobs that fail after maxRetries → moved to DLQ
// DLQ processor runs every 5 minutes, re-enqueues retryable jobs
// Critical queue failures trigger admin alert

const DLQ_CONFIG = {
  maxRetries: 3,
  backoffMs: [60_000, 300_000, 900_000], // 1min, 5min, 15min
  criticalQueues: ['escrow-operations', 'evidence-hash'],
};
```

### 36.4 Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;

  constructor(
    private serviceName: string,
    private config = { failureThreshold: 5, resetTimeoutMs: 30_000 }
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
      } else {
        throw new ServiceUnavailableError(`${this.serviceName} circuit OPEN`);
      }
    }
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  // ... onSuccess/onFailure state transitions
}
```

### 36.5 Transaction Recovery Flow

```text
User Action → Build Tx → Simulate → Send to Solana → Confirm?
                                                     │
                                              Success → Update DB → Done
                                              Failure → Retry (3x max)
                                                         │
                                                    Yes → Re-send with same idempotency key
                                                    No  → DLQ + Alert Admin
```

---

## Section 37: Frontend Enhancements

### 37.1 Responsive Design Strategy

| Breakpoint | Layout | Key Adaptations |
|------------|--------|-----------------|
| `< 768px` (mobile) | Single column, bottom nav | Stacked video + transcript, collapsible panels |
| `768-1024px` (tablet) | Two columns | Side-by-side video + transcript |
| `> 1024px` (desktop) | Three columns | Full: sidebar + video + AI monitor panel |

### 37.2 Loading & Error States Pattern

Every data-dependent component follows:

1. **Loading** → Skeleton placeholder (not spinner)
2. **Error** → ErrorBoundary with retry button
3. **Empty** → EmptyState with CTA
4. **Success** → Render data

### 37.3 Realtime Event Integration

```typescript
// WebSocket → Zustand store → React component re-render
// Pattern: subscribe in hook, update store, component reads store

function useRiskMonitor(dealId: string) {
  const addWarning = useRiskStore(s => s.addWarning);
  const updateScore = useRiskStore(s => s.updateScore);

  useEffect(() => {
    socket.on('risk:warning', (warning) => {
      if (warning.dealId === dealId) addWarning(warning);
    });
    socket.on('risk:score-updated', (update) => {
      if (update.dealId === dealId) updateScore(update.totalScore, update.level);
    });
    return () => { socket.off('risk:warning'); socket.off('risk:score-updated'); };
  }, [dealId]);
}
```

### 37.4 Video Room Layout

```text
┌──────────────────────────────────────────────────────────┐
│  DealHeader: Title | Status Badge | Risk Indicator | Escrow│
├────────────────────────────────────┬─────────────────────┤
│                                    │  DealControlPanel   │
│     VideoPanel (Agora RTC)         │  ├─ DealInfo        │
│     ┌──────────┬──────────┐        │  ├─ EscrowStatus    │
│     │  Remote  │  Local   │        │  ├─ DeliveryProof   │
│     │  Video   │  Video   │        │  └─ TermConfirm     │
│     └──────────┴──────────┘        │                     │
│     RoomControls (mute/cam/end)    ├─────────────────────┤
│                                    │  AIMonitorPanel     │
│                                    │  ├─ RiskIndicator   │
│                                    │  ├─ LatestWarning   │
│                                    │  └─ SuggestedAction │
├────────────────────────────────────┴─────────────────────┤
│  TranscriptPanel (expandable)                             │
│  ├─ TranscriptEntry × N (speaker-labeled, timestamped)   │
│  ├─ RiskEventMarker (inline)                              │
│  └─ TxHashMarker (inline)                                 │
└──────────────────────────────────────────────────────────┘
```

---

*This document is the authoritative technical design for TrustRoom AI MVP. All implementation plans should reference this document for architecture, interfaces, and data models.*
