# TrustRoom AI — Agent Technical Brief

> This Markdown is designed for an AI/software Agent that needs to understand the TrustRoom AI idea, modules, technical stack, data flow, fraud-detection techniques, MVP scope, and implementation priorities.

---

## 0. One-sentence Summary

**TrustRoom AI** is an AI-supervised P2P transaction workspace where buyer and seller negotiate in a realtime Agora voice/video Deal Room, AI detects fraud and extracts deal terms, Solana escrow protects funds, and Evidence Vault stores tamper-evident proof for dispute resolution.

---

## 1. Product Positioning

### What it is

TrustRoom AI is an **AI-supervised escrow room for high-risk P2P deals**.

It is not a generic P2P exchange and not a Zoom/Google Meet clone. The meeting/call experience exists only as part of a transaction workspace.

### What problem it solves

P2P deals between strangers are risky because one side can:

- Ask the other side to release funds before delivery.
- Move negotiation/payment outside the platform.
- Send fake payment proof.
- Change deal terms after deposit.
- Use time pressure or impersonation.
- Provide unverified delivery proof.
- Leave the other side without usable evidence for dispute.

### Core value proposition

TrustRoom AI reduces P2P fraud by combining:

1. **Realtime AI monitoring** during negotiation.
2. **Structured deal-term confirmation** extracted from natural conversation.
3. **Solana escrow** to lock funds until conditions are met.
4. **Evidence Vault** for transcripts, warnings, terms, delivery proof, and transaction hashes.

---

## 2. Core Actors

| Actor | Description |
|---|---|
| Buyer | Creates/joins deal, deposits escrow, confirms delivery, releases or disputes funds. |
| Seller | Joins deal, negotiates, delivers asset/service, submits proof, receives funds. |
| AI Observer | Joins the Deal Room, listens to transcript, extracts terms, detects fraud, warns users, creates evidence. |
| Escrow Contract | Solana smart contract that locks funds and handles release/refund/dispute states. |
| Arbitrator/Admin | Human reviewer who resolves disputes using evidence and AI summaries. |
| Marketplace/API Client | Optional B2B integrator that can create Deal Rooms and escrow flows through API. |

---

## 3. High-level User Flow

```text
Buyer creates deal
→ Buyer invites seller
→ Both connect Solana wallets
→ Backend creates deal record
→ Solana escrow is initialized
→ Buyer deposits funds into escrow
→ Buyer and seller join Agora Deal Room
→ AI Observer joins room
→ Audio is converted to transcript
→ AI Deal Notary extracts terms
→ Scam Guard detects risky behavior
→ Both parties confirm structured terms by wallet signature
→ Seller submits delivery proof
→ Buyer releases funds OR raises dispute
→ Evidence Vault stores transcript, warnings, terms, proof, tx hashes, and evidence hash
→ Reputation is updated
```

---

## 4. System Architecture Layers

```text
Frontend / Workspace
  ├─ Landing Page
  ├─ User Dashboard
  ├─ Create Deal Page
  ├─ Deal Room Workspace
  ├─ Evidence Vault Page
  ├─ Dispute Workspace
  └─ Reputation Profile

Realtime Communication Layer
  ├─ Agora RTC voice/video
  ├─ Agora Conversational AI Engine
  ├─ AI Observer participant
  ├─ Audio stream
  ├─ Live transcript
  └─ Participant/room events

AI Layer
  ├─ Speech-to-text
  ├─ Transcript normalization
  ├─ Deal term extraction
  ├─ Scam intent detection
  ├─ Risk scoring
  ├─ RAG safety playbook
  ├─ Dispute summarization
  └─ Evidence reasoning

Backend Layer
  ├─ Auth/session service
  ├─ Deal lifecycle service
  ├─ Agora token service
  ├─ AI orchestration service
  ├─ Escrow sync service
  ├─ Evidence service
  ├─ Dispute service
  ├─ Notification service
  └─ Analytics/evaluation service

Blockchain Layer
  ├─ Solana wallet authentication
  ├─ Solana escrow program
  ├─ SPL token transfer
  ├─ Terms hash
  ├─ Evidence hash anchoring
  └─ Transaction history

Storage Layer
  ├─ PostgreSQL metadata
  ├─ Object storage for files/proofs
  ├─ Redis queue/cache
  ├─ Vector DB / pgvector for RAG
  └─ Audit logs
```

---

## 5. Module-by-module Technical Inventory

## 5.1 Website & User Workspace

### Role

Main user interface. It is a **transaction workspace**, not only a landing page.

### Main screens

1. Landing Page
2. User Dashboard
3. Create Deal Page
4. Deal Room Workspace
5. Evidence Vault Page
6. Dispute Workspace
7. Reputation Profile
8. Admin/Arbitration Dashboard

### Key UI areas inside Deal Room Workspace

