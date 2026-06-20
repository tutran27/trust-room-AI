---
name: context:all-context
description: Root context router for TrustRoom AI — architecture, target stack, conventions, domain schemas, routing.
keywords: trustroom, architecture, stack, overview, routing, escrow, scam guard, deal room, solana, agora, evidence, deal lifecycle, nestjs, prisma, groq, qdrant
related: [context:all-planning, context:all-tests]
date: 20-06-26
type: reference
---
# TrustRoom AI - All Context

Last updated: 2026-06-20

This file is the root context entrypoint for the repo.

Use it for two things:

1. quick routing to the right context pack or root file
2. broad architecture and repository understanding

Start here before loading deeper context files.

---

## What TrustRoom AI Is

**TrustRoom AI is an AI-supervised escrow room for high-risk P2P deals.**

Instead of building another P2P exchange, TrustRoom AI is a secure transaction workspace where a buyer and seller negotiate over realtime Agora voice/video, an AI Observer watches the deal live, a Solana escrow protects the funds, and tamper-evident evidence is preserved for dispute resolution.

It is **not** a generic Zoom/Meet clone — the call interface exists only to support safer transaction negotiation.

**The MVP must prove one thing clearly:** a user can enter a live P2P deal, deposit funds into escrow, receive an AI warning when the counterparty behaves suspiciously, confirm clear terms, and safely release or dispute funds with evidence preserved.

### The four pillars

1. **Realtime AI monitoring** during negotiation (Scam Guard).
2. **Structured deal-term confirmation** extracted from natural conversation (AI Deal Notary).
3. **Solana escrow** to lock funds until conditions are met.
4. **Evidence Vault** for transcripts, warnings, terms, delivery proof, and transaction hashes.

### Primary users

- Web3 users doing OTC token / NFT / digital-goods trades.
- Freelancers and clients using crypto milestone payments.
- Small marketplaces needing escrow, trust, and dispute infrastructure.
- Communities where users trade with strangers and need transaction protection.

### Core product principles (design guardrails)

- **AI is a risk assistant, not a judge.** It flags, summarizes, explains, and prepares evidence; humans/arbitrators make final decisions. AI must never autonomously release, refund, or slash funds.
- **Escrow protects funds.** Buyer funds are locked in Solana escrow until delivery conditions are satisfied or dispute logic applies.
- **Evidence is private by default.** Raw transcript/files stay off-chain; only hashes/metadata are anchored on-chain.
- **Realtime warnings are the key differentiator.** The system should intervene *before* a user makes a dangerous action.
- **Demo-first MVP.** Build the end-to-end flow before advanced features.

---

## Project Status

> **Monorepo scaffolded (2026-06-20).** The pnpm + Turborepo workspace is in place and verified: `pnpm install`, `pnpm typecheck` (7/7), `pnpm build` (5/5 incl. Next.js production build), and `pnpm test` (Scam Guard unit tests) all pass; the NestJS API boots and serves `GET /api/health`. What exists is foundation/skeleton, not feature-complete modules — most domain logic (wallet auth, deals, Agora, AI orchestration, evidence) is still to be implemented. The Solana escrow program is a **hand-written skeleton** that cannot be built here (no Rust/Anchor toolchain installed — see `programs/escrow/README.md`). Context groups and feature folders will be created as each domain's code grows (see "Planned Context Groups & Feature Areas").

Source briefs (authoritative product/technical spec):

- `trustroom_ai_agent_brief.md` — product brief: flow, modules, MVP scope, demo script.
- `trustroom_ai_agent_technical_brief.md` — technical brief: per-module tech inventory, schemas, pipelines, data model.

---

## How This File Works (the `all-*.md` Convention)

Every `process/context/` directory has one `all-*.md` entrypoint that acts as an attachable quick router for that domain. This root file (`all-context.md`) is the top-level router. Context groups each have their own `all-{group}.md` entrypoint.

**How agents use it:**

1. Agent reads `all-context.md` first (this file)
2. Finds the relevant context group from the routing tables below
3. Reads that group's `all-{group}.md` entrypoint
4. Only then loads the specific deep doc needed

This layered routing keeps context windows small. Never load the whole `process/context/` tree.

---

## Quick Start

For most substantial tasks:

1. read this file first
2. choose the smallest relevant root file or context group from the tables below
3. only then load deeper files

---

## Current Root Entry Points

