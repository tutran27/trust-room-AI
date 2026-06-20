---
name: plan:api-foundation-auth-deals
description: "Hoan thien API foundation dang do: Prisma/PostgreSQL, wallet nonce auth, Deals CRUD + FSM, va verification"
date: 20-06-26
type: plan
feature: general
phase: PLAN
---

# API Foundation, Wallet Auth và Deal Lifecycle

**Date**: 20-06-26  
**Complexity**: COMPLEX — standard complex, một luồng thực thi tuần tự  
**Status**: 🔨 CODE DONE một phần — chưa có phase nào được ✅ VERIFIED  
**Selected execute anchor**: `process/general-plans/active/api-foundation-auth-deals_20-06-26/api-foundation-auth-deals_PLAN_20-06-26.md`

## Overview

Hoàn thiện milestone backend đang dở theo đúng thứ tự phụ thuộc: bảo toàn và xác nhận phần CJS đã có, hoàn thiện nền tảng Prisma/PostgreSQL, xây wallet nonce authentication, xây Deals CRUD với finite-state machine (FSM), rồi chạy verification toàn monorepo. Plan này chỉ bao phủ `packages/types`, `packages/db`, `apps/api` và cấu hình trực tiếp cần thiết; Solana escrow, Agora, AI Notary, Scam Guard realtime và Evidence Vault chỉ được ghi ở Future Work, không thuộc blast radius EXECUTE hiện tại.

## Quick Links