```text
┌──────────────────────────────────────────────────────────────┐
│ Header: Deal title, status, wallet identities, risk level     │
├─────────────────────────────┬────────────────────────────────┤
│ Video/Voice Room            │ Deal Control Panel             │
│ - Buyer                     │ - Amount / token               │
│ - Seller                    │ - Escrow state                 │
│ - AI Observer               │ - Deposit / Confirm Terms      │
│ - Mic/camera/leave          │ - Submit Proof / Release       │
│                             │ - Raise Dispute                │
├─────────────────────────────┼────────────────────────────────┤
│ Live Transcript             │ AI Monitor Panel               │
│ - Speaker labels            │ - Risk score                   │
│ - Timestamp                 │ - Scam intent                  │
│ - Flagged statements        │ - AI warning                   │
│ - Tx/proof events           │ - Suggested action             │
└─────────────────────────────┴────────────────────────────────┘
```

### Techniques/tools

| Area | Techniques/tools |
|---|---|
| Web framework | Next.js or React |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI components | Shadcn/UI, Radix UI |
| State management | Zustand, Redux Toolkit |
| Server state | TanStack Query / React Query |
| Realtime updates | WebSocket, Socket.IO |
| Video/voice | Agora Web SDK |
| Wallet | Solana Wallet Adapter |
| Form validation | Zod, React Hook Form |
| UI design | Figma, FigJam |
| Testing | Playwright, Vitest/Jest, Storybook |
| Product analytics | PostHog, Mixpanel |

### MVP implementation notes

- The most important screen is **Deal Room Workspace**.
- Do not overbuild generic meeting features.
- Prioritize escrow status, AI warning, transcript, and release/dispute controls.

---

## 5.2 Wallet Authentication Module

### Role

Authenticate users through Solana wallets and use wallet signatures to confirm identity, terms, and transactions.

### Techniques/tools

| Technique | Purpose |
|---|---|
| Solana Wallet Adapter | Connect Phantom/Solflare/Backpack wallets. |
| Challenge-response nonce | Prove wallet ownership without password. |
| Message signing | Confirm login and deal terms. |
| Transaction signing | Deposit/release/refund actions. |
| JWT or secure session cookie | Maintain authenticated session. |
| Replay protection | Store nonce and expiration. |
| RBAC by wallet role | Buyer/seller/admin permissions per deal. |
| Transaction simulation | Preview risky transactions before signature. |

### Login flow

```text
User clicks Connect Wallet
→ Frontend requests nonce from backend
→ Wallet signs nonce message
→ Backend verifies signature
→ Backend creates session
→ User enters dashboard/deal room
```

### Term confirmation flow

```text
AI extracts structured terms
→ Both users review terms
→ Buyer signs terms hash
→ Seller signs terms hash
→ Backend stores signatures
→ Escrow contract records terms hash or confirms terms state
```

---

## 5.3 Deal Management Module

### Role

Controls the lifecycle of each deal.

### Core technique

Use a **finite-state machine** instead of ad-hoc status changes.

### Suggested deal states

```text
Draft
→ Created
→ WaitingForCounterparty
→ WalletVerified
→ EscrowCreated
→ Deposited
→ Negotiating
→ TermsConfirmed
→ DeliverySubmitted
→ ReadyToRelease
→ Released
```

Exceptional states:

```text
Disputed
Refunded
Cancelled
Expired
```

### Techniques/tools

| Technique | Purpose |
|---|---|
| Finite-state machine | Prevent invalid deal transitions. |
| Idempotency keys | Prevent double deposit/release actions. |
| Event sourcing-lite | Store all deal events for timeline/evidence. |
| Optimistic locking | Avoid race conditions on deal status. |
| Role-based action checks | Buyer and seller can only perform valid actions. |
| WebSocket events | Update UI when state changes. |
| Queue/worker | Sync blockchain transactions and evidence hashing. |

### Example state rules

- `release` is invalid before `DeliverySubmitted` or `ReadyToRelease`.
- `deposit` is valid only after `EscrowCreated`.
- `confirm_terms` requires buyer and seller signatures.
- `raise_dispute` is valid after deposit and before final release/refund.

---

## 5.4 Agora Realtime Communication Module

### Role

Provides the AI-supervised call layer. This is a **Deal Call**, not a generic meeting product.

### Techniques/tools

| Technique/tool | Purpose |
|---|---|
| Agora RTC SDK | Realtime voice/video. |
| Agora Conversational AI Engine | AI agent joins conversation. |
| Agora Token Server | Secure room access. |
| WebRTC | Browser media transport. |
| Agora RTM or WebSocket | Realtime messages/events. |
| Audio stream forwarding | Send conversation audio to STT. |
| Participant tracking | Know who joined/left/spoke. |
| Speaker activity detection | Show active speaker and segment transcript. |
| Optional TTS | AI can speak warnings or summaries. |

### Call pipeline

```text
Frontend requests Agora token
→ Backend checks deal permission
→ Backend returns channel name + token
→ Buyer/seller join Agora channel
→ AI Observer joins channel
→ Audio stream is captured
→ STT produces transcript chunks
→ AI pipeline analyzes transcript
→ Warnings are pushed to UI
→ Transcript/risk events are stored in Evidence Vault
```

### MVP requirement

