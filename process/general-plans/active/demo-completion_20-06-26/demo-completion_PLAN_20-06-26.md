---
name: plan:demo-completion
description: Complete TrustRoom AI to a self-contained demo-able state (frontend + backend wiring + graceful demo-mode fallbacks)
date: 2026-06-20
metadata:
  node_type: plan
  type: plan
  status: active
---

# TrustRoom AI — Demo Completion Plan

## Goal

Make the whole monorepo demo-able end-to-end **without** the user pre-provisioning Groq / Agora / Phantom / a deployed Solana program. Everything is env-driven; when a key is absent the system degrades to a clearly-marked demo mode and upgrades automatically once the env is filled.

## Demo narrative (must work)

Login (demo wallet, no Phantom needed) → Dashboard → Create deal → Deal room: live chat composer drives the **Scam Guard AI monitor** (deterministic, no LLM key needed) → escrow deposit/release (simulated devnet) → confirm terms → raise dispute + attach evidence. Realtime updates over WebSocket.

## Demo-mode principles (apply everywhere)

1. **Env-driven, never crash on missing key.** Read all secrets/URLs from env; fall back gracefully.
2. **AI**: Groq-first (OpenAI-compatible base URL), then OpenAI, then **deterministic heuristic fallback**. Scam Guard rules already deterministic — they are the always-on risk engine. Term extraction/summaries/dispute analysis get keyword/heuristic fallbacks.
3. **Agora**: deal room shows a placeholder call panel + a manual chat/transcript composer that feeds Scam Guard when `NEXT_PUBLIC_AGORA_APP_ID` is absent. Token endpoint returns a marked demo token.
4. **Solana escrow**: program not deployed → API runs **simulated escrow** (persist status transitions + synthetic tx signatures). Frontend shows a "devnet-simulated" badge.
5. **Wallet**: built-in demo wallet (generated keypair in localStorage) so the nonce/sign/verify auth flow works without Phantom; detect `window.solana` (Phantom) when present.
6. **DB**: Postgres via `infra/docker` compose; `prisma db push` + seed; documented in README.

## Waves (disjoint blast radii)

- **W1 packages/ai** — Groq provider + heuristic fallbacks; export `runRules`/`aggregateRisk`.
- **W1 packages/types** — reconcile escrow enum with Prisma; add request payload schemas.
- **W1 packages/ui** — Card, Input, Select, Textarea, Badge, Modal, Spinner, Alert, Avatar, Tabs.
- **W2 apps/api** — graceful env; simulated escrow + DTO fix; wire WebSocket emissions + notifications + reputation + AI into deals/disputes/escrow; WS auth; scam-guard chat ingestion endpoint/event.
- **W3 apps/web foundation** — deps; QueryProvider, AuthProvider (demo wallet), WebSocketProvider; api-client; hooks.
- **W4 apps/web pages** — login, dashboard, create deal, deal detail, deal room (call + chat + AI monitor + terms + escrow), disputes list/detail + evidence.
- **W5 integration** — typecheck/build/test green; dev + db scripts; seed; .env.example; demo README.

## Verification

`pnpm typecheck` (all green), `pnpm build`, `pnpm test`; API boots; web builds; manual flow walk-through documented in README.
