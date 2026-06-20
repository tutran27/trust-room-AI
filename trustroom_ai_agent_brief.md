# TrustRoom AI — Agent Brief

> Purpose: This file is a compact, implementation-oriented brief for an AI/software agent to understand the TrustRoom AI project structure, product idea, system modules, MVP scope, and expected behavior.

---

## 1. Project Snapshot

**Project name:** TrustRoom AI  
**Positioning:** AI-supervised escrow room for high-risk P2P deals.  
**Core idea:** Instead of building another P2P exchange, build a secure transaction workspace where buyer and seller negotiate via voice/video, AI observes the deal in realtime, Solana escrow protects funds, and evidence is stored for dispute resolution.

### One-liner

TrustRoom AI helps users conduct safer P2P transactions by combining realtime AI fraud monitoring, structured deal confirmation, Solana escrow, and tamper-evident evidence logging.

### Main pain point

P2P deals between strangers are risky because users can be tricked into releasing funds early, trading outside the platform, accepting fake payment proof, or lacking evidence when disputes happen.

### Primary users

- Web3 users doing OTC token/NFT/digital goods trades.
- Freelancers and clients using crypto milestone payments.
- Small marketplaces needing escrow, trust, and dispute infrastructure.
- Communities where users trade with strangers and need transaction protection.

---

## 2. Product Principles

1. **TrustRoom AI is not a generic Zoom/Meet clone.** The call interface exists only to support safer transaction negotiation.
2. **AI is a risk assistant, not a judge.** AI flags, summarizes, explains, and prepares evidence; humans/users/arbitrators make final decisions.
3. **Escrow protects funds.** Buyer funds are locked in Solana escrow until delivery conditions are satisfied or dispute logic applies.
4. **Evidence is private by default.** Raw transcript/files stay off-chain; only hashes/metadata should be anchored on-chain.
5. **Realtime warnings are the key differentiator.** The system should intervene before a user makes a dangerous action.

---

## 3. Core User Flow

```text
Buyer creates deal
→ Buyer invites seller
→ Both connect Solana wallets
→ System creates escrow
→ Buyer deposits funds
→ Buyer and seller join Agora Deal Room
→ AI observes conversation and extracts terms
→ Scam Guard detects risky behavior in realtime
→ Both parties confirm structured terms by wallet signature
→ Seller submits delivery proof
→ Buyer releases funds OR raises dispute
→ Evidence Vault stores transcript, risk events, terms, tx hashes, and evidence hash
→ Reputation is updated
```

---

## 4. Main System Actors

| Actor | Role |
|---|---|
| Buyer | Creates or joins deal, deposits funds, confirms delivery, releases funds, raises dispute if needed. |
| Seller | Joins deal, negotiates terms, delivers asset/service, submits proof, receives funds after release. |
| AI Observer | Listens to transcript, detects risk, summarizes terms, prepares evidence, suggests next actions. |
| Escrow Contract | Locks funds, handles deposit/release/refund/dispute state. |
| Arbitrator/Admin | Reviews dispute evidence and resolves locked funds when needed. |
| Marketplace/API Client | Optional B2B integrator that creates deal rooms through API. |

---

## 5. MVP Scope

### Must-have modules

1. Website & Deal Room Workspace
2. Wallet Authentication
3. Deal Management
4. Agora Realtime Communication
5. AI Deal Notary
6. Realtime Scam Guard
7. Solana Escrow Smart Contract
8. Evidence Vault basic version

### Nice-to-have for MVP

- Basic Wallet Risk Check
- Basic Reputation Profile
- In-app notifications
- Simple Admin Dispute View

### Out of scope for MVP

- Full deepfake detection
- Full KYC/AML system
- Advanced arbitration marketplace
- Production-grade marketplace API
- Complex fraud ML or graph neural network

---

## 6. Website & Workspace Structure

The website is a **transaction workspace**, not just a landing page.

### 6.1 Landing Page

Purpose: Explain what TrustRoom AI does and why it is safer than informal P2P trading.

Sections:

- Hero: “Secure high-risk P2P deals with AI-supervised negotiation and Solana escrow.”
- Problem: scams, fake proof, off-platform trade, release-before-delivery, no evidence.
- Solution: AI Observer + Solana Escrow + Evidence Vault.
- Use cases: NFT, OTC token, freelance service, domain, digital goods, marketplace trust layer.
- CTA: Start a Deal / Join a Deal / View Demo.

### 6.2 User Dashboard

Shows user’s transaction overview after wallet login.

Components:

- Active deals
- Completed deals
- Disputes
- Escrowed amount
- Reputation score
- Risk alerts
- Button: Create Deal

### 6.3 Create Deal Page

Form fields:

- Deal title
- Deal type: NFT / Token OTC / Freelance / Digital Goods / Domain / Other
- Counterparty wallet or invite link
- Amount
- Token: SOL / USDC / SPL token
- Deadline
- Delivery condition
- Release condition
- Dispute rule
- AI monitoring level: Basic / Standard / Strict

Output:

- Deal ID
- Invite link
- Escrow metadata
- Initial deal summary

### 6.4 Deal Room Workspace

Most important screen.

Recommended layout:

```text
+-------------------------------------------------------------+
| Header: Deal ID | Status | Risk Level | Escrow State         |
+-----------------------------+-------------------------------+
| Video/Voice Room            | Deal Control Panel            |
| - Buyer video/audio         | - Amount/token                |
| - Seller video/audio        | - Buyer/seller wallet         |
| - AI Observer avatar        | - Deposit/Release/Dispute     |
| - Agora connection status   | - Delivery proof action       |
+-----------------------------+-------------------------------+
| AI Monitor Panel                                            |
| - Current risk level                                        |
| - Latest warning                                            |
| - Extracted terms                                           |
| - Suggested action                                          |
+-------------------------------------------------------------+
| Transcript & Evidence Timeline                              |
| - Speaker-separated transcript                              |
| - Timestamps                                                |
| - Risk events                                               |
| - Tx hashes                                                 |
+-------------------------------------------------------------+
```

Key actions:

- Connect Wallet
- Deposit to Escrow
- Confirm Terms
- Submit Delivery Proof
- Release Funds
- Raise Dispute
- Request AI Summary

### 6.5 Evidence Vault Page

Shows post-deal evidence:

- Final terms
- Transcript
- AI summaries
- Risk warnings
- Delivery proof
- Escrow/deposit/release transaction hashes
- Evidence hash
- Export dispute report

### 6.6 Dispute Workspace

Used when a deal enters dispute.

Components:

- Dispute timeline
- Buyer evidence
- Seller evidence
- AI dispute summary
- Confirmed terms
- Risk flags
- Arbitrator decision panel

### 6.7 Reputation Profile

Shows wallet trust profile:

- Completed deals
- Total volume
- Dispute rate
- Refund rate
- On-time delivery rate
- Badges: Trusted Seller, Fast Delivery, No Dispute Streak, Verified Wallet

---

## 7. Module Map

| Module | Role | Key Inputs | Key Outputs | Suggested Tools |
|---|---|---|---|---|
| Website & Workspace | User interface for deal creation, negotiation, escrow, evidence, dispute | User actions, deal state, AI events, tx data | Deal UI, warnings, transcript, controls | Next.js, TypeScript, Tailwind, Shadcn/UI |
| Wallet Auth | Verify identity via Solana wallet | Wallet public key, signed nonce | Auth session, wallet profile, signed confirmations | Solana Wallet Adapter, Phantom, Solflare, @solana/web3.js |
| Deal Management | Manage lifecycle of each deal | Deal form, participants, escrow status | Deal state, invite link, terms object | Node/NestJS, PostgreSQL, Prisma, WebSocket |
| Agora Realtime | Voice/video room + AI participation | Audio/video streams, participants | Realtime room, transcript stream, participant events | Agora RTC SDK, Agora Conversational AI Engine |
| AI Deal Notary | Convert conversation into structured deal terms | Transcript, deal metadata, current terms | Summary, extracted terms, confirmation request | LLM, STT, JSON schema extraction, tool calling |
| Scam Guard | Detect fraud/risk in realtime | Transcript, deal state, wallet risk, evidence | Risk score, warning, risk event | Rules, LLM intent classifier, embeddings, WebSocket |
| Wallet Risk Check | Score counterparty wallet risk | Wallet address, on-chain data, internal history | Low/Medium/High risk + reasons | Solana RPC, Helius, Solscan, internal DB |
| Solana Escrow | Protect funds on-chain | Buyer deposit, terms hash, deal state | Escrow account, deposit/release/refund tx | Rust, Anchor, SPL Token, Solana Devnet |
| Evidence Vault | Store deal proof and audit trail | Transcript, terms, warnings, files, tx hashes | Evidence bundle, evidence hash, report | PostgreSQL, S3/R2/Supabase Storage, SHA-256 |
| Dispute Assistant | Help review disputes | Evidence bundle, transcript, terms | Timeline, summary, suggested resolution | LLM, RAG, PDF/report generator |
| Reputation Passport | Build trust profile per wallet | Completed deals, disputes, volume | Score, badges, public profile | PostgreSQL, score service, optional SBT/NFT |
| Admin/Arbitration | Human review for disputed deals | Dispute evidence, escrow state | Decision, audit log, escrow resolution | Admin dashboard, RBAC, multisig optional |
| Notifications | Notify important events | Deal state changes, warnings | In-app/email alerts | WebSocket, Resend/SendGrid |
| Security & Privacy | Protect data and reduce abuse | Sessions, API calls, evidence, signatures | Access control, audit logs, encrypted storage | RBAC, JWT/cookies, encryption, rate limiting |
| Analytics | Measure product and AI quality | Product events, AI events, tx logs | Dashboards, metrics, error reports | PostHog, Sentry, Prometheus/Grafana |