- Must support buyer/seller joining voice/video.
- Must show AI Observer as a participant or side panel.
- Must generate transcript or simulated transcript for demo.
- Must trigger at least one realtime scam warning.

---

## 5.5 Speech-to-Text and Transcript Processing

### Role

Convert realtime audio into structured transcript usable by AI modules.

### Techniques/tools

| Technique/tool | Purpose |
|---|---|
| STT provider | Deepgram, Whisper, AssemblyAI, Google STT, Azure Speech. |
| VAD | Detect when a user starts/stops speaking. |
| Speaker diarization | Attribute text to buyer/seller. |
| Language detection | Detect Vietnamese/English/mixed language. |
| Text normalization | Normalize token symbols, addresses, amounts, dates. |
| Confidence scoring | Avoid strong decisions from low-confidence transcript. |
| Chunk buffering | Merge partial transcript chunks into meaningful turns. |

### Transcript event schema

```json
{
  "event_type": "transcript.chunk",
  "deal_id": "deal_123",
  "speaker_role": "seller",
  "speaker_wallet": "...",
  "text": "Bạn release trước đi rồi tôi gửi file sau",
  "language": "vi",
  "confidence": 0.91,
  "started_at": "2026-06-19T10:05:21Z",
  "ended_at": "2026-06-19T10:05:25Z"
}
```

---

## 5.6 AI Deal Notary Module

### Role

Extracts deal terms from natural conversation and turns them into structured, confirmable transaction intent.

### Techniques/tools

| Technique | Purpose |
|---|---|
| LLM extraction | Extract buyer/seller, amount, asset, deadline, conditions. |
| JSON schema output | Force structured output and reduce ambiguity. |
| Function/tool calling | Save terms, request confirmation, create summary. |
| Prompt engineering | Define strict role: notary, not judge. |
| Guardrails | Prevent AI from making final legal/financial decisions. |
| Term diffing | Detect changed terms after confirmation/deposit. |
| RAG safety playbook | Use deal-type-specific checklists. |
| Human confirmation gate | Require both parties to sign terms. |

### Terms object schema

```json
{
  "deal_id": "deal_123",
  "deal_type": "freelance_service",
  "buyer_wallet": "buyer_pubkey",
  "seller_wallet": "seller_pubkey",
  "asset_or_service": "Logo design package",
  "amount": "100",
  "token": "USDC",
  "deadline": "2026-06-20T10:00:00Z",
  "delivery_condition": "Seller uploads final logo files",
  "release_condition": "Buyer confirms receipt of files",
  "refund_condition": "Refund if seller misses deadline and no extension is signed",
  "dispute_condition": "Escrow locked if either party raises dispute",
  "confidence": 0.88,
  "missing_fields": [],
  "risk_notes": ["Seller asked for early release once"]
}
```

### Agent constraints

- AI may summarize and warn.
- AI must not autonomously release/refund funds.
- AI must request user signatures for final terms.
- If important fields are missing, AI must ask clarification.

---

## 5.7 Realtime Scam Guard Module

### Role

Detects fraud signals during negotiation and warns users before dangerous actions.

### Fraud behavior categories

| Category | Example | Risk |
|---|---|---|
| Off-platform move | “Qua Telegram/Zalo nói chuyện.” | High |
| Early release request | “Release trước rồi tôi gửi file.” | High/Critical |
| Fake payment proof | “Tôi gửi ảnh bill rồi, cứ release đi.” | High |
| Credential request | “Gửi seed phrase/private key/OTP.” | Critical |
| External wallet address | “Gửi vào ví này thay vì escrow.” | Critical |
| Time pressure | “Nhanh lên, chỉ còn 5 phút.” | Medium/High |
| Impersonation | “Tôi là support/admin.” | High |
| Term change after deposit | “Giờ giá phải là 120 USDC.” | High |
| Ambiguous terms | “Cứ deposit đi rồi tính sau.” | Medium |
| Unverified delivery | “Tôi gửi rồi, release đi.” | Medium/High |

### Detection techniques

| Technique | Description | MVP? |
|---|---|---|
| Keyword/rule matching | Match risky words/phrases. | Yes |
| LLM intent classification | Classify meaning from context. | Yes |
| Semantic similarity | Compare message to known scam patterns using embeddings. | Optional |
| Sequence-based detection | Detect risky sequences across events. | Yes/simple |
| Deal-state validation | Compare requested action with escrow/deal state. | Yes |
| Wallet/address parser | Detect Solana addresses in chat/transcript. | Yes |
| URL/domain scanner | Detect phishing links or suspicious shorteners. | Optional |
| OCR for uploaded proof | Extract text from payment screenshots. | Optional |
| Evidence consistency check | Compare proof with amount/token/wallet/deal ID. | Yes/simple |
| On-chain verification | Verify tx hash, receiver, token, amount. | Yes for crypto proof |
| Risk score aggregation | Combine signals into Low/Medium/High/Critical. | Yes |

### Scam Guard pipeline