<!-- The two tables below (Root Entry Points + Context Groups) are GENERATED from each
     context doc's frontmatter by `discover-context.mjs --emit-routing`. Do NOT hand-edit
     between the GENERATED markers — your edits will be overwritten on the next rebuild.
     To change a row, edit the owning doc's frontmatter (description / keywords) and re-emit.
     `--check-routing` fails lint if this block drifts from the frontmatter on disk. -->

<!-- GENERATED:routing -->
| File | Read when |
|---|---|
| `process/context/all-context.md` | any substantial planning, research, review, or implementation task |

## Current Context Groups

| Group | Entry point | Scope |
|---|---|---|
| (no groups yet — populated during STUDY phase, then regenerated by `--emit-routing`) | | |
<!-- /GENERATED:routing -->

## Task Routing Table

| If the task involves... | Start with | Then load |
|---|---|---|
| architecture or stack questions | this file | the relevant section below |
| product scope / MVP / demo | this file | `trustroom_ai_agent_brief.md` |
| module internals, schemas, pipelines | this file | `trustroom_ai_agent_technical_brief.md` |
| testing or verification | `process/context/tests/all-tests.md` | the specific test doc |
| creating a new plan | `process/context/planning/all-planning.md` | the relevant example PRD |
| frontend / Deal Room UI | this file (Frontend section) | brief §6, technical brief §5.1 |
| backend / API / deal lifecycle | this file (Backend section) | technical brief §5.3, §5.13 |
| AI Notary / Scam Guard | this file (AI Layer section) | technical brief §5.6, §5.7, §7 |
| Solana escrow program | this file (Blockchain section) | technical brief §5.9, §12 |
| evidence / disputes | this file | technical brief §5.10, §5.11 |

---

## Repository Structure

### Current (on disk — pnpm + Turborepo monorepo)

```
TrustRoomAI/
  package.json              -- workspace root (turbo scripts, packageManager pnpm@11.8.0)
  pnpm-workspace.yaml       -- workspaces: apps/*, packages/*  (+ allowBuilds)
  turbo.json                -- build/dev/lint/typecheck/test tasks
  tsconfig.base.json        -- shared TS compiler options
  .env.example              -- env var groups (auth, db, supabase, redis, qdrant, groq, agora, solana)
  apps/
    web/                    # Next.js 15 (App Router) + Tailwind — landing page; @trustroom/ui + types wired
    api/                    # NestJS 10 — health module; tsx dev, tsc build, ConfigModule
  packages/
    types/                  # Zod schemas: DealStatus FSM + transitions, Deal, ExtractedTerms, RiskEvent, events
    ai/                     # Scam Guard rules catalog (VI/EN) + detect/aggregate + vitest tests
    solana/                 # @solana/web3.js + Anchor client helpers (connection, escrow PDA, address check)
    ui/                     # shared React components (cn + Button), Tailwind
  programs/
    escrow/                 # Anchor (Rust) escrow program — SKELETON, not yet buildable here
  infra/
    docker/                 # docker-compose: Postgres, Redis, Qdrant
  process/                  # agent harness (context, plans, features, protocols)
  .claude/ .codex/ .agents/ # agent + skill surfaces
  trustroom_ai_agent_brief.md / trustroom_ai_agent_technical_brief.md  -- source briefs
  CLAUDE.md / AGENTS.md     -- managed protocol files (do not edit)
```

Workspace packages are consumed as **TypeScript source** (no pre-build); `@trustroom/*` import specifiers use `.js` extensions (ESM convention) — Next resolves these via `extensionAlias` in `apps/web/next.config.mjs`.

---

## Technology Stack

> Agreed target stack. Versions to be pinned in `package.json` when scaffolded — use the latest stable of each at scaffold time.