---

## 8. Deal State Machine

```text
DRAFT
→ CREATED
→ WAITING_FOR_COUNTERPARTY
→ WALLET_VERIFIED
→ ESCROW_CREATED
→ DEPOSITED
→ NEGOTIATING
→ TERMS_CONFIRMED
→ DELIVERY_SUBMITTED
→ READY_TO_RELEASE
→ RELEASED
```

Alternative paths:

```text
DEPOSITED / NEGOTIATING / TERMS_CONFIRMED
→ DISPUTED
→ RESOLVED_RELEASE / RESOLVED_REFUND / RESOLVED_SPLIT

CREATED / WAITING_FOR_COUNTERPARTY
→ CANCELLED

DEPOSITED + timeout/cancel agreement
→ REFUNDED
```

---

## 9. AI Deal Notary

### Role

Acts as a transaction notary inside the Deal Room.

### Tasks

- Listen to transcript from Agora/STT.
- Extract deal terms.
- Detect missing or ambiguous terms.
- Summarize negotiation.
- Ask both sides to confirm terms.
- Generate final structured terms.
- Store terms and summary in Evidence Vault.

### Required extracted fields

```json
{
  "deal_type": "freelance_service | nft | token_otc | digital_goods | domain | other",
  "buyer_wallet": "string",
  "seller_wallet": "string",
  "asset_or_service": "string",
  "amount": "number",
  "token": "SOL | USDC | SPL_TOKEN",
  "deadline": "datetime",
  "delivery_condition": "string",
  "release_condition": "string",
  "refund_condition": "string",
  "dispute_condition": "string",
  "special_terms": ["string"],
  "risk_notes": ["string"]
}
```

### Guardrail

AI must not directly release, refund, punish, or slash funds. It only recommends, warns, summarizes, and prepares evidence.

---

## 10. Realtime Scam Guard

### Role

Detects fraud behavior during live negotiation and warns users before risky actions.

### High-priority scam behaviors

| Behavior | Description | Risk |
|---|---|---|
| Move off-platform | Asking to continue on Telegram/Zalo/WhatsApp/private chat | High |
| Early release request | Asking buyer to release escrow before delivery proof | High/Critical |
| Fake payment proof | Using screenshot/email/SMS/bill as proof and pressuring release | High |
| Credential request | Asking for seed phrase/private key/OTP/password | Critical |
| External wallet | Sending wallet address outside escrow/deal metadata | Critical |
| Time pressure | “Do it now”, “last chance”, “only 5 minutes” | Medium/High |
| Impersonation | Claiming to be support/admin/arbitrator without verified role | High |
| Term change after deposit | Changing price/deadline/release condition after funds are deposited | High |
| Ambiguous terms | Avoiding clear confirmation of price, asset, deadline, release condition | Medium |
| Unverified delivery | Claiming delivery without valid proof | Medium/High |

### Detection techniques

1. **Realtime STT**: Convert Agora audio into speaker-separated transcript.
2. **Rule-based keyword detection**: Fast detection for clear phrases like “release first”, “seed phrase”, “Telegram”.
3. **LLM intent classification**: Classify semantic intent, not just keywords.
4. **Scam playbook similarity**: Compare user message embeddings against known scam patterns.
5. **Deal-state validation**: Check if a requested action is valid in the current deal state.
6. **Wallet address parser**: Detect Solana addresses in transcript/chat and compare with escrow/participant addresses.
7. **Evidence verification**: Verify transaction hash, token amount, receiver, NFT owner, file hash, or delivery proof.
8. **Wallet risk scoring**: Combine on-chain signals and internal reputation.
9. **Sequence detection**: Detect dangerous chains of behavior, e.g. off-platform request → external wallet → early release.