```text
Transcript/Event input
→ Text normalization
→ Keyword detector
→ LLM intent classifier
→ Address/link parser
→ Deal-state checker
→ Evidence verifier
→ Wallet risk engine
→ Risk score aggregator
→ Warning generator
→ WebSocket push to frontend
→ Evidence Vault log
```

### Risk scoring example

```text
Final Risk Score =
  conversation_risk
+ wallet_risk
+ escrow_state_risk
+ evidence_risk
+ repetition_penalty
```

Suggested levels:

| Score | Level | Action |
|---:|---|---|
| 0–24 | Low | Log only. |
| 25–49 | Medium | Show warning. |
| 50–79 | High | Strong warning + require confirmation. |
| 80+ | Critical | Temporarily block release or require human review. |

### RiskEvent schema

```json
{
  "event_type": "risk.detected",
  "deal_id": "deal_123",
  "speaker_role": "seller",
  "intent": "early_release_request",
  "risk_level": "high",
  "score_delta": 40,
  "confidence": 0.93,
  "trigger_text": "Bạn release trước đi rồi tôi gửi file sau",
  "reason": "Seller requested escrow release before delivery proof was submitted.",
  "suggested_action": "Do not release funds until delivery proof is verified.",
  "created_at": "2026-06-19T10:05:25Z"
}
```

### MVP rules

```json
[
  {
    "rule_id": "EARLY_RELEASE",
    "intent": "early_release_request",
    "invalid_before_states": ["DeliverySubmitted", "ReadyToRelease"],
    "risk_level": "high",
    "score": 40
  },
  {
    "rule_id": "OFF_PLATFORM",
    "intent": "move_off_platform",
    "risk_level": "high",
    "score": 35
  },
  {
    "rule_id": "CREDENTIAL_REQUEST",
    "keywords": ["seed phrase", "private key", "recovery phrase", "OTP", "mã xác minh"],
    "risk_level": "critical",
    "score": 100
  },
  {
    "rule_id": "EXTERNAL_WALLET",
    "condition": "detected_wallet_address_not_in_deal",
    "risk_level": "critical",
    "score": 80
  },
  {
    "rule_id": "FAKE_PAYMENT_PROOF_PRESSURE",
    "intent": "screenshot_as_payment_proof_and_pressure_to_release",
    "risk_level": "high",
    "score": 40
  }
]
```

---

## 5.8 Wallet Risk Check Module

### Role

Assess counterparty wallet risk before and during the deal.

### Techniques/tools

| Technique/tool | Purpose |
|---|---|
| Solana RPC | Fetch transaction history/basic account data. |
| Helius API | Enhanced Solana account/transaction parsing. |
| Solscan API | Explorer-style history lookup. |
| Birdeye API | Token/market data if needed. |
| Internal reputation DB | Completed deals/disputes/refunds. |
| Feature extraction | Wallet age, tx count, volume, counterparties. |
| Risk scoring rules | Explainable risk level for MVP. |
| Graph analysis | Detect relation to reported wallets. |
| Anomaly detection | Detect unusual flow patterns. |

### Suggested wallet features

```json
{
  "wallet_age_days": 3,
  "tx_count": 5,
  "total_volume_usd": 120,
  "completed_deals": 0,
  "dispute_count": 0,
  "refund_count": 0,
  "counterparty_diversity": 2,
  "linked_reported_wallets": 0,
  "inflow_outflow_velocity": "high",
  "first_seen_at": "2026-06-16T00:00:00Z"
}
```

### Output schema

```json
{
  "wallet": "ABC...",
  "risk_level": "medium",
  "risk_score": 62,
  "reasons": [
    "Wallet created recently",
    "Only 3 transactions found",
    "No completed deals on TrustRoom AI"
  ]
}
```

---

## 5.9 Solana Escrow Smart Contract Module

### Role

Protects funds by locking buyer payment in an escrow account until release/refund/dispute conditions apply.

### Techniques/tools

| Technique/tool | Purpose |
|---|---|
| Rust | Solana program language. |
| Anchor Framework | Program structure, accounts, tests. |
| PDA | Deterministic escrow account per deal. |
| SPL Token Program | USDC/SPL token escrow. |
| @solana/web3.js | Frontend/backend transaction integration. |
| @coral-xyz/anchor | Client interaction with Anchor program. |
| Solana Devnet | Hackathon/demo deployment. |
| Program events | Emit deposit/release/dispute events. |
| Terms hash | Bind signed terms to escrow state. |
| Evidence hash | Anchor proof without exposing sensitive data. |
| Multisig/admin authority | Optional dispute resolution authority. |