- **Monorepo:** pnpm workspaces + Turborepo (build/task orchestration + caching)
- **Language:** TypeScript throughout (Rust for the Solana program)
- **Frontend (`apps/web`):** Next.js (App Router) · Tailwind CSS · shadcn/ui (Radix) · TanStack Query (server state) · Zustand (client state) · React Hook Form + Zod · WebSocket client for realtime warnings
- **Realtime:** Agora Web/RTC SDK (voice/video) · Agora Conversational AI Engine (AI Observer participant) · Agora Token Server · **Agora built-in STT pipeline** for transcripts
- **Backend (`apps/api`):** **NestJS** · WebSocket/Socket.IO · Redis + BullMQ (background workers: blockchain sync, evidence hashing, report generation) · REST API · Zod / class-validator
- **Database:** **PostgreSQL via Supabase** + **Prisma** ORM
- **Vector / RAG:** **Qdrant** (scam-playbook similarity) · **bge-m3** embeddings (BAAI, multilingual — important for VI/EN/mixed transcripts)
- **LLM:** **Groq API** (fast inference) for term extraction, intent classification, summaries, dispute reports. Design the AI layer behind a provider interface; Groq does not serve embeddings, so embeddings come from bge-m3 separately.
- **Blockchain:** Solana **Devnet** · Rust · **Anchor** framework · SPL Token Program · PDA escrow accounts · `@solana/web3.js` · `@coral-xyz/anchor` · Phantom/Solflare/Backpack via Solana Wallet Adapter
- **Storage:** **Supabase Storage** for evidence files · SHA-256 (optional Merkle bundle) for evidence/terms hashing · encryption at rest
- **Deployment:** **Vercel** (web) · **Railway** (api) · Docker for local dev
- **Observability:** Sentry (errors) · PostHog (product analytics) · structured logs/metrics
- **Testing:** Vitest/Jest (unit) · Playwright (e2e) · Anchor tests (escrow program) · Storybook (optional)

---

## Key Patterns and Conventions

**Deal lifecycle = finite-state machine (FSM).** Never use ad-hoc status changes. Canonical states:

```
Draft → Created → WaitingForCounterparty → WalletVerified → EscrowCreated
→ Deposited → Negotiating → TermsConfirmed → DeliverySubmitted → ReadyToRelease → Released
```
Exceptional: `Disputed`, `Refunded`, `Cancelled`, `Expired`.
Resolution: `Disputed → ResolvedRelease | ResolvedRefund | ResolvedSplit`.

Example state rules: `release` invalid before `DeliverySubmitted`/`ReadyToRelease`; `deposit` valid only after `EscrowCreated`; `confirm_terms` requires both buyer + seller signatures; `raise_dispute` valid after deposit and before final release/refund.

**Escrow state gates dangerous actions.** Release is blocked or strongly warned before delivery proof exists. This is the core safety invariant.

**Wallet signatures are the source of truth.** Nonce challenge-response for login (replay-protected); message signing to confirm terms (both parties sign the terms hash); transaction signing for deposit/release/refund.

**AI guardrails.** The AI summarizes, warns, extracts terms, and prepares evidence only. It must never autonomously release/refund/slash funds, and must request user signatures for final terms. If important term fields are missing, it asks for clarification.

**Risk scoring is additive and explainable.** `Final Risk Score = conversation_risk + wallet_risk + escrow_state_risk + evidence_risk + repetition_penalty`. Levels: 0–24 Low (log), 25–49 Medium (warn), 50–79 High (strong warn + confirm), 80+ Critical (block release / human review). Warnings must explain reasons, not show opaque scores.

**Scam Guard = layered detection.** Rule/keyword match → LLM intent classification → embedding playbook similarity (Qdrant/bge-m3) → deal-state validation → wallet/address parser → evidence verifier → wallet risk → risk aggregator → WebSocket warning → Evidence Vault log.

**Privacy: off-chain data, on-chain hashes.** Store only `deal_id_hash`, pubkeys, token mint, amount, state, `terms_hash`, `evidence_hash`, timestamps on-chain. Never put raw transcript, video/audio, private files, PII, or credentials on-chain.

**Backend reliability.** Permission checks on every deal action · idempotency keys on transaction endpoints (prevent double deposit/release) · event-sourcing-lite for the deal timeline · optimistic locking on deal status · background workers for chain sync and hashing.

**Canonical event types** (see technical brief §8): `deal.created`, `escrow.deposited`, `transcript.chunk`, `terms.extracted`, `terms.confirmed_by_{buyer,seller}`, `risk.detected`, `warning.shown`, `delivery.submitted`, `evidence.created`, `evidence.hash_anchored`, `dispute.opened`, `escrow.released`, `escrow.refunded`, `reputation.updated`, etc.

**Multilingual by design.** Transcripts are Vietnamese / English / mixed. STT language detection + bge-m3 (multilingual) embeddings + Scam Guard rules/intents must handle VI phrasing (e.g. "release trước đi rồi tôi gửi file sau" = early-release request).

**Hard security rules.** Never ask for or store seed phrase / private key / OTP / password. Never store raw media on-chain. Never make AI the sole judge of release/refund. Keep evidence private to participants + arbitrators.

---