- [Context and Goals](#1-context-and-goals)
- [Current Status](#2-current-status)
- [Architecture Decisions](#5-architecture-decisions-final)
- [Public Contracts](#public-contracts)
- [Phased Delivery Plan](#13-phased-delivery-plan)
- [RFCs](#14-rfcs-strict-sequential-order)
- [Acceptance Criteria](#16-acceptance-criteria)
- [Verification Evidence](#verification-evidence)
- [Resume and Execution Handoff](#resume-and-execution-handoff)

## 1. Context and Goals

### Goal

Cung cấp một API foundation chạy được với PostgreSQL thật, đăng nhập bằng chữ ký ví Solana chống replay, và deal lifecycle có phân quyền + optimistic locking + audit timeline. Kết quả phải đủ ổn định để phase sau nối frontend wallet/create-deal mà không phải đổi lại contract nền tảng.

### Context đã đọc

- `process/context/all-context.md`
- `process/context/tests/all-tests.md`
- `process/context/planning/all-planning.md`
- `process/development-protocols/implementation-standards.md`
- `process/development-protocols/plan-lifecycle.md`
- `trustroom_ai_agent_brief.md` (§8, §14, §15, §18)
- `trustroom_ai_agent_technical_brief.md` (§5.2, §5.3, §5.13, §5.15, §8, §9, §11–14)
- Source hiện tại trong `packages/types`, `packages/db`, `apps/api`; `git status` và `git diff`.

### Success metrics

- API boot với database module thật và shutdown sạch.
- Nonce chỉ dùng đúng một lần, hết hạn đúng hạn và bị ràng buộc domain + wallet.
- Mọi deal read/write đều có auth và participant authorization.
- Không endpoint nào cho client gửi arbitrary target status.
- Hai transition đồng thời với cùng version chỉ có một transition thành công.
- Migration áp dụng được trên PostgreSQL sạch; integration tests chứng minh dữ liệu và audit event cùng transaction.
- `typecheck`, `build`, test scoped và recursive monorepo đều xanh; user thực hiện manual flow và xác nhận trước khi đánh dấu VERIFIED.

## 2. Current Status

| Work item | Trạng thái trung thực | Bằng chứng hiện có | Còn thiếu |
|---|---|---|---|
| `packages/types` CJS dist | 🔨 CODE DONE | Build và runtime `require` đã pass trong RESEARCH | Chưa có user confirmation; cần regression gate |
| `packages/db` schema + generated client | 🔨 CODE DONE một phần | Prisma schema valid, package build pass | Schema invariants, migration, generated policy, Nest database adapter |
| Wallet nonce auth | ⏳ PLANNED | Dependencies đã thêm | Module/controller/service/guard/tests/config |
| Deals CRUD + FSM | ⏳ PLANNED | Canonical `DealStatus`, `DEAL_TRANSITIONS` đã có | Module/API/authz/locking/events/tests |
| Tests + final verify | 🧪 TESTING một phần | Typecheck/build pass; 4 Scam Guard tests pass | API đang 0 tests; chưa có DB integration/manual flow |

Worktree hiện ở branch `main`, có 9 entry dirty; mọi thay đổi sẵn có được xem là công việc của user và phải được bảo toàn. Không reset, checkout hay rewrite ngoài phạm vi.

### Plan Revision Note — 20-06-26

Nguồn: VALIDATE V4 verdict **BLOCKED**, user chọn `Return to PLAN`. Revision này khóa các thay đổi P1–P11: verify request mang raw nonce để server hash/constant-time compare; global exception filter; env schema; Decimal/cursor/invite/event contracts; clean-generation order; throttler feasibility probe; advisory reachability gate; và evidence pack 5 artifacts. Plan vẫn chưa VERIFIED; `Validate Contract` tiếp tục là placeholder do `vc-validate-agent` sở hữu.

## 3. Phase Completion Rules

Một phase KHÔNG hoàn tất cho đến khi đủ:

1. **Integration Test** — chạy cùng các mảnh hệ thống liên quan.
2. **Manual Test** — user thực hiện được flow thực.
3. **Data Verification** — kiểm tra trực tiếp state trong PostgreSQL.
4. **Error Handling** — failure paths trả lỗi ổn định, không để partial write.
5. **User Confirmation** — user xác nhận “hoạt động”.

Status meanings:

- ⏳ PLANNED — chưa bắt đầu.
- 🔨 CODE DONE — code đã viết nhưng chưa E2E.
- 🧪 TESTING — đang kiểm tra.
- ✅ VERIFIED — đã test đầy đủ VÀ user xác nhận.
- 🚧 BLOCKED — có blocker.

Sau mỗi phase phải ghi lại:

- [ ] Manual test đã chạy.
- [ ] Query/result xác minh DB đã lưu.
- [ ] Lỗi gặp phải và cách xử lý.
- [ ] User confirmation đã nhận.

## 4. Scope, Non-Goals and Constraints

### In scope

- CJS packaging regression cho `@trustroom/types` và `@trustroom/db`.
- Prisma schema, migration đầu tiên, client generation policy.
- NestJS `PrismaService`/`DatabaseModule` đặt trong `apps/api`.
- Global validation, configuration validation, CORS allowlist và request size baseline.
- Wallet nonce auth bằng Ed25519/Solana signature + short-lived JWT Bearer.
- Deals CRUD logic, invite seller, named FSM actions, RBAC theo participant, version locking và `DealEvent` timeline.
- Unit, integration, API/e2e, schema parity và monorepo verification.

### Out of scope

- Frontend wallet adapter/login/create-deal UI.
- Refresh token, OAuth, MFA và session revocation service.
- Solana escrow transactions hoặc transaction signing.
- Terms signatures, delivery proof, disputes implementation đầy đủ.
- Agora, STT, realtime WebSocket, AI Notary, Scam Guard expansion, Evidence Vault.
- Nâng cấp major toàn bộ NestJS/toolchain chỉ để triage advisory không liên quan đường chạy hiện tại.

### Constraints

- Không phá hoặc ghi đè 9 entry dirty sẵn có.
- `packages/db` phải framework-neutral; không thêm NestJS dependency vào package này.
- PostgreSQL là nguồn kiểm chứng integration; SQLite/mock không được thay thế proof về transaction/constraints.
- API amount nhận/trả string; DB lưu `Decimal`, không dùng JS float cho giá trị tài chính.
- `@trustroom/types` là canonical FSM; Prisma enum phải có parity test.
- Chưa được EXECUTE khi `Validate Contract` còn placeholder.

## 5. Architecture Decisions (Final)

### AD-001 — Tách Prisma client khỏi Nest adapter

**Decision:** `packages/db` chỉ chứa Prisma schema/generated export. `PrismaService` và global `DatabaseModule` nằm ở `apps/api/src/database/`.

**Rationale:** giữ shared package dùng được ngoài Nest, tránh coupling framework và vòng build. `PrismaService` extends `PrismaClient`, connect ở `OnModuleInit`, disconnect ở `OnModuleDestroy`; không tạo client mới trong feature service.

### AD-002 — Generated Prisma client không commit

**Decision:** thêm `/packages/db/generated/` vào `.gitignore`; `generate`, `build`, `typecheck`, migration và CI tạo lại client. Commit schema + migrations, không commit binary query engine.

**Implication:** clean checkout phải chạy `corepack pnpm --filter @trustroom/db generate` hoặc build trước khi API build.

### AD-003 — Participant là nguồn sự thật duy nhất

**Decision:** bỏ `buyerWallet`/`sellerWallet` khỏi `Deal`; dùng `DealParticipant`. Constraints bắt buộc:

- `@@unique([dealId, role])`: tối đa một buyer và một seller.
- `@@unique([dealId, wallet])`: một wallet không thể giữ hai role trong cùng deal.
- buyer participant được tạo atomically cùng Deal; seller có thể thêm sau qua invite.

Read model trả `buyerWallet`/`sellerWallet` bằng cách derive từ participants để giữ API dễ dùng, không lưu hai bản dữ liệu.

### AD-004 — Optimistic locking + event-sourcing-lite trong cùng transaction

**Decision:** `Deal.version Int @default(0)`. Mọi mutation nhận `expectedVersion`; update dùng `updateMany` với `{id, version, status}` và increment version. Nếu count = 0 trả `409 DEAL_VERSION_CONFLICT`. `DealEvent` được insert trong cùng Prisma transaction; không có trạng thái đổi mà thiếu timeline event.

### AD-005 — Action-driven API, không arbitrary status

**Decision:** public transition endpoint nhận `action` thuộc server enum, không nhận `toStatus`. Mapping MVP:

| Action | From → To | Preconditions |
|---|---|---|
| `publish` | Draft → Created | buyer; fields hợp lệ |
| `open-invitation` | Created → WaitingForCounterparty | buyer |
| `verify-wallets` | WaitingForCounterparty → WalletVerified | buyer hoặc seller; đủ 2 participants và cả hai wallet đã đăng nhập ít nhất một lần |
| `cancel` | trạng thái canonical cho phép → Cancelled | buyer; không qua final/funded state |

Service nội bộ vẫn kiểm tra `canTransition` từ `@trustroom/types`. Các action escrow/delivery/dispute tương lai sẽ gọi cùng transition primitive nhưng chưa được expose trong milestone này.

### AD-006 — Wallet nonce challenge canonical và atomic consume

**Decision:** challenge dùng 32 bytes CSPRNG, TTL mặc định 300 giây, DB chỉ lưu SHA-256 `nonceHash`, không lưu raw nonce. `/auth/nonce` trả `{ challengeId, nonce, message, expiresAt }`; client giữ raw nonce và gửi lại khi verify. Raw nonce không được log, ghi event hay persist ngoài response/client memory. Message UTF-8 canonical:

```text
TrustRoom AI authentication
Domain: {AUTH_DOMAIN}
URI: {AUTH_URI}
Wallet: {base58_public_key}
Nonce: {base64url_nonce}
Issued At: {ISO-8601 UTC}
Expiration Time: {ISO-8601 UTC}
```

Verify request là `{ challengeId, walletAddress, nonce, signature }`. Backend hash raw nonce client gửi, so sánh `nonceHash` bằng constant-time comparison, rồi dựng lại message từ raw nonce + các field immutable trong record (`wallet`, `domain`, `uri`, `issuedAt`, `expiresAt`). Sau đó decode base58 wallet/signature và verify Ed25519 bằng `tweetnacl`. Invalid hash hoặc signature **không consume** challenge. Chỉ sau khi cả hash và signature hợp lệ, transaction `updateMany` consume record có `usedAt = null`, đúng wallet/domain và `expiresAt > now`; count khác 1 là replay/expired. Cùng transaction đó upsert User + Wallet; JWT chỉ phát sau commit.

### AD-007 — JWT Bearer ngắn hạn cho milestone

**Decision:** JWT access token TTL mặc định 900 giây, `sub=userId`, `wallet`, `iss=trustroom-ai`, `aud=trustroom-api`; ký bằng secret tối thiểu 32 bytes. Không đặt token trong query string, không log token/signature/nonce. Refresh token nằm ngoài scope.

### AD-008 — Soft delete giữ audit

**Decision:** `DELETE /deals/:id` là logical delete bằng FSM `cancel`, chỉ khi canonical transition cho phép. Không hard-delete deal/event qua API.

### AD-009 — Validation và stable error contract

**Decision:** global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`; DTO có giới hạn độ dài/range. Error response có `statusCode`, stable `code`, `message`; không trả stack/Prisma details ở production.

### AD-010 — Global exception filter và error mapping

**Decision:** một global exception filter chuẩn hóa mọi response lỗi thành `{ statusCode, code, message, requestId }`. Mapping bắt buộc:

- DTO/pipe → `400 VALIDATION_FAILED`.
- Opaque cursor decode/schema fail → `400 INVALID_CURSOR`.
- Prisma `P2002` → `409 RESOURCE_CONFLICT`, trừ khi service đã map sang domain code như `PARTICIPANT_CONFLICT`.
- Prisma `P2025` → `404 RESOURCE_NOT_FOUND` hoặc `DEAL_NOT_FOUND` theo service boundary.
- JWT missing/invalid/expired → `401 AUTH_INVALID` hoặc `AUTH_EXPIRED`.
- Throttler rejection → `429 RATE_LIMITED`.
- Unknown error → `500 INTERNAL_ERROR`; log có requestId nhưng không có secret/token/signature/raw nonce trong response.

### AD-011 — Exact environment contract

| Variable | Rule | Default |
|---|---|---|
| `AUTH_DOMAIN` | hostname không rỗng; production bắt buộc | `localhost` chỉ development/test |
| `AUTH_URI` | absolute `http(s)` URI; production bắt buộc HTTPS | `http://localhost:3000` chỉ development/test |
| `AUTH_NONCE_TTL_SECONDS` | integer 60–900 | `300` |
| `JWT_SECRET` | UTF-8 tối thiểu 32 bytes; luôn required, test inject fixture riêng | none |
| `JWT_TTL_SECONDS` | integer 300–3600 | `900` |
| `CORS_ORIGINS` | comma-separated absolute origins; wildcard bị cấm | `http://localhost:3000` chỉ development/test |
| `JSON_BODY_LIMIT` | `^[1-9]\d*(kb|mb)$`, parse case-insensitive, tối đa `1mb` | `32kb` |

Config validation fail-fast trước `app.listen`; `.env.example` phải phản ánh đúng tên/range/default trên.

### AD-012 — Decimal input/output contract

`amount` là canonical positive decimal string, không exponent, dấu `+/-`, NaN, Infinity hay JS number. Regex lexical: `^(?:0|[1-9]\d{0,19})(?:\.\d{1,18})?$`, sau đó numeric check `> 0`. Tối đa 20 chữ số nguyên + 18 chữ số thập phân, tương thích `Decimal(38,18)`. Response serialize canonical string: không leading zero thừa, bỏ trailing fractional zero và dấu chấm rỗng; không convert qua float.

### AD-013 — Cursor pagination deterministic

List order cố định `(updatedAt DESC, id DESC)`. Opaque cursor là base64url của JSON `{ "updatedAt": "ISO-8601 UTC", "id": "cuid" }`; server decode + schema validate, lỗi trả `400 INVALID_CURSOR`. Query trang sau dùng `(updatedAt < cursor.updatedAt) OR (updatedAt = cursor.updatedAt AND id < cursor.id)`. `limit` integer 1–50, default 20.

### AD-014 — Invite semantics

Invite MVP chỉ **add seller khi seller role chưa tồn tại**, không replace. Seller wallet trùng buyer → `409 PARTICIPANT_CONFLICT`; invite lặp cùng hoặc khác seller khi role đã có → `409 SELLER_ALREADY_INVITED`. Không xóa participant để “sửa” invite trong milestone này.

### AD-015 — Action-to-event vocabulary

| Operation/action | Event type |
|---|---|
| create | `deal.created` |
| Draft update | `deal.updated` |
| invite seller | `deal.seller_invited` |
| publish | `deal.published` |
| open-invitation | `deal.invitation_opened` |
| verify-wallets | `wallet.verified` |
| cancel / DELETE | `deal.cancelled` |

Các value còn thiếu phải được thêm vào canonical `DealEvent` ở `packages/types/src/events.ts`; API và DB event writer không dùng string tùy ý ngoài vocabulary này.

### AD-016 — Clean generation/build order

Proof phải bắt đầu từ trạng thái không có `packages/db/generated/` và `packages/db/dist/`: generate DB → build DB → build types nếu cần dependency order → build/test API. API không được pass vì generated artifacts cũ còn trên máy.

## 6. High-level Data Flow

```text
POST /auth/nonce
  → validate Solana address → create hashed challenge → return challengeId + raw nonce + canonical message
Wallet signs exact bytes
POST /auth/verify-signature
  → hash submitted nonce → constant-time compare → reconstruct → verify Ed25519
  → atomic consume → upsert identity → JWT
Bearer JWT
  → JwtAuthGuard → request.auth { userId, wallet }
  → DealsService authorization by DealParticipant
  → validate action + expectedVersion
  → transaction: conditional Deal update + DealEvent insert
  → sanitized read model
```

## 7. Security Posture and Abuse Cases

Kết quả `vc-security` read-only scan: không thấy hardcoded secret trong scope nguồn; `pnpm audit` hiện báo 1 critical dev-tool advisory, 6 high và 12 moderate trên toàn workspace. Critical nằm ở Vitest UI/dev tooling; high production paths chủ yếu là dependency gián tiếp của Nest platform (`multer`) và config (`lodash`).

### Mandatory controls

- Rate limit `POST /auth/nonce` theo IP + wallet và `verify-signature` theo IP + challenge; dùng `@nestjs/throttler` hoặc adapter repo-approved trong VALIDATE.
- CORS không dùng wildcard ngoài local development; `CORS_ORIGINS` là allowlist.
- Giới hạn JSON body (ví dụ 32 KiB cho milestone này).
- Wallet address phải decode đúng 32 bytes; signature đúng 64 bytes.
- Thông báo verify failure không phân biệt challenge tồn tại/đã dùng/sai chữ ký để giảm oracle.
- List deals bắt buộc participant filter và pagination tối đa 50.
- Detail/update/action kiểm tra participant; mutation nhạy cảm kiểm tra buyer role.
- Event metadata không chứa JWT, signature, raw nonce hoặc secret.
- Global exception filter áp dụng mapping tại AD-010; không lộ Prisma code/stack.
- Throttler phải qua pre-execute feasibility probe trên NestJS 10 + CommonJS, gồm custom key IP+wallet cho nonce và IP+challenge cho verify. Probe phải dựa trên official docs/source qua `vc-docs-seeker`; không bịa method/decorator API. Verdict khác `VIABLE` là hard stop quay lại PLAN.
- Audit gate phải phân loại reachability theo runtime/dev, route đang expose và code path thực tế. Production release bị block nếu còn Critical/High reachable trên scoped API runtime. Dev-only findings được ghi rõ và dev UI/server không bind public interface. Không major-upgrade âm thầm; nếu fix đòi major upgrade, STOP quay PLAN.

### Scenario priorities từ `vc-scenario`

| Severity | Scenario | Expected behavior |
|---|---|---|
| Critical | Replay cùng challenge đồng thời | đúng 1 verify thành công; request còn lại 401 |
| Critical | Nonce gửi lại không hash-match record | 401; challenge vẫn chưa consume |
| Critical | Wallet A ký challenge của wallet B | 401, không consume challenge |
| Critical | Non-participant đoán deal ID | 404 hoặc 403 nhất quán, không lộ payload |
| Critical | Hai action cùng expectedVersion | một commit, một 409, đúng một event |
| High | Invite buyer wallet làm seller | 409 participant-role conflict |
| High | Expired nonce hoặc JWT | 401 stable error |
| High | Client gửi field `status` trong PATCH | 400 vì forbidden field |
| High | DB fail giữa status update và event insert | rollback cả hai |
| Medium | List với limit cực lớn/cursor sai | clamp/reject; không unbounded query |

### High-risk evidence pack — auto-stop before finalize

Primary risk class: **auth or identity**. Secondary classes trong cùng work description: schema/data migration, public API/external contract, permission/trust-boundary logic. Trước finalize, push hoặc human handoff, task folder phải có:

1. `harness/risk-gate.json` — risk classification, approver, `mustStopBeforeFinalize: true`.
2. `harness/context-snippets.json` — exact file:line snippets cho auth/schema/API/RBAC surfaces.
3. `harness/verification.json` — happy + failure/boundary results; không ghi secret/raw nonce.
4. `harness/review-decision.json` — explicit `APPROVE` hoặc `REJECT`, rationale, ISO timestamp.
5. `harness/adversarial-validation.json` — replay, wrong-wallet, IDOR, privilege escalation, race, malformed cursor/amount và error leakage.

Thiếu bất kỳ artifact nào hoặc decision không phải APPROVE thì status vẫn chưa proven; không finalize/handoff. Pack được validate bằng `.claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs`.

## 8. Component Details

### `packages/db`

- Prisma enums/models, migration history và client generation scripts.
- Không chứa Nest decorators/services.
- Schema thêm `Deal.version`, `DealEvent`; sửa participant uniqueness và amount Decimal.

### `apps/api/src/database`

- `PrismaService`: một connection lifecycle.
- `DatabaseModule`: global export cho feature modules.

### `apps/api/src/auth`

- DTOs, `AuthController`, `AuthService`, JWT strategy/guard, auth principal decorator/type.
- Challenge issue/verify, identity upsert, session introspection.

### `apps/api/src/deals`

- DTOs, controller, service, action mapping, serialization/read model.
- Tất cả query/mutation scope theo authenticated wallet.

## 9. Database Schema Contract

Các field chính sau khi hoàn thiện:

```prisma
model AuthNonce {
  id         String   @id @default(cuid())
  wallet     String
  nonceHash  String   @unique
  domain     String
  uri        String
  issuedAt   DateTime
  expiresAt  DateTime
  usedAt     DateTime?
  createdAt  DateTime @default(now())
  @@index([wallet, expiresAt])
}

model Deal {
  id           String     @id @default(cuid())
  title        String
  type         DealType
  amount       Decimal    @db.Decimal(38, 18)
  token        Token
  status       DealStatus @default(Draft)
  version      Int        @default(0)
  deadline     DateTime?
  termsHash    String?
  evidenceHash String?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  participants DealParticipant[]
  events       DealEvent[]
  @@index([status, updatedAt])
}

model DealParticipant {
  id        String          @id @default(cuid())
  dealId    String
  wallet    String
  role      ParticipantRole
  createdAt DateTime        @default(now())
  @@unique([dealId, role])
  @@unique([dealId, wallet])
  @@index([wallet, dealId])
}

model DealEvent {
  id          String      @id @default(cuid())
  dealId      String
  type        String
  fromStatus  DealStatus?
  toStatus    DealStatus?
  actorWallet String?
  version     Int
  metadata    Json?
  createdAt   DateTime    @default(now())
  @@index([dealId, createdAt])
}
```

Migration phải được tạo bằng Prisma CLI, review SQL trước khi apply. Vì đây là initial local foundation, không dùng `db push` làm bằng chứng release. Migration directory được commit; generated client không commit.

## Public Contracts

### Auth REST contract

| Method | Route | Auth | Request | Success |
|---|---|---|---|---|
| POST | `/api/auth/nonce` | Public, rate-limited | `{ walletAddress }` | `201 { challengeId, nonce, message, expiresAt }`; raw nonce chỉ trả response, không log/persist |
| POST | `/api/auth/verify-signature` | Public, rate-limited | `{ challengeId, walletAddress, nonce, signature }` | `200 { accessToken, tokenType: "Bearer", expiresIn, user }` |
| GET | `/api/auth/session` | Bearer | none | `200 { userId, walletAddress }` |

### Deals REST contract

| Method | Route | Role | Contract |
|---|---|---|---|
| POST | `/api/deals` | authenticated wallet → buyer | Create Draft; optional seller wallet; create buyer participant + event atomically |
| GET | `/api/deals` | participant | `(updatedAt DESC, id DESC)`; opaque base64url cursor; `limit` 1–50/default 20; optional status/role filter |
| GET | `/api/deals/:id` | participant | Deal read model + participants + version; không trả private event metadata |
| PATCH | `/api/deals/:id` | buyer, Draft only | Mutable fields only; requires `expectedVersion`; client cannot send status |
| DELETE | `/api/deals/:id` | buyer | Soft cancel through FSM; requires `expectedVersion` |
| POST | `/api/deals/:id/invite` | buyer | Chỉ add seller khi role chưa có; không replace; same-as-buyer/duplicate trả stable 409 |
| POST | `/api/deals/:id/actions/:action` | role per action | Named action only; requires `expectedVersion` |

### Shared type contracts

- `DealStatus` và `DEAL_TRANSITIONS` tiếp tục là canonical.
- Add/align API DTO response types only if reused cross-package; Nest-specific DTO stays trong `apps/api`.
- Deal read model trả `amount` dưới dạng canonical positive Decimal(38,18) string theo AD-012, timestamps ISO-8601 UTC và `version` integer.
- Mọi mutation ghi đúng event vocabulary AD-015; shared `DealEvent` phải đồng bộ trước API build.

### Stable errors

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_FAILED` / `INVALID_DEAL_ACTION` | malformed input hoặc action không hợp lệ |
| 400 | `INVALID_CURSOR` | opaque cursor decode/schema không hợp lệ |
| 401 | `AUTH_INVALID` / `AUTH_EXPIRED` | challenge/JWT không hợp lệ |
| 403 | `DEAL_FORBIDDEN` | đã auth nhưng thiếu role |
| 404 | `DEAL_NOT_FOUND` | resource không tồn tại/không visible theo policy |
| 409 | `DEAL_VERSION_CONFLICT` / `PARTICIPANT_CONFLICT` / `SELLER_ALREADY_INVITED` | race hoặc uniqueness/invite conflict |
| 429 | `RATE_LIMITED` | abuse control |

## Blast Radius

### Expected touchpoints count

Khoảng 25–35 source/test/config/migration files trong 3 package chính; risk class **HIGH** vì có auth + schema + access control, nhưng không có fund movement.

### In-scope runtime/packages

- `packages/types/**`
- `packages/db/**` trừ generated output được ignore
- `apps/api/**`
- `.gitignore`, `.env.example`, `pnpm-lock.yaml`, có thể `package.json`/`pnpm-workspace.yaml` nếu dependency/config trực tiếp cần thiết
- PostgreSQL local service trong `infra/docker/docker-compose.yml` chỉ đọc; chỉ sửa nếu test DB không thể provision bằng command độc lập

### Explicitly excluded blast radius

- `apps/web/**`, `packages/solana/**`, `packages/ai/**` business logic
- `programs/escrow/**`
- Agora/Redis/Qdrant runtime
- Process/harness ngoài task folder; riêng 5 evidence artifacts trong task-folder `harness/` là bắt buộc

## 12. Execution Brief

### Phase 0–1: Preserve baseline + database foundation

**What happens:** snapshot dirty files, xác nhận CJS, quyết định generated policy, hoàn thiện schema/migration và Nest database lifecycle.  
**Integration points:** types ↔ Prisma enum; Prisma ↔ Nest AppModule; PostgreSQL thật.  
**Test:** clean generate/build; migration trên DB sạch; connect/query/shutdown.  
**Verify:** query constraints, columns, migration table và client singleton.  
**Done when:** DB foundation chạy và user xác nhận trước auth.

### Phase 2: Wallet nonce auth

**What happens:** issue/verify challenge, atomic consume, user/wallet upsert, JWT guard/session.  
**Integration points:** AuthNonce/User/Wallet ↔ JWT ↔ Nest guard.  
**Test:** valid signature, nonce hash mismatch, wrong signer, expiry, replay và concurrent replay.  
**Verify:** usedAt chỉ set một lần; wallet identity tồn tại; token claims đúng.  
**Done when:** throttler feasibility probe đạt VIABLE; manual wallet-key fixture đăng nhập và protected session hoạt động.

### Phase 3: Deals CRUD + FSM

**What happens:** authorized CRUD, seller invite, named actions, optimistic lock và timeline event.  
**Integration points:** JWT principal ↔ participant RBAC ↔ canonical FSM ↔ Prisma transaction.  
**Test:** happy path, IDOR, invalid transitions, uniqueness, concurrency, rollback.  
**Verify:** Deal version/status và DealEvent nhất quán trong DB.  
**Done when:** hai test wallets hoàn thành flow Draft → WalletVerified và user xác nhận.

### Phase 4: Final verification

**What happens:** chạy scoped + recursive gates, manual smoke, audit dependencies và ghi known gaps.  
**Test:** schema validate, typecheck, build, tests, API smoke, DB state inspection.  
**Done when:** mọi acceptance criterion có evidence; không claim VERIFIED chỉ vì build pass.

### Expected Outcome

- API foundation có migration và lifecycle ổn định.
- Wallet signature auth chống replay.
- Deal CRUD/FSM có authorization, locking và audit.
- Một handoff rõ ràng cho frontend wallet/create-deal tiếp theo.

## 13. Phased Delivery Plan

| Phase | Status | Dependency | Green proves |
|---|---|---|---|
| P0 Preserve + baseline | 🔨 CODE DONE một phần | none | thay đổi user được bảo toàn; CJS không regress |
| P1 Database foundation | 🔨 CODE DONE một phần | P0 | schema/migration/Nest DB chạy trên Postgres |
| P2 Wallet auth | ⏳ PLANNED | P1 ✅ VERIFIED | ownership proof và replay protection đúng |
| P3 Deals CRUD + FSM | ⏳ PLANNED | P2 ✅ VERIFIED | authz/FSM/locking/audit đúng |
| P4 Final verification | 🧪 TESTING một phần | P1–P3 | milestone có evidence end-to-end |

Không chuyển phase khi phase trước chưa ✅ VERIFIED. Mỗi phase bắt đầu bằng research delta và dừng xin user approval nếu phát hiện contract/architecture khác plan.

## 14. RFCs (STRICT sequential order)

### RFC-001 — Preserve current work and baseline

**Dependencies:** none.  
**Acceptance links:** AC-01, AC-02, AC-16.

#### Stage 0 — Pre-Phase Research

1. Ghi `git status --short`, `git diff --stat`, danh sách untracked; tuyệt đối không reset.
2. So sánh current source với plan; nếu dirty overlap mâu thuẫn, STOP báo user.
3. Xác nhận PATH issue: dùng `corepack pnpm`, không sửa source để “chữa” pnpm shim.
4. Present findings và **STOP**, chờ user duyệt trước implementation.

#### Implementation Checklist

- [ ] Chạy scoped build/runtime import cho `@trustroom/types` và `@trustroom/db`.
- [ ] Từ trạng thái không có DB `generated/`/`dist`, chạy exact order: DB generate → DB build → types build → API build; không dựa artifact cũ.
- [ ] Thêm regression test/parity check cần thiết mà không đổi canonical FSM ngoài contract.
- [ ] Ghi baseline test evidence và giữ trạng thái 🔨 CODE DONE cho đến user confirmation.

#### Post-Phase Testing

- `corepack pnpm --filter @trustroom/types build`
- `corepack pnpm --filter @trustroom/db build`
- Node CommonJS `require()` cả hai dist entrypoints.
- Pass criteria: exports tồn tại, không module-resolution error, dirty files không bị mất.

### RFC-002 — Database foundation

**Dependencies:** RFC-001 verified.  
**Acceptance links:** AC-03, AC-04, AC-05, AC-06.

#### Stage 0 — Pre-Phase Research

1. Re-read schema/generated policy/AppModule và migration state.
2. Kiểm tra PostgreSQL local health và DATABASE_URL không in secret.
3. Present exact SQL/schema delta và **STOP** xin approval.

#### Implementation Checklist

- [ ] Sửa Prisma schema theo §9; giữ enum parity với shared types.
- [ ] Thêm `.gitignore` cho `packages/db/generated/`; không xóa file user ngoài generated output.
- [ ] Tạo/review migration `api_foundation` bằng Prisma; commit migration SQL.
- [ ] Tạo `apps/api/src/database/prisma.service.ts` và `database.module.ts`.
- [ ] Wire `DatabaseModule` vào `AppModule`.
- [ ] Bổ sung config validation cho database/auth essentials và global ValidationPipe.
- [ ] Implement global exception filter + stable mapping AD-010.
- [ ] Viết schema parity, lifecycle và PostgreSQL integration tests.

#### Test Procedure and Verification Queries

1. `corepack pnpm --filter @trustroom/db exec prisma validate`.
2. Apply migrations trên disposable PostgreSQL port 55432 bằng `prisma migrate deploy` theo §20.
3. Query `information_schema`/Prisma để xác nhận unique constraints, Decimal, version, event table.
4. Boot API, thực hiện `SELECT 1`, shutdown; không connection leak.
5. Pass: migration idempotent trên DB đã migrate; generated output tái tạo được từ clean state.

#### Rollback

- Không hand-edit migration đã apply.
- Nếu lỗi trước khi shared: sửa migration và reset **chỉ DB test/local sau explicit approval**.
- Nếu đã shared: tạo forward migration khôi phục compatibility; rollback app chỉ sau khi schema vẫn backward-compatible.

### RFC-003 — Wallet nonce authentication

**Dependencies:** RFC-002 verified.  
**Acceptance links:** AC-07, AC-08, AC-09, AC-10, AC-17.

#### Stage 0 — Pre-Phase Research

1. Xác nhận exact import behavior của `bs58`, `tweetnacl`, `@nestjs/jwt` trong CJS build.
2. Dùng `vc-docs-seeker` đọc official docs/source và chạy feasibility probe cho throttler NestJS 10/CJS với custom key IP+wallet/IP+challenge; không bịa API method.
3. Nếu verdict không `VIABLE`, hard stop quay PLAN; không implement workaround ngầm.
4. Xác nhận env schema/range/default tại AD-011.
5. Present challenge bytes + token claims và **STOP** xin approval.

#### Implementation Checklist

- [ ] Tạo Auth DTOs với base58/length validation.
- [ ] Tạo challenge CSPRNG; response có raw nonce/message; DB chỉ hash-at-rest; cấm log raw nonce.
- [ ] Verify request có nonce: hash + constant-time compare trước canonical message/signature verification.
- [ ] Invalid nonce hash/signature không consume; atomic consume + identity upsert chỉ sau verify hợp lệ.
- [ ] Implement JWT module/service/guard/principal và `/auth/session`.
- [ ] Thêm rate limiting theo feasibility result, CORS allowlist, JSON body limit và safe logging đúng AD-011.
- [ ] Viết unit tests cho message builder/signature/claims.
- [ ] Viết PostgreSQL/API integration tests cho issue → verify → session, expiry, replay và concurrent replay.

#### Post-Phase Testing

- Dùng deterministic test keypairs từ `tweetnacl.sign.keyPair()`; không commit private production key.
- Test exact UTF-8 bytes; altered nonce/domain/URI/wallet/timestamp phải fail và challenge không consume.
- Query `AuthNonce.usedAt`, `User`, `Wallet` sau success/failure.
- Pass: một challenge không thể tạo hai session; invalid signature không tạo identity.

#### Rollback

- Disable AuthModule route registration nếu runtime issue; DB additions được giữ backward-compatible.
- Rotate test/dev JWT secret nếu vô tình lộ; production secret không bao giờ được ghi vào repo/log.

### RFC-004 — Deals CRUD, invite and FSM actions

**Dependencies:** RFC-003 verified.  
**Acceptance links:** AC-11, AC-12, AC-13, AC-14.

#### Stage 0 — Pre-Phase Research

1. Reconcile all `DEAL_TRANSITIONS` với action mapping §5.
2. Xác nhận participant visibility/error policy, event vocabulary AD-015 và transaction isolation.
3. Xác nhận Decimal/cursor exact rules AD-012/AD-013.
4. Present endpoint/DTO matrix và **STOP** xin approval.

#### Implementation Checklist

- [ ] Tạo create/list/detail/update/invite/action DTOs; amount/cursor rules exact; không expose `status` write field.
- [ ] Implement create transaction: Deal + buyer + optional seller + `deal.created` event.
- [ ] Implement participant-scoped cursor list và detail serialization.
- [ ] Implement Draft-only PATCH với expectedVersion + update event.
- [ ] Implement add-only seller invite; không replace; same-as-buyer/duplicate stable conflicts.
- [ ] Implement named action mapping, FSM check, preconditions và conditional update.
- [ ] Implement DELETE as soft-cancel action; mọi mutation phát event vocabulary AD-015 và cập nhật shared `DealEvent` nếu thiếu.
- [ ] Viết unit tests cho action/RBAC/parity và integration/API tests cho DB concurrency/rollback.

#### Test Procedure and Verification Queries

1. Login bằng buyer fixture, tạo Draft; DB có đúng một buyer và create event.
2. Invite seller; login seller; cả hai list/detail thấy deal, wallet thứ ba không thấy.
3. Publish → open-invitation → verify-wallets với version tuần tự.
4. Gửi hai requests cùng expectedVersion; assert 1 success, 1 conflict và 1 event.
5. Gửi invalid transition/arbitrary status/duplicate seller; assert stable 4xx và DB không đổi.
6. Force event insert failure trong integration transaction; assert Deal update rollback.
7. Paginate nhiều deal cùng `updatedAt`; không duplicate/skip, invalid cursor trả `INVALID_CURSOR`.
8. Test amount `0`, negative, exponent, >20 integer digits, >18 fractional digits, trailing-zero canonicalization và max boundary.

#### Rollback

- Unregister DealsModule nếu route bug; migration giữ compatible.
- Không hard-delete dữ liệu thật. Sửa invariant bằng forward migration + reconciliation script được review riêng nếu cần.

### RFC-005 — Tests and final verification

**Dependencies:** RFC-001..004 verified.  
**Acceptance links:** AC-15, AC-18, AC-19 và regression toàn bộ AC-01..AC-17.

#### Implementation Checklist

- [ ] Chạy schema validate/generate/migrate test DB.
- [ ] Chạy API unit/integration/e2e tests; không dùng `--passWithNoTests` làm success evidence.
- [ ] Chạy recursive typecheck/build/test qua `corepack pnpm -r`.
- [ ] Chạy API manual smoke và DB verification queries.
- [ ] Chạy `corepack pnpm audit --json`; phân loại runtime vs dev-only và release blocking.
- [ ] Với từng Critical/High: ghi dependency path, runtime/dev, reachable route/code path, mitigation/exception; runtime reachable vẫn block.
- [ ] Bỏ `--passWithNoTests` khỏi API test script sau khi suite >0; chứng minh API test count >0.
- [ ] Tạo task-folder `harness/` đủ 5 artifacts: `risk-gate.json`, `context-snippets.json`, `verification.json`, `review-decision.json`, `adversarial-validation.json`.
- [ ] Validate evidence pack; reviewer decision phải explicit APPROVE trước finalize/handoff.
- [ ] Ghi deviations, known gaps và user confirmation; không tự archive plan.

#### Pass Criteria

- Không test flaky, không open handle, không partial write.
- Tất cả AC có evidence path/command/result.
- User xác nhận manual auth + deal flow.

## 15. Phased Execution Workflow

Mỗi RFC tuân thủ:

1. **Pre-Phase Research** — đọc current code, present delta và **PAUSE**.
2. **Detailed Planning Check** — xác nhận exact files/contracts; user approve.
3. **Implementation** — chỉ làm checklist đã duyệt.
4. **Testing & Verification** — automated + DB + manual.
5. **User Confirmation** — báo theo format:

```text
What's Functional Now: ...
What Was Tested: ...
What You Can Test: ...
Ready For: ...
```

Ví dụ: RFC-003 research xác nhận CJS import và challenge bytes → **STOP** → user duyệt → implement auth → test replay/expiry/DB → user test `/auth/session` → chỉ khi user xác nhận mới chuyển RFC-004.

## 16. Acceptance Criteria

- **AC-01:** Không mất/ghi đè thay đổi dirty có trước; touched files được phân biệt rõ.
- **AC-02:** `@trustroom/types` và `@trustroom/db` build + CommonJS runtime import thành công từ clean generated state.
- **AC-03:** Prisma schema/migration tạo được DB sạch bằng `migrate deploy`, enum parity với shared FSM.
- **AC-04:** Generated client không được commit; clean checkout có command tái tạo deterministic.
- **AC-05:** Nest dùng đúng một Prisma lifecycle service và shutdown không leak connection.
- **AC-06:** Deal schema dùng participant source-of-truth, Decimal, version, role/wallet uniqueness và timeline event.
- **AC-07:** `/auth/nonce` trả raw nonce/message/challengeId nhưng DB chỉ lưu hash; verify hash nonce constant-time trước signature; invalid hash/signature không consume.
- **AC-08:** Valid Solana Ed25519 signature trên canonical message phát JWT claims đúng; altered nonce/domain/URI/wallet/timestamp không tạo identity.
- **AC-09:** Expired/replayed/concurrent-replayed challenge bị từ chối; tối đa một atomic consume.
- **AC-10:** Protected routes/session validate JWT issuer/audience/expiry; env schema fail-fast; global exception mapping ổn định; auth endpoints có rate limit và safe errors/logging.
- **AC-11:** Deal CRUD/invite dùng exact positive Decimal(38,18), deterministic opaque cursor và add-only seller semantics.
- **AC-12:** Participant RBAC chặn IDOR; buyer-only mutation và seller visibility đúng.
- **AC-13:** Public API chỉ nhận named action; invalid FSM transition không đổi DB; mọi mutation dùng exact event vocabulary đồng bộ shared types.
- **AC-14:** expectedVersion concurrency tạo đúng một winning update + event; transaction failure rollback cả state/event.
- **AC-15:** Disposable PostgreSQL procedure chạy migrate/test/teardown; API tests >0 và `--passWithNoTests` không được tính proof.
- **AC-16:** Clean proof chạy DB generate/build trước API từ trạng thái không có generated/dist artifacts cũ.
- **AC-17:** Throttler NestJS 10/CJS + custom keys có feasibility verdict `VIABLE`; verdict khác là blocker quay PLAN.
- **AC-18:** Audit có reachability classification; không còn runtime Critical/High reachable trước release và không major-upgrade âm thầm.
- **AC-19:** Task-folder `harness/` đủ 5 evidence artifacts, adversarial cases và explicit reviewer APPROVE trước finalize/handoff.

## 17. Requirements Traceability

| Criterion | Implemented by | Proven by |
|---|---|---|
| AC-01–02, AC-16 | RFC-001 | G-01, G-02, G-16 |
| AC-03–06 | RFC-002 | G-03, G-04, G-05 |
| AC-07–10, AC-17 | RFC-003 | G-06, G-07, G-08, G-17 |
| AC-11–14 | RFC-004 | G-09, G-10, G-11, G-12 |
| AC-15, AC-18–19 | RFC-005 | G-13, G-14, G-15, G-18, G-19 |

## Touchpoints

### Existing files expected to change

- `.gitignore`
- `.env.example`
- `apps/api/package.json`
- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `packages/db/package.json`
- `packages/db/prisma/schema.prisma`
- `packages/db/src/index.ts`
- `packages/types/src/deal.ts` và/hoặc `events.ts` chỉ nếu contract parity yêu cầu
- `pnpm-lock.yaml`, có thể `pnpm-workspace.yaml`

### Expected new files

- `packages/db/prisma/migrations/*/migration.sql`
- `apps/api/src/database/{database.module,prisma.service}.ts`
- `apps/api/src/auth/**`
- `apps/api/src/deals/**`
- `apps/api/vitest.config.ts` và test setup/helpers nếu cần
- Unit tests cạnh source hoặc `apps/api/test/**` cho integration/e2e, theo convention được VALIDATE chốt
- `apps/api/src/common/filters/global-exception.filter.ts` và stable error types
- Task-scoped evidence pack: `process/general-plans/active/api-foundation-auth-deals_20-06-26/harness/{risk-gate,context-snippets,verification,review-decision,adversarial-validation}.json`

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| G-01 dirty-work snapshot/diff after phase | Agent-Probe | AC-01 |
| G-02 scoped CJS build + runtime require | Fully-Automated | AC-02 |
| G-03 Prisma validate + enum parity test | Fully-Automated | AC-03, AC-06 |
| G-04 migrate deploy on clean Postgres + schema queries | Hybrid | AC-03, AC-06 |
| G-05 API DB lifecycle boot/query/shutdown | Fully-Automated | AC-04, AC-05 |
| G-06 canonical message/signature unit tests | Fully-Automated | AC-07, AC-08 |
| G-07 auth API integration: success/nonce-mismatch/altered/expired/replay, invalid không consume | Hybrid | AC-07, AC-08, AC-09 |
| G-08 concurrent verify + rate-limit + safe-log probe | Hybrid | AC-09, AC-10 |
| G-09 Deals CRUD/invite + Decimal/cursor boundary API integration | Hybrid | AC-11 |
| G-10 three-wallet IDOR/role matrix | Fully-Automated | AC-12 |
| G-11 action/FSM/arbitrary-status negative matrix | Fully-Automated | AC-13 |
| G-12 concurrent transition + forced rollback DB check | Hybrid | AC-14 |
| G-13 recursive typecheck/build/test | Fully-Automated | AC-02, AC-15 |
| G-14 dependency audit classification | Agent-Probe | AC-10, AC-15 |
| G-15 manual nonce→session→deal→invite→actions + DB inspection, user confirmed | Hybrid | AC-03–15 |
| G-16 remove generated/dist → DB generate/build → types/API build | Hybrid | AC-16 |
| G-17 official-doc-backed throttler feasibility probe, custom keys observed | Hybrid | AC-10, AC-17 |
| G-18 Critical/High dependency reachability matrix + runtime release decision | Hybrid | AC-18 |
| G-19 validate 5-artifact evidence pack + explicit APPROVE | Hybrid | AC-19 |

## 20. Exact Verification Commands

### Disposable PostgreSQL procedure — bắt buộc

```powershell
$container = 'trustroom-api-test-postgres'
try {
  docker run --rm --name $container `
    -e POSTGRES_USER=postgres `
    -e POSTGRES_PASSWORD=postgres `
    -e POSTGRES_DB=trustroom_test `
    -p 55432:5432 -d postgres:16-alpine

  $ready = $false
  foreach ($attempt in 1..30) {
    docker exec $container pg_isready -U postgres -d trustroom_test *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw 'Disposable PostgreSQL did not become ready' }

  $env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:55432/trustroom_test'
  $env:DIRECT_URL = $env:DATABASE_URL
  $env:JWT_SECRET = 'test-only-secret-at-least-32-bytes-long'
  $env:AUTH_DOMAIN = 'localhost'
  $env:AUTH_URI = 'http://localhost:3000'
  $env:AUTH_NONCE_TTL_SECONDS = '300'
  $env:JWT_TTL_SECONDS = '900'
  $env:CORS_ORIGINS = 'http://localhost:3000'
  $env:JSON_BODY_LIMIT = '32kb'

  corepack pnpm --filter @trustroom/db exec prisma validate
  corepack pnpm --filter @trustroom/db exec prisma migrate deploy
  corepack pnpm --filter @trustroom/api test
  if ($LASTEXITCODE -ne 0) { throw 'API tests failed' }
}
finally {
  docker rm -f $container 2>$null | Out-Null
}
```

Container name và host port cố định là `trustroom-api-test-postgres` / `55432`; nếu đã bị chiếm thì STOP, không chuyển sang shared DB. Teardown chạy trong `finally`/best-effort cả khi migrate/test fail. Tuyệt đối không chạy reset/drop/migrate test trên local `trustroom`, Supabase hoặc DB dùng chung. Không echo DATABASE_URL/JWT secret vào evidence.

### Clean generation and recursive gates

```powershell
# Chỉ loại bỏ generated/dist build artifacts trong scope sau khi dirty guard xác nhận chúng không phải user work.
corepack pnpm --filter @trustroom/db generate
corepack pnpm --filter @trustroom/db build
corepack pnpm --filter @trustroom/types build
corepack pnpm --filter @trustroom/api typecheck
corepack pnpm --filter @trustroom/api build
corepack pnpm -r typecheck
corepack pnpm -r build
corepack pnpm -r test
corepack pnpm audit --json
```

API suite phải báo test count >0. Script `apps/api` phải bỏ `--passWithNoTests` ngay sau khi suite đầu tiên tồn tại; flag này không bao giờ là proof.

## Test Infra Improvement Notes

- `process/context/tests/all-tests.md` đang stale: ghi “chưa có package/test runner” dù Vitest/monorepo đã tồn tại. Cập nhật trong UPDATE PROCESS, không sửa context trong PLAN/EXECUTE trừ khi được user cho phép đúng phase.
- API script hiện có `--passWithNoTests`; RFC-005 bắt buộc bỏ flag khi suite được tạo và chứng minh test count >0.
- **Tier Fully-Automated:** pure DTO/message/FSM/event vocabulary/Decimal/cursor unit tests; compile/parity gates.
- **Tier Hybrid:** disposable PostgreSQL migration, auth replay/concurrency, RBAC/IDOR, transition rollback, throttler probe, dependency reachability và manual DB inspection. Mọi auth/schema/public API criterion phải có ít nhất một Hybrid gate.
- **Tier Agent-Probe:** dirty-work preservation và safe-log/request-id inspection; không thay thế Hybrid proof.
- **Known gap — production-like migration:** local disposable Postgres chứng minh migration mechanics, không chứng minh Supabase/staging rollout; tạo follow-up trước deployment thật.
- **Known gap — distributed limiter:** in-memory throttler chỉ đủ local/single instance; Redis/distributed limiter là named backlog trước multi-instance production, không được giả PASS.
- **Failing stubs intent:** trước implementation, tạo test stubs đỏ cho nonce hash mismatch/no-consume, concurrent replay, invalid env, exception mapping, Decimal boundaries, cursor ties, add-only invite, event vocabulary, IDOR và transition rollback. Stubs đỏ là contract discovery, không được merge/finalize khi còn đỏ.

## Resume and Execution Handoff

- **Selected plan file:** `process/general-plans/active/api-foundation-auth-deals_20-06-26/api-foundation-auth-deals_PLAN_20-06-26.md`
- **Last completed phase/step:** PLAN artifact được tạo; code baseline chỉ 🔨 CODE DONE một phần, chưa user-confirmed.
- **Validate-contract status:** pending; placeholder bên dưới là blocker.
- **V4 revision status:** P1–P11 đã được khóa trong plan; cần VALIDATE chạy lại, không được dùng contract BLOCKED cũ để EXECUTE.
- **Supporting context loaded:** các file liệt kê tại §1, source `packages/types`, `packages/db`, `apps/api`, git status/diff và dependency audit.
- **Next step for fresh agent:** chạy VALIDATE cho đúng file này; sau khi contract green và user nói `ENTER EXECUTE MODE`, bắt đầu RFC-001 Stage 0, không nhảy thẳng vào auth/deals.
- **Dirty-work guard:** branch `main`, 9 entries dirty tại PLAN start; re-snapshot trước mọi edit.
- **Test runner:** Vitest + Prisma/PostgreSQL integration + recursive pnpm/Turbo tasks qua `corepack pnpm`.
- **High-risk handoff:** chưa có 5-artifact evidence pack/reviewer APPROVE vì chưa EXECUTE; đây là auto-stop trước finalize, không phải bằng chứng hiện tại.

## 23. Change Management and Rollback

Pause và quay lại PLAN nếu xảy ra một trong các điều sau:

- Cần đổi public endpoint/response/error contract.
- Cần lưu buyer/seller ở hai nguồn hoặc bỏ optimistic lock/event transaction.
- Cần major-upgrade Nest/Prisma/TypeScript.
- Throttler feasibility probe không VIABLE trên NestJS 10/CJS hoặc custom key không kiểm chứng được.
- Còn Critical/High advisory reachable trên runtime scoped API.
- Cần thêm refresh tokens/cookies hoặc external auth provider.
- Migration hiện tại đã được apply trên shared environment và đòi destructive change.
- Scope lan sang escrow, terms signature, delivery/dispute hoặc frontend.

Mọi migration rollback ưu tiên forward-fix. Không drop/reset database ngoài test/local và không làm nếu chưa có explicit approval.

## 24. Future Work (Not Current EXECUTE Scope)

Sau milestone này và UPDATE PROCESS:

1. Frontend Solana wallet connect + nonce login + Create Deal/invite.
2. Solana devnet escrow initialize/deposit/release và idempotency keys.
3. Agora Deal Room + STT transcript.
4. Scam Guard realtime warnings.
5. AI Notary terms extraction + dual terms-hash signatures.
6. Evidence Vault + dispute report.

Thứ tự này là sequencing reference, không phải authorization để EXECUTE các feature trên.

## 25. Quality and Risk Assessment

### `vc-predict` consensus

**Verdict sau V4: CAUTION / PLAN REVISED.** Kiến trúc phù hợp nếu giữ participant single-source, transaction event, named actions, nonce hash constant-time check trước signature và atomic consume. Risk lớn nhất là auth replay, IDOR, migration drift, limiter compatibility, dependency reachability và concurrency; tất cả đã chuyển thành acceptance/hybrid gates. Không claim PASS trước VALIDATE rerun và evidence pack approval.

| Area | Score | Note |
|---|---:|---|
| Completeness | 93/100 | Contract, data, authz, rollback và proof đã explicit |
| Security | 88/100 | Strong design; dependency advisories cần triage ở final gate |
| Feasibility | 92/100 | Stack/dependencies đã có; cần PostgreSQL test DB |
| Maintainability | 94/100 | Framework boundary và single source rõ |
| Testability | 91/100 | Có deterministic crypto fixtures + DB concurrency gates |

## Validate Contract

(placeholder — `vc-validate-agent` phải viết section này và đạt gate trước EXECUTE)

## 26. Agent Routing and Next Step

| Phase | Owner | Next action |
|---|---|---|
| PLAN | `vc-plan-agent` | artifact hiện tại |
| VALIDATE | `vc-validate-agent` | kiểm tra V1–V7, test coverage, security/feasibility; thay placeholder |
| EXECUTE | `vc-execute-agent` | chỉ sau valid contract + explicit user command |
| EVL/UPDATE PROCESS | validator/update-process agents | evidence, context/tests refresh, archive decision |

**Next Step:** chạy VALIDATE cho đúng plan này. Chỉ sau khi Validate Contract green, user mới nói **`ENTER EXECUTE MODE`**. Mỗi RFC phải dừng verification + user confirmation trước RFC kế tiếp.