### Smart contract functions

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
cancel_or_expire
```

### On-chain data should include

```json
{
  "deal_id_hash": "sha256(deal_id)",
  "buyer": "buyer_pubkey",
  "seller": "seller_pubkey",
  "token_mint": "USDC_mint",
  "amount": "100000000",
  "state": "Deposited",
  "terms_hash": "sha256(canonical_terms_json)",
  "evidence_hash": "sha256(evidence_bundle)",
  "created_at": 1780000000
}
```

### On-chain data should NOT include

- Raw transcript.
- Raw video/audio.
- Private files.
- Personal/private information.
- Seed phrase/private key/OTP.

---

## 5.10 Evidence Vault Module

### Role

Stores tamper-evident evidence for completed or disputed deals.

### Techniques/tools

| Technique/tool | Purpose |
|---|---|
| PostgreSQL | Store metadata, transcript records, risk events. |
| Object storage | Store uploaded files/proofs. AWS S3, Cloudflare R2, Supabase Storage. |
| SHA-256 hashing | Hash transcript/proof/terms. |
| Merkle tree | Optional bundle hash for many evidence items. |
| Encryption at rest | Protect sensitive evidence. |
| Access control | Buyer/seller/arbitrator only. |
| Audit log | Track who viewed/modified/uploaded evidence. |
| Solana hash anchoring | Prove evidence integrity without public raw data. |
| PDF/Markdown export | Generate dispute bundle. |

### Evidence items

- Transcript chunks.
- AI summaries.
- Risk warnings.
- Final signed terms.
- Uploaded delivery proof.
- Transaction hashes.
- Wallet addresses.
- Confirmation signatures.
- Dispute messages.

### EvidenceRecord schema

```json
{
  "evidence_id": "ev_123",
  "deal_id": "deal_123",
  "type": "risk_event",
  "source": "scam_guard",
  "storage_uri": null,
  "content_hash": "sha256(...) ",
  "visibility": "deal_participants_only",
  "created_at": "2026-06-19T10:05:25Z"
}
```

---

## 5.11 Dispute Assistant Module

### Role

Summarizes evidence for human arbitration. AI assists but does not issue final judgment by default.

### Techniques/tools

| Technique | Purpose |
|---|---|
| RAG over Evidence Vault | Retrieve relevant transcript/proof/risk events. |
| Timeline generation | Order deal actions chronologically. |
| Claim extraction | Extract buyer/seller arguments. |
| Evidence summarization | Compress long transcript into reviewable dispute report. |
| Contradiction detection | Compare claims against signed terms and evidence. |
| Human-in-the-loop | Arbitrator makes final decision. |

### Dispute report sections

1. Deal overview.
2. Buyer/seller wallet identities.
3. Escrow status.
4. Final signed terms.
5. Timeline.
6. Buyer evidence.
7. Seller evidence.
8. AI warnings and risk events.
9. Suggested resolution.
10. Arbitrator decision.

---

## 5.12 Reputation Passport Module

### Role

Builds trust history linked to wallet identity.

### Techniques/tools

| Technique/tool | Purpose |
|---|---|
| Reputation scoring | Aggregate trust metrics. |
| Score decay | Older events can matter less over time. |
| Badge engine | Trusted Seller, Fast Delivery, No Dispute Streak. |
| Counterparty rating | Post-deal peer rating. |
| Internal reputation DB | Store reputation metrics. |
| Optional SBT/NFT credential | Portable trust badge in later phase. |
| API response | External marketplace can query reputation. |

### Reputation features

- Completed deals.
- Total volume.
- Average deal value.
- Dispute rate.
- Refund rate.
- Response time.
- Delivery on-time rate.
- Counterparty rating.
- AI risk flags history.

---

## 5.13 Backend API & Database Module

### Role

Orchestrates frontend, Agora, AI, Solana, storage, and notifications.

### Techniques/tools

| Area | Techniques/tools |
|---|---|
| Backend framework | Node.js, NestJS, Express |
| Language | TypeScript |
| DB | PostgreSQL |
| ORM | Prisma, Drizzle |
| Cache/queue | Redis, BullMQ |
| Realtime | WebSocket, Socket.IO |
| API style | REST or GraphQL |
| Validation | Zod, class-validator |
| Deployment | Docker, Vercel, Railway, Render, AWS/GCP |
| Observability | Sentry, logs, metrics |

### Core tables

```text
users
wallets
deals
deal_participants
escrow_transactions
transcripts
ai_summaries
risk_events
evidence_files
disputes
reputation_scores
audit_logs
```

### Important backend patterns

- **Permission checks** for every deal action.
- **Idempotent transaction endpoints** to avoid duplicate blockchain actions.
- **Event-driven architecture** for transcript/risk/evidence pipeline.
- **Background workers** for blockchain sync, evidence hashing, report generation.
- **Structured logs** for debugging demo and production.

---

## 5.14 Notification Module

### Role

Notify users when deal-relevant events happen.

### Techniques/tools

| Channel | Use |
|---|---|
| In-app notification | Main MVP channel. |
| WebSocket popup | Realtime risk warnings. |
| Email | Deal invitation, dispute update. |
| Resend/SendGrid | Email delivery. |
| Discord/Telegram bot | Optional Web3 community integration. |
| Push notification | Later mobile app. |

### Key notification events

- Counterparty joined.
- Escrow deposited.
- AI detected high risk.
- Terms need confirmation.
- Delivery proof submitted.
- Funds released/refunded.
- Dispute opened/resolved.

---

## 5.15 Security, Privacy & Compliance Module

### Role

Protect users, funds, evidence, and sensitive data.

### Techniques/tools

| Technique/tool | Purpose |
|---|---|
| HTTPS/TLS | Secure data transport. |
| JWT/session cookie hardening | Secure session management. |
| Nonce challenge | Prevent wallet login replay. |
| RBAC | Restrict access by role. |
| Rate limiting | Prevent abuse and brute force. |
| Input validation | Zod/schema validation. |
| Secret manager | Protect API keys/private config. |
| Encryption at rest | Protect transcripts/files. |
| PII redaction | Remove sensitive data when generating reports. |
| Audit logging | Trace all critical actions. |
| Smart contract testing/audit | Reduce escrow bugs. |
| Transaction simulation | Warn users before risky signatures. |
| Data minimization | Store only what dispute requires. |

### Hard rules

- Never ask for or store seed phrases/private keys.
- Never store raw video/audio on-chain.
- Never make AI the sole judge for release/refund.
- Keep transcript/evidence private to involved parties and arbitrators.
- Store hashes on-chain, not raw sensitive data.

---

## 5.16 Analytics, Monitoring, and AI Evaluation

### Role

Measure product usage, system reliability, blockchain success, and AI quality.

### Techniques/tools

| Area | Techniques/tools |
|---|---|
| Product analytics | PostHog, Mixpanel |
| Error tracking | Sentry |
| Metrics | Prometheus, Grafana |
| Logs | Datadog, Logtail, OpenTelemetry |
| AI evaluation | Custom eval dashboard |
| Blockchain monitoring | Deposit/release/failure metrics |

### Product metrics

- Number of Deal Rooms created.
- Completion rate.
- Dispute rate.
- Average deal value.
- Repeat users.
- Time to completion.

### AI metrics

- Term extraction accuracy.
- Scam detection precision.
- Scam detection recall.
- False positive rate.
- False negative rate.
- Warning usefulness rating.
- Transcript latency.

### Blockchain metrics

- Deposit success rate.
- Release success rate.
- Refund success rate.
- Failed transaction rate.
- Average confirmation time.

---

## 6. Fraud Detection: Full Technique Matrix

| Fraud behavior | Signals | Detection techniques | Action |
|---|---|---|---|
| Move off-platform | Mentions Telegram/Zalo/WhatsApp, private chat, direct transfer | Keyword rules, LLM intent, semantic similarity | High warning, log risk, remind to stay in Deal Room |
| Early release | “release first”, “confirm first”, “send later” | Keyword rules, LLM intent, deal-state validation | High/Critical warning, require confirmation, optionally lock release |
| Fake payment proof | Screenshot/bill/email used as proof + pressure | Intent classification, OCR, consistency check, payment verification | Warn not to release based on screenshot |
| Credential theft | Seed phrase/private key/OTP/password | Keyword blacklist, PII/credential detector | Critical warning, block message/link if possible |
| External wallet | Address differs from escrow/verified wallet | Solana address parser, metadata comparison | Critical warning, block copy/confirm unless re-signed |
| Time pressure | Hurry/limited-time threats | Keyword, sentiment/pressure classifier | Medium/High warning, cooldown suggestion |
| Impersonation | Claims to be admin/support | Role verification, NER, claim detection | Warn user identity is not verified support |
| Term change after deposit | New price/deadline/asset after signed terms | Term extraction, term diffing, state rule | Require amendment and both signatures |
| Ambiguous terms | Missing amount/deadline/release conditions | Missing field detector, LLM ambiguity detection | Ask clarification before confirmation |
| Unverified delivery | No tx hash/file proof but asks release | Delivery proof validator, on-chain verification | Block/strongly warn before release |
| Suspicious wallet | New wallet, low tx count, linked reports | On-chain features, graph analysis, internal reputation | Show wallet risk and reasons |
| Phishing link | Unknown domain, shortener, fake wallet site | URL parser, domain whitelist/blacklist, safe browsing API optional | Blur link, warn user |

---

## 7. AI Pipeline Details

### 7.1 Realtime AI pipeline

```text
Agora audio
→ STT transcript chunks
→ transcript normalization
→ speaker attribution
→ RuleDetector
→ LLMIntentClassifier
→ ScamPlaybookSimilaritySearch
→ DealStateChecker
→ EvidenceVerifier
→ WalletRiskEngine
→ RiskAggregator
→ WarningGenerator
→ Frontend WebSocket event
→ EvidenceVault log
```

### 7.2 Deal Notary pipeline

```text
Transcript chunks
→ conversation windowing
→ LLM extracts current terms
→ JSON schema validation
→ missing field detection
→ term diff against previous terms
→ AI summary
→ user review
→ buyer/seller sign terms hash
→ store signed final terms
```

### 7.3 Dispute pipeline

```text
Dispute opened
→ Retrieve deal metadata
→ Retrieve transcript + evidence + risk events
→ Generate timeline
→ Extract buyer claim
→ Extract seller claim
→ Compare claims to signed terms
→ Generate AI dispute report
→ Human arbitrator reviews
→ Decision triggers release/refund/split
```

---

## 8. Suggested Backend Event Types

```text
deal.created
deal.joined
wallet.connected
wallet.verified
escrow.initialized
escrow.deposited
call.started
call.participant_joined
call.participant_left
transcript.chunk
terms.extracted
terms.confirmed_by_buyer
terms.confirmed_by_seller
risk.detected
warning.shown
delivery.submitted
evidence.created
evidence.hash_anchored
dispute.opened
dispute.report_generated
dispute.resolved
escrow.released
escrow.refunded
reputation.updated
```

---

## 9. MVP Technical Scope

### Must build

1. **Deal Room Workspace** with call, escrow panel, AI monitor, transcript timeline.
2. **Wallet login** with Solana Wallet Adapter and nonce signature.
3. **Deal lifecycle** with finite states.
4. **Agora voice/video room** by deal ID.
5. **AI transcript + term summary** using STT + LLM.
6. **Scam Guard MVP** using rules + LLM intent classification.
7. **Solana devnet escrow** using Anchor/Rust/SPL token.
8. **Evidence Vault basic** storing transcript, risk events, terms, tx hashes.

### Can simplify

- Wallet Risk Check: only wallet age, tx count, internal completed/disputed deals.
- Reputation: simple score from completed deals/disputes.
- Dispute Assistant: generate report, no complex arbitration.
- Notifications: in-app only.

### Should not build in MVP

- Full deepfake detection.
- Full AML/KYC.
- Complex ML fraud model.
- Advanced marketplace API.
- Full meeting platform.
- Production-grade legal arbitration.

---

## 10. Recommended Repository Structure

```text
trustroom-ai/
  apps/
    web/                    # Next.js frontend
    api/                    # NestJS/Express backend
  packages/
    ui/                     # shared UI components
    types/                  # shared TypeScript types
    ai/                     # prompt templates, classifiers, schemas
    solana/                 # web3 client helpers
  programs/
    escrow/                 # Anchor smart contract
  infra/
    docker/
    scripts/
  docs/
    agent-brief.md
    architecture.md
    api.md