### Risk score model

```text
Final Risk Score =
Conversation Risk
+ Wallet Risk
+ Escrow State Risk
+ Evidence Risk
+ Repetition Penalty
```

Suggested score thresholds:

| Score | Level | Action |
|---:|---|---|
| 0-24 | Low | Log only |
| 25-49 | Medium | Show warning |
| 50-79 | High | Strong warning + require confirmation |
| 80+ | Critical | Lock release temporarily + suggest dispute/human review |

### Example rules

```json
{
  "rule_id": "SCAM_EARLY_RELEASE",
  "trigger": {
    "intent": "early_release_request",
    "deal_state_not_in": ["delivery_verified", "ready_to_release"]
  },
  "risk_level": "high",
  "score": 40,
  "message": "Counterparty is asking to release escrow before delivery is verified."
}
```

```json
{
  "rule_id": "SCAM_EXTERNAL_WALLET",
  "trigger": {
    "detected_wallet_address": true,
    "address_not_in_deal": true
  },
  "risk_level": "critical",
  "score": 80,
  "message": "Detected a wallet address that is not part of the verified deal or escrow."
}
```

---

## 11. AI/Scam Guard Realtime Pipeline

```text
Agora Audio Stream
→ Speech-to-Text
→ Transcript Event
→ Text Normalization
→ Rule Detector
→ LLM Intent Classifier
→ Scam Playbook Similarity Search
→ Deal State Checker
→ Wallet Risk Engine
→ Risk Aggregator
→ WebSocket Warning Event
→ Frontend AI Monitor Panel
→ Evidence Vault
```

---

## 12. Solana Escrow Module

### Role

Protect buyer funds and enforce deal state transitions.

### MVP smart contract functions

```text
initialize_deal
create_escrow
deposit
confirm_terms
submit_delivery
release
refund
raise_dispute
resolve_dispute
```

### On-chain data

Store only minimal, non-sensitive data:

```json
{
  "deal_id_hash": "string",
  "buyer_pubkey": "string",
  "seller_pubkey": "string",
  "token_mint": "string",
  "amount": "number",
  "status": "string",
  "terms_hash": "string",
  "evidence_hash": "string",
  "created_at": "timestamp"
}
```

Do **not** store raw transcript, personal information, raw video, or private files on-chain.

---

## 13. Evidence Vault

### Role

Create a tamper-evident record for dispute review.

### Store off-chain

- Transcript
- AI summaries
- Confirmed terms
- Risk events
- Delivery proof files
- Uploaded screenshots/files
- Buyer/seller confirmations
- Escrow transaction history

### Anchor on-chain

- `terms_hash`
- `evidence_hash`
- important transaction hashes

### Evidence event example

```json
{
  "event_type": "risk_warning",
  "deal_id": "deal_123",
  "timestamp": "2026-06-19T10:05:22Z",
  "speaker": "seller",
  "intent": "early_release_request",
  "risk_level": "high",
  "message": "Seller asked buyer to release escrow before delivery proof."
}
```

---

## 14. Backend Data Model

Suggested database tables:

```text
users
wallets
deals
deal_participants
deal_terms
escrow_transactions
transcripts
ai_summaries
risk_events
evidence_files
disputes
dispute_messages
reputation_scores
notifications
audit_logs
```

### Core entity: Deal

```json
{
  "id": "deal_123",
  "title": "Logo design package",
  "type": "freelance_service",
  "buyer_wallet": "...",
  "seller_wallet": "...",
  "amount": 100,
  "token": "USDC",
  "status": "DEPOSITED",
  "deadline": "2026-06-20T10:00:00Z",
  "terms_hash": "...",
  "evidence_hash": "...",
  "created_at": "datetime"
}
```

### Core entity: RiskEvent

```json
{
  "id": "risk_001",
  "deal_id": "deal_123",
  "speaker_wallet": "...",
  "intent": "early_release_request",
  "risk_level": "high",
  "score": 40,
  "reason": "Seller asked for escrow release before delivery proof.",
  "transcript_snippet": "Release first, I will send the file later.",
  "timestamp": "datetime"
}
```

---

## 15. API Surface for MVP

### Auth

```text
POST /auth/nonce
POST /auth/verify-signature
GET  /auth/session
```

### Deals

```text
POST /deals
GET  /deals
GET  /deals/:id
POST /deals/:id/invite
POST /deals/:id/confirm-terms
POST /deals/:id/submit-delivery
POST /deals/:id/dispute
```

### Agora

