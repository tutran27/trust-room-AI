---
name: context:all-tests
description: Testing context entrypoint — runner selection, commands, debugging, and AI evaluation strategy.
keywords: tests, testing, vitest, jest, playwright, anchor test, e2e, verification, ci, coverage, scam guard eval
related: []
date: 20-06-26
readWhen: testing, verification, or test debugging
type: reference
---

# TrustRoom AI - All Tests

Last updated: 2026-06-20

Attach this file first when the task involves testing, verification, or test debugging.

This is the fast operator guide for the testing surface:

- which runner to use
- what command to start with
- how to quickly debug common failures
- which deeper file to read next

Do not load the whole `process/context/tests/` folder by default. Start here, then drill down.

---

## Status

> **No test infrastructure exists yet (greenfield, 2026-06-20).** The strategy below is the **planned** target. Update the Commands table with real commands as each package gains a test setup. No `package.json` / runners are on disk yet.

---

## How This File Works

This is the `all-tests.md` entrypoint for the `tests/` context group. Agents read `all-context.md` first and get routed here for testing tasks. As the project grows, add deeper docs (e.g., `escrow-tests.md`, `scam-guard-eval.md`, `e2e-tests.md`) and add routing entries below. This file stays the fast-start entrypoint.

## Quick Routing

(No deeper test docs yet. Add routing entries here as they are created.)

## Quick Decision Guide (planned)

### Use `vitest` (or `jest`) when

- the change is in React components, hooks, stores (`apps/web`) or shared packages (`packages/ui`, `packages/types`, `packages/ai`)
- testing Scam Guard **rules**, the deal-lifecycle **FSM**, risk-score aggregation, term-diffing, or schema validation — these are pure-logic units and should have the densest unit coverage

### Use `anchor test` when

- the change is in the Solana escrow program (`programs/escrow`)
- verifying deposit / release / refund / dispute state transitions and PDA/account constraints on a local validator

### Use Playwright when

- the behavior depends on real navigation, wallet connect, the Deal Room flow, or the full end-to-end demo story (negotiation → scam warning → escrow → evidence)

### Use AI evaluation harness when

- changing prompts/classifiers — measure term-extraction accuracy, scam-detection precision/recall, false-positive/negative rate (technical brief §5.16)

## Default Verification Order

1. run the narrowest existing automated test (unit)
2. unit/integration before browser tests
3. end-to-end only when the real UI/flow is the thing being verified
4. for the escrow program, always run `anchor test` against a local validator before devnet deploy

## Commands

> Placeholder — populate per package once `package.json` and an `Anchor.toml` exist. Expected shape:

| Package | Runner | Command (planned) | Notes |
|---|---|---|---|
| `apps/web` | vitest | `pnpm --filter web test` | jsdom env; mock Agora + Wallet Adapter |
| `apps/api` | jest/vitest | `pnpm --filter api test` | needs test Postgres + `.env.test` |
| `packages/ai` | vitest | `pnpm --filter @trustroom/ai test` | Scam Guard rules, intent fixtures, term schemas |
| `packages/types` | vitest | `pnpm --filter @trustroom/types test` | Zod schema round-trip |
| `programs/escrow` | anchor | `anchor test` | local validator; SPL token setup |
| `apps/web` (e2e) | Playwright | `pnpm --filter web test:e2e` | needs dev server + mock wallet/devnet |
| root | turbo | `pnpm test` | runs all package test tasks via Turborepo |

**Typecheck / lint (verification, not tests):**
```bash
pnpm typecheck      # all packages (planned)
pnpm lint           # all packages (planned)
```

## Debugging Quick Reference (anticipated quirks)

- **Agora in tests:** mock the Agora Web SDK — no real media devices in CI.
- **Wallet Adapter:** mock wallet connect + signing; never use real keys in tests.
- **Solana devnet flakiness:** prefer a local validator (`anchor test` / `solana-test-validator`) for escrow tests; reserve devnet for manual demo verification.
- **API tests:** need a running/test Postgres (Supabase local or PGlite) and `.env.test`.
- **Multilingual fixtures:** Scam Guard test fixtures must include Vietnamese, English, and mixed-language phrases (e.g. "release trước đi rồi tôi gửi file sau").
- **Idempotency:** transaction-endpoint tests should assert duplicate requests with the same idempotency key don't double-deposit/release.

## Known Gaps

- No test infrastructure stood up yet — establish runners alongside the first code in each package.
- AI evaluation harness (precision/recall dashboards) is post-core-MVP; start with a small labeled fixture set for Scam Guard rules.