```

---

## 11. Agent Task Breakdown

### Frontend Agent

Build:

- Landing Page.
- Dashboard.
- Create Deal Page.
- Deal Room Workspace.
- AI Monitor Panel.
- Transcript Timeline.
- Escrow Control Panel.
- Evidence Vault Page.

Use:

- Next.js, TypeScript, Tailwind, Shadcn/UI.
- Agora Web SDK.
- Solana Wallet Adapter.
- WebSocket for realtime warnings.

### Backend Agent

Build:

- Auth/session service.
- Deal management API.
- Agora token service.
- WebSocket event server.
- Evidence service.
- Escrow transaction sync.

Use:

- NestJS/Express, PostgreSQL, Prisma, Redis/BullMQ.

### AI Agent

Build:

- STT integration.
- Deal term extractor.
- Scam Guard rules.
- LLM intent classifier.
- Risk aggregator.
- Warning generator.
- Dispute report generator.

Use:

- LLM API, JSON schema, function calling, prompt templates, optional RAG.

### Solana Agent

Build:

- Anchor escrow program.
- Devnet deployment.
- SPL token deposit/release/refund.
- Terms/evidence hash anchoring.
- Client helper functions.

Use:

- Rust, Anchor, @solana/web3.js, @coral-xyz/anchor.

### QA/Infra Agent

Build:

- E2E demo test.
- Unit tests for rules and deal state machine.
- Smart contract tests.
- Docker dev setup.
- Seed data/demo script.

Use:

- Playwright, Vitest/Jest, Anchor tests, Docker.

---

## 12. Demo Script for Hackathon

```text
1. Buyer opens web app and connects wallet.
2. Buyer creates a freelance/logo design deal for 100 USDC.
3. Seller joins with invite link and connects wallet.
4. System initializes Solana devnet escrow.
5. Buyer deposits 100 mock USDC.
6. Both join Agora Deal Room.
7. Seller says: “Bạn release trước đi rồi tôi gửi file sau.”
8. STT creates transcript.
9. Scam Guard detects early_release_request.
10. UI shows High Risk warning.
11. AI Deal Notary summarizes safe terms.
12. Both sign terms.
13. Seller submits file/delivery proof.
14. Buyer releases funds.
15. Evidence Vault shows transcript, warning, summary, tx hashes, evidence hash.
```

---

## 13. Critical Design Decisions

1. **AI is an assistant, not an arbitrator.** It should not directly decide who wins a dispute.
2. **Escrow state gates dangerous actions.** Release should be blocked or strongly warned before delivery proof.
3. **Evidence is off-chain; hashes are on-chain.** This preserves privacy and integrity.
4. **Deal Room Call is transaction-specific.** Do not expand into a general meeting app.
5. **Risk warnings must explain reasons.** Users need understandable alerts, not opaque scores.
6. **MVP should be demo-first.** Build the end-to-end flow over many incomplete advanced features.

---

## 14. Missing/Recommended Additions Beyond Previous Overview

The earlier system overview already covered core modules. To make it more implementation-ready for an Agent, add these missing details:

- Finite-state machine for deal lifecycle.
- Idempotency keys for transaction endpoints.
- Terms hash and evidence hash canonicalization.
- LLM JSON schema validation and guardrails.
- RiskEvent schema and standardized event types.
- Deal-state validation inside Scam Guard.
- Wallet/address parser for detecting external wallets.
- Transaction simulation before signing risky operations.
- Evidence access control and audit log.
- AI evaluation metrics: precision, recall, false positive, false negative.
- Clear separation between MVP, simplified features, and post-MVP features.

---

## 15. Compact Technique Checklist

### Frontend

- Next.js/React
- TypeScript
- Tailwind CSS
- Shadcn/UI/Radix UI
- Zustand/Redux Toolkit
- TanStack Query
- WebSocket/Socket.IO
- Agora Web SDK
- Solana Wallet Adapter
- Zod validation
- Playwright/Vitest/Storybook

### Realtime/Agora

- Agora RTC SDK
- Agora Conversational AI Engine
- Agora Token Server
- WebRTC
- Agora RTM or WebSocket
- Audio stream to STT
- Participant events
- Optional TTS

### AI

- STT: Whisper/Deepgram/AssemblyAI
- VAD
- Speaker diarization
- Transcript normalization
- LLM term extraction
- JSON schema output
- Function/tool calling
- Prompt engineering
- Guardrails
- LLM intent classification
- Rule-based detection
- Semantic similarity with embeddings
- RAG safety playbook
- Risk score aggregation
- Dispute summarization

### Fraud/Risk

- Keyword rules
- Intent classification
- Sequence detection
- State-machine validation
- External wallet detection
- URL/phishing detection
- OCR for screenshots
- On-chain tx verification
- Wallet risk scoring
- Graph analysis
- Anomaly detection
- Explainable risk reasons

### Blockchain/Solana

- Rust
- Anchor Framework
- PDA escrow accounts
- SPL Token Program
- @solana/web3.js
- @coral-xyz/anchor
- Solana Devnet
- Program events
- Terms hash
- Evidence hash anchoring
- Optional multisig arbitration

### Backend/Data

- Node.js/NestJS/Express
- PostgreSQL
- Prisma/Drizzle
- Redis
- BullMQ
- REST/GraphQL
- WebSocket
- Docker
- Object storage: S3/R2/Supabase
- SHA-256/Merkle tree
- Encryption at rest
- Audit logs

### Security/Monitoring

- HTTPS/TLS
- JWT/session cookies
- Nonce challenge
- RBAC
- Rate limiting
- Secret manager
- Input validation
- Transaction simulation
- Sentry
- Prometheus/Grafana
- PostHog/Mixpanel
- OpenTelemetry/logging

---

## 16. Minimum viable data model

### Deal

```json
{
  "id": "deal_123",
  "title": "Logo design package",
  "type": "freelance_service",
  "buyer_wallet": "buyer_pubkey",
  "seller_wallet": "seller_pubkey",
  "amount": "100",
  "token": "USDC",
  "status": "Deposited",
  "terms_hash": "sha256(...) ",
  "evidence_hash": null,
  "created_at": "2026-06-19T10:00:00Z"
}
```

### EscrowTransaction

```json
{
  "id": "escrow_tx_123",
  "deal_id": "deal_123",
  "type": "deposit",
  "signature": "solana_tx_signature",
  "amount": "100",
  "token": "USDC",
  "status": "confirmed",
  "created_at": "2026-06-19T10:02:00Z"
}
```

### TranscriptChunk

```json
{
  "id": "tr_123",
  "deal_id": "deal_123",
  "speaker_role": "seller",
  "speaker_wallet": "seller_pubkey",
  "text": "Bạn release trước đi rồi tôi gửi file sau",
  "confidence": 0.91,
  "created_at": "2026-06-19T10:05:21Z"
}
```

### RiskEvent

```json
{
  "id": "risk_123",
  "deal_id": "deal_123",
  "source_transcript_id": "tr_123",
  "intent": "early_release_request",
  "risk_level": "high",
  "score_delta": 40,
  "reason": "Seller requested release before delivery proof.",
  "suggested_action": "Do not release escrow before delivery proof is verified.",
  "created_at": "2026-06-19T10:05:25Z"
}
```

---

## 17. Final Implementation Priority

For hackathon/demo, build in this order:

1. Deal data model + state machine.
2. Wallet connect + nonce login.
3. Create Deal + invite seller.
4. Solana devnet escrow deposit/release.
5. Agora Deal Room call.
6. Transcript pipeline.
7. Scam Guard: early release + off-platform + external wallet + seed phrase rules.
8. AI Deal Notary term summary.
9. Evidence timeline.
10. Simple dispute report.

If time is limited, fake/simulate only low-risk peripheral parts, but keep the core story real:

```text
Voice/video negotiation → AI detects scam → escrow protects funds → evidence is saved.
```