```text
POST /agora/token
POST /agora/agent/join
POST /agora/transcript-event
```

### AI

```text
POST /ai/extract-terms
POST /ai/classify-risk
POST /ai/summarize-deal
POST /ai/generate-dispute-report
```

### Escrow

```text
POST /escrow/create
POST /escrow/deposit-tx
POST /escrow/release-tx
POST /escrow/refund-tx
POST /escrow/dispute-tx
GET  /escrow/:dealId/status
```

### Evidence

```text
POST /evidence/event
POST /evidence/file
GET  /evidence/:dealId
POST /evidence/:dealId/anchor-hash
```

---

## 16. Recommended MVP Tech Stack

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- Shadcn/UI or Radix UI
- Solana Wallet Adapter
- Agora Web SDK
- TanStack Query
- Zustand or Redux Toolkit
- WebSocket client

### Backend

- Node.js / NestJS or Express
- PostgreSQL
- Prisma or Drizzle
- Redis/BullMQ for background jobs
- WebSocket or Socket.IO

### AI

- STT: Agora transcript pipeline / Whisper / Deepgram / AssemblyAI
- LLM: GPT / Claude / Gemini / open-source LLM
- Embeddings: OpenAI embeddings / Sentence Transformers
- Vector DB: pgvector / Qdrant / Pinecone
- JSON schema validation: Zod

### Blockchain

- Solana Devnet
- Rust
- Anchor Framework
- SPL Token Program
- @solana/web3.js
- @coral-xyz/anchor
- Phantom/Solflare wallet

### Storage & Infra

- Supabase Storage / Cloudflare R2 / AWS S3
- SHA-256 for evidence hashing
- Vercel/Railway/Render for deployment
- Sentry for error tracking
- PostHog for analytics

---

## 17. Hackathon Demo Script

### Scenario

Buyer wants to buy a design service or NFT for 100 USDC.

### Demo steps

1. Buyer connects wallet.
2. Buyer creates deal: “Logo design package — 100 USDC — delivery in 24h.”
3. Seller joins via invite link and connects wallet.
4. Buyer deposits 100 USDC into Solana escrow.
5. Buyer and seller join Agora Deal Room.
6. AI Observer displays transcript and current deal status.
7. Seller says: “Release first and I will send the file later.”
8. Scam Guard detects `early_release_request` and shows High Risk warning.
9. AI Deal Notary summarizes agreed terms.
10. Both parties confirm terms by wallet signature.
11. Seller submits delivery proof.
12. Buyer releases escrow.
13. Evidence Vault shows transcript, warning, summary, delivery proof, and tx hashes.

### Demo success criteria

- User can see Agora realtime room.
- User can connect Solana wallet.
- Escrow deposit/release works on devnet.
- AI detects a risky phrase in realtime.
- Warning appears in UI.
- Evidence event is stored and displayed.

---

## 18. Implementation Priorities for an Agent

### Priority 1 — Build the visible end-to-end demo

- Create Next.js app.
- Implement wallet connect.
- Implement create deal page.
- Implement Deal Room UI.
- Add Agora voice/video room.
- Add transcript mock or real STT.
- Add Scam Guard rules.
- Add warning popup.
- Implement basic escrow flow on Solana devnet.
- Store evidence events.

### Priority 2 — Make AI useful

- Add LLM term extraction.
- Add LLM intent classification.
- Add structured terms confirmation.
- Add AI summary panel.

### Priority 3 — Add trust layer

- Basic wallet risk score.
- Reputation profile.
- Evidence hash anchoring.
- Basic dispute report.

---

## 19. Non-goals and Warnings

- Do not claim AI can fully prevent fraud.
- Do not let AI release or seize funds automatically.
- Do not store sensitive transcript/video on-chain.
- Do not ask users for seed phrase, private key, OTP, or password.
- Do not position this as a full financial service in MVP.
- Do not prioritize deepfake detection before the basic escrow + scam warning flow works.

---

## 20. Final Product Definition

TrustRoom AI is a secure P2P transaction room where:

- Agora provides realtime voice/video and AI participation.
- AI turns negotiation into structured transaction terms.
- Scam Guard detects fraud behavior before users lose money.
- Solana escrow locks funds until conditions are met.
- Evidence Vault stores proof for disputes.
- Reputation builds long-term trust across wallets.

The MVP should prove one thing clearly:

> A user can enter a live P2P deal, deposit funds into escrow, receive an AI warning when the counterparty behaves suspiciously, confirm clear terms, and safely release or dispute funds with evidence preserved.