## Core Domain Schemas (quick reference)

**Extracted deal terms** (AI Deal Notary output): `deal_type`, `buyer_wallet`, `seller_wallet`, `asset_or_service`, `amount`, `token` (SOL|USDC|SPL), `deadline`, `delivery_condition`, `release_condition`, `refund_condition`, `dispute_condition`, `special_terms[]`, `confidence`, `missing_fields[]`, `risk_notes[]`. (technical brief §5.6)

**RiskEvent:** `deal_id`, `speaker_role`, `intent`, `risk_level`, `score_delta`, `confidence`, `trigger_text`, `reason`, `suggested_action`, `created_at`. (technical brief §5.7)

**On-chain escrow data:** `deal_id_hash`, `buyer`, `seller`, `token_mint`, `amount`, `state`, `terms_hash`, `evidence_hash`, `created_at`. (technical brief §5.9)

**Escrow program functions:** `initialize_deal`, `create_escrow`, `deposit`, `confirm_terms`, `submit_delivery`, `release`, `refund`, `raise_dispute`, `resolve_dispute`, `cancel_or_expire`.

**Suggested DB tables:** `users`, `wallets`, `deals`, `deal_participants`, `deal_terms`, `escrow_transactions`, `transcripts`, `ai_summaries`, `risk_events`, `evidence_files`, `disputes`, `dispute_messages`, `reputation_scores`, `notifications`, `audit_logs`.

---

## MVP Scope

**Must build (demo-first, in priority order — technical brief §17):**

1. Deal data model + FSM
2. Wallet connect + nonce login
3. Create Deal + invite seller
4. Solana devnet escrow deposit/release
5. Agora Deal Room call
6. Transcript pipeline (Agora STT)
7. Scam Guard MVP: early-release + off-platform + external-wallet + seed-phrase rules + LLM intent
8. AI Deal Notary term summary
9. Evidence timeline (transcript, risk events, terms, tx hashes)
10. Simple dispute report

**Can simplify for MVP:** wallet risk check (wallet age + tx count + internal deal history only) · reputation (simple score from completed/disputed) · dispute assistant (report only, no arbitration engine) · notifications (in-app only).

**Out of scope for MVP:** full deepfake detection · full KYC/AML · complex ML/graph fraud models · production marketplace API · full meeting platform · production-grade legal arbitration.

---

## Planned Context Groups & Feature Areas

These will be created as the corresponding code is implemented (harness rule: create a group/feature folder once a domain has real, substantial content — ~3+ source files).

**Likely context groups (`process/context/{group}/`):**

- `database/` — Prisma schema, the 15+ table data model, migration workflow
- `escrow/` — Anchor program design, PDA layout, terms/evidence hash canonicalization, devnet deploy
- `scam-guard/` — rules catalog, risk-scoring model, intent taxonomy, playbook embeddings
- `agora/` — RTC token flow, AI Observer join, STT transcript pipeline
- `infra/` — Docker/local services, Vercel/Railway deploy, Supabase config
- `auth/` — wallet nonce flow, session/JWT, RBAC-by-deal-role

**Likely feature folders (`process/features/{feature}/`):**

- `deal-lifecycle` · `deal-room-workspace` · `solana-escrow` · `ai-deal-notary` · `scam-guard` · `evidence-vault` · `dispute-workspace` · `reputation-passport` · `wallet-auth`

---

## Context Group Lifecycle

Create a group when: a topic has 3+ durable docs; a single doc exceeds ~800 lines with separable subtopics; multiple agents repeatedly need one slice of a large file; or the topic maps to a stable operational domain (tests, infra, database, auth, escrow, scam-guard).

Do not create a group for: temporary reports; plans/execution artifacts; or feature-specific content (that belongs in `process/features/...`).

Move/split one group at a time. Use `all-{group}.md` entrypoints. Run the `vc-audit-context` skill after every context organization change.

## Context Update Protocol

1. update the smallest relevant context file
2. update this file if routing, ownership, naming, or groups changed
3. update the owning `all-{group}.md` entrypoint when a group exists
4. run `vc-audit-context`

---

## Scan Metadata

- Generated: 2026-06-20
- HEAD: git initialized, no commits yet
- Mode: fresh (Flow A) + monorepo scaffold
- Package manager: pnpm@11.8.0 (via corepack, user-local shim)
- Node: 24.16.0 (engines >=20); Rust/Solana/Anchor toolchain NOT installed
- Setup: vc-setup v3.2.0
