# TrustRoom AI - Plan update invite, chat realtime, scam rules

## 1. Mục tiêu

Repo hiện là monorepo demo escrow P2P trên Solana devnet, dùng Next.js ở `apps/web`, NestJS ở `apps/api`, Prisma/PostgreSQL ở `packages/db`, Socket.IO cho realtime, và `@trustroom/ai` cho Scam Guard. Kế hoạch này tập trung đúng 3 việc:

1. Khi buyer mời seller vào deal, seller phải nhận thông báo trong app và qua websocket nếu đang online.
2. Buyer và seller đã được invite phải nhắn tin realtime được với nhau trong cùng deal room.
3. Mở rộng rule scam để phát hiện nhiều pattern rủi ro hơn, nhưng vẫn bám pipeline hiện có: rule detector, wallet/link parser, optional LLM classifier, deal state checker, wallet/evidence risk, aggregator, frontend warning.

## 2. Hiện trạng repo liên quan

| Khu vực | File chính | Hiện trạng |
|---|---|---|
| Deal invite | `apps/api/src/deals/deals.service.ts` | `inviteSeller()` tạo `DealParticipant` role `seller` và `DealEvent.DealSellerInvited`, nhưng chưa tạo notification cho seller, chưa emit websocket event, chưa có accept/ack rõ ràng. |
| Notification | `apps/api/src/notifications/*` | Có `NotificationsService.create()`, `listByWallet()`, unread count, mark read. `NotificationType` chưa có `DealInvite`. Frontend `useNotifications()` đang poll mỗi 20 giây. |
| Socket.IO | `apps/api/src/websocket/websocket.gateway.ts` | Có `join_deal`, `leave_deal`, `chat_message`, `emitNotification()`. `join_deal` cho join theo `dealId` và `wallet`, nhưng chưa verify wallet có là participant của deal không. |
| Frontend socket | `apps/web/providers/socket-provider.tsx`, `apps/web/hooks/use-deal-room.ts` | Client emit `join_deal`, `chat_message`; hook nhận `chat_message`, `risk_detected`, `deal_update`. Message hiện chỉ nằm trong React state, reload là mất. |
| Deal room UI | `apps/web/app/deals/[id]/page.tsx` | Có panel "Deal room realtime + Scam Guard", input chat, list transcript, AI monitor. |
| Scam Guard | `packages/ai/src/scam-guard/*` | Đã có `SCAM_RULES`, normalize VI/EN, parser ví/link, LLM classifier optional, aggregator có `lockRelease`, `blockMessage`, `uiAction`. Đây là nền tốt, nên mở rộng thay vì viết mới. |
| Test pipeline | root `package.json`, package scripts | Có `pnpm typecheck`, `pnpm test`, `pnpm build`; package test dùng Vitest. |

## 3. Thiết kế invite notification

### 3.1. DB/schema

Ưu tiên thêm type rõ ràng:

```prisma
enum NotificationType {
  DealCreated
  DealInvite
  DealStatusChanged
  DisputeOpened
  DisputeResolved
  PaymentReceived
  PaymentReleased
  EvidenceUploaded
  AiAlert
  SystemMessage
}
```

Nếu muốn tránh migration enum trong demo ngắn, có thể dùng tạm `SystemMessage`, nhưng nên chọn `DealInvite` để UI filter và test dễ hơn.

`DealParticipant.confirmed` đang có sẵn. Nên dùng trường này đúng nghĩa:

| Field | Ý nghĩa đề xuất |
|---|---|
| `joinedAt` | thời điểm được add vào deal hoặc accept invite. Hiện đang auto `now()`, có thể giữ. |
| `confirmed` | seller đã mở invite/accept deal. Buyer mặc định `true`, seller ban đầu `false`. |

Khi tạo deal có sellerWallet từ đầu, buyer `confirmed=true`, seller `confirmed=false`.

### 3.2. Backend flow

Sửa `DealsService.inviteSeller()`:

1. Validate buyer, version, seller khác buyer như hiện tại.
2. Tạo `DealParticipant` seller với `confirmed: false`.
3. Tạo `DealEvent` loại `DealSellerInvited`.
4. Tạo notification:

```ts
const notification = await this.notifications.create(
  dto.sellerWallet,
  'Bạn được mời vào deal',
  `Bạn được mời vào deal "${updated.title}".`,
  'DealInvite',
  dealId,
  { buyerWallet: actorWallet, sellerWallet: dto.sellerWallet },
);
```

5. Emit realtime:

```ts
this.ws.emitNotification(dto.sellerWallet, {
  id: notification.id,
  type: 'DealInvite',
  title: notification.title,
  message: notification.message,
  dealId,
  metadata: notification.metadata,
  createdAt: notification.createdAt,
});

this.ws.emitDealUpdate(dealId, {
  kind: 'seller_invited',
  sellerWallet: dto.sellerWallet,
});
```

6. Trả về serialized deal như hiện tại.

### 3.3. API accept invite

Thêm endpoint riêng thay vì overload `verify-wallets`:

```ts
@Post(':id/accept-invite')
acceptInvite(@Param('id') id: string, @Body() dto: { expectedVersion: number }, @Req() req)
```

Trong service:

1. Load deal và assert actor là seller participant.
2. `updateMany` theo `dealId`, `walletAddress`, `confirmed=false`.
3. Increment `Deal.version`.
4. Tạo event `DealSellerAccepted`.
5. Notification cho buyer: seller đã accept.
6. Emit `deal_update` cho `deal:${dealId}`.

Nếu muốn ít thay đổi type hơn, có thể giữ event type string trong `DealEvent.type` vì DB đang là `String`, nhưng nên thêm vào `packages/types/src/events.ts` nếu có enum `DealEvent`.

### 3.4. Frontend notification UX

Sửa `SocketProvider` để socket join user room ngay sau khi auth có wallet:

1. Hiện `joinDeal(dealId, wallet)` mới join `user:${wallet}` nếu user vào deal room.
2. Seller ở dashboard vẫn cần nhận notification, nên thêm `join_user` event hoặc `authenticate_socket`.
3. `SocketProvider` nên nhận wallet từ `useAuth()` hoặc tạo component `RealtimeNotificationsBridge`.

Đề xuất event:

```ts
socket.emit('join_user', { wallet });
socket.on('notification', ...)
```

Khi nhận notification:

1. Invalidate `['notifications']`.
2. Invalidate `['deals']` nếu `type === 'DealInvite'`.
3. Hiển thị toast hoặc badge trong `NotificationPanel`.

Nếu chưa có toast lib, chỉ cần refetch `NotificationPanel` realtime là pass MVP.

## 4. Thiết kế chat realtime buyer/seller

### 4.1. Vấn đề hiện tại

`WebsocketGateway.handleJoinDeal()` đang:

```ts
client.join(`deal:${data.dealId}`);
if (data.wallet) client.join(`user:${data.wallet}`);
```

Điểm yếu:

1. Không kiểm tra `wallet` có thuộc `DealParticipant` không.
2. Client tự gửi `sender`, có thể giả mạo wallet khác.
3. `chat_message` broadcast trước khi chạy Scam Guard, nên `blockMessage` không thực sự block credential/private key message.
4. Chat không persist thành bảng riêng, chỉ best-effort `DealEvent` dạng `transcript.chunk`.

### 4.2. MVP cần pass

MVP để 2 người chat được:

1. Seller nhận invite.
2. Seller mở `/deals/:id`, API `findOne()` pass vì seller đã là participant.
3. Seller socket emit `join_deal`.
4. Buyer socket cũng join cùng `deal:${id}`.
5. Khi một bên emit `chat_message`, server broadcast vào `deal:${id}`.
6. Cả 2 tab nhận message trong `useDealRoom()`.

### 4.3. Sửa gateway cho đúng quyền

Đổi `join_deal` thành async:

```ts
@SubscribeMessage('join_deal')
async handleJoinDeal(client: Socket, data: { dealId: string; wallet?: string }) {
  if (!data.wallet) return { event: 'join_error', data: { code: 'WALLET_REQUIRED' } };

  const participant = await this.prisma.dealParticipant.findUnique({
    where: { dealId_walletAddress: { dealId: data.dealId, walletAddress: data.wallet } },
  });

  if (!participant) {
    client.emit('deal_error', { dealId: data.dealId, code: 'DEAL_FORBIDDEN' });
    return;
  }

  client.data.wallet = data.wallet;
  client.data.dealRoles ??= {};
  client.data.dealRoles[data.dealId] = participant.role;
  client.join(`deal:${data.dealId}`);
  client.join(`user:${data.wallet}`);
  return { event: 'joined', data: { dealId: data.dealId, role: participant.role } };
}
```

Lưu ý Prisma unique name có thể là `dealId_walletAddress` do `@@unique([dealId, walletAddress])`.

### 4.4. Sửa send message

Server không tin `sender` và `speakerRole` từ client. Lấy từ `client.data`:

```ts
const wallet = client.data.wallet;
const role = client.data.dealRoles?.[data.dealId];
```

Trước khi broadcast:

1. Check participant.
2. Chạy `analyzeMessage`.
3. Nếu `analysis.blockMessage === true`, không broadcast raw message, chỉ emit warning cho sender và `risk_detected` cho room.
4. Nếu không block, broadcast message.

Pseudo flow:

```ts
const analysis = await this.runScamGuard(...)
if (analysis.blockMessage) {
  client.emit('message_blocked', { dealId, reason, analysis });
  this.server.to(room).emit('risk_detected', payload);
  return { event: 'message_blocked' };
}

this.server.to(room).emit('chat_message', persistedOrLiveMessage);
return { event: 'message_sent' };
```

### 4.5. Persist chat

MVP có thể giữ `DealEvent` như hiện tại. Nhưng nếu muốn sản phẩm đúng hơn, thêm model:

```prisma
model ChatMessage {
  id String @id @default(cuid())
  dealId String
  senderWallet String
  speakerRole ParticipantRole
  message String
  createdAt DateTime @default(now())
  riskLevel String?
  riskPayload Json?
  blocked Boolean @default(false)
  deal Deal @relation(fields: [dealId], references: [id], onDelete: Cascade)
  @@index([dealId, createdAt])
}
```

Sau đó thêm:

| API | Mục đích |
|---|---|
| `GET /api/deals/:id/messages?limit=50&cursor=` | load history khi vào room |
| socket `chat_message` | tạo `ChatMessage`, emit payload có `id` |
| socket `message_blocked` | lưu `blocked=true`, không show raw content cho đối phương |

Nếu chưa kịp thêm model, tối thiểu thêm API đọc `DealEvent` type `transcript.chunk` để refresh không mất toàn bộ chat.

### 4.6. Frontend cần sửa

`useDealRoom()`:

1. Khi `joinDeal` fail, nhận `deal_error` và show alert.
2. Lắng nghe `message_blocked`.
3. Nếu có history API, fetch trước `GET /deals/:id/messages`.
4. Invalidate `['deal', deal.id]` khi nhận `deal_update`.

`DealDetailPage`:

1. Disable input khi chưa có seller hoặc wallet hiện tại không phải participant.
2. Show banner: "Seller invited, waiting for accept" nếu seller `confirmed=false`.
3. Show `message_blocked` alert khi user gửi seed/private key/OTP.
4. Với `risk_detected.lockRelease`, disable hoặc yêu cầu confirm mạnh ở các button `Release`.

## 5. Mở rộng rule scam

### 5.1. Nguồn dấu hiệu rủi ro dùng để mở rộng

Các nguồn chính thống nên map vào rule/test:

| Nguồn | Dấu hiệu nên chuyển thành rule |
|---|---|
| FTC romance scam | Không gửi tiền/quà/crypto cho người chưa gặp; reverse image/job scam; báo ngân hàng nếu đã trả qua crypto/gift card/wire. |
| FBI romance scam | Tạo quan hệ nhanh, dụ rời app/nền tảng, né gặp/video, xin tiền, xin thông tin tài chính. |
| FBI 2026 red flags | Xin gift card/crypto/wire/prepaid card, áp lực giữ bí mật, câu chuyện không nhất quán, AI tạo ảnh/video giả. |
| FTC crypto scams | Lợi nhuận đảm bảo, đầu tư crypto qua love interest, gửi crypto trước, app/site đầu tư giả, phí rút tiền. |
| IOSCO relationship investment scams | Love bombing, wrong-number/social/dating origin, fake investment app/charts, không rút được tiền, chuyển qua encrypted app. |

### 5.2. Rule hiện có nên giữ

Repo đã có:

| Rule | Intent |
|---|---|
| `EARLY_RELEASE` | `early_release_request` |
| `OFF_PLATFORM` | `move_off_platform` |
| `CREDENTIAL_REQUEST` | `credential_request` |
| `EXTERNAL_WALLET` | `external_wallet` |
| `SPLIT_PAYMENT` | `split_payment` |
| `FAKE_PAYMENT_PROOF` | `fake_payment_proof` |
| `TIME_PRESSURE` | `time_pressure` |
| `IMPERSONATION` | `impersonation` |
| `TERM_CHANGE_AFTER_DEPOSIT` | `term_change_after_deposit` |
| `AMBIGUOUS_TERMS` | `ambiguous_terms` |
| `UNVERIFIED_DELIVERY` | `unverified_delivery` |
| `PHISHING_LINK` | `phishing_link` |

### 5.3. Rule mới đề xuất

Thêm intents vào `packages/types/src/ai.ts` hoặc file risk tương ứng, cập nhật `scamIntentSchema`, `SCAM_INTENT_SUGGESTED_ACTION`, `llm-classifier.ts`, `explainRiskIntent()` ở frontend.

| Rule mới | Intent đề xuất | Risk | Pattern cần bắt |
|---|---|---:|---|
| `GUARANTEED_PROFIT` | `guaranteed_profit` | high | "cam kết lời", "lãi chắc", "guaranteed return", "zero risk", "x2/x10", "profit daily" |
| `FAKE_INVESTMENT_APP` | `fake_investment_app` | high | "tải app đầu tư này", "sàn riêng", "platform của mentor", "withdraw fee", "nộp thuế để rút" |
| `RECOVERY_FEE` | `recovery_fee` | high | "trả phí để lấy lại tiền", "recovery agent", "unlock withdrawal", "deposit thêm để rút" |
| `SECRECY_PRESSURE` | `secrecy_pressure` | medium/high | "đừng nói ai", "giữ bí mật", "không báo support", "don't tell anyone" |
| `EMERGENCY_MONEY_REQUEST` | `emergency_money_request` | high | "viện phí", "tai nạn", "kẹt hải quan", "vé máy bay", "legal fee", "urgent medical" |
| `GIFT_CARD_OR_WIRE` | `gift_card_or_wire` | high | "gift card", "prepaid card", "wire transfer", "Western Union", "MoneyGram" |
| `REMOTE_ACCESS` | `remote_access` | critical | "AnyDesk", "TeamViewer", "remote", "share screen để connect wallet" |
| `FAKE_SUPPORT_ESCALATION` | `fake_support_escalation` | critical | "admin yêu cầu gửi ví", "support TrustRoom bảo release", "moderator nói chuyển ngoài" |
| `QR_PAYMENT_LURE` | `qr_payment_lure` | high | "quét QR này", "scan QR để nhận/refund/verify", link/QR ngoài escrow |
| `CONVERSATION_INCONSISTENCY` | `story_inconsistency` | medium | đổi vai trò, đổi wallet, đổi lý do giao hàng nhiều lần trong recent messages |

### 5.4. Cách implement rule mới

1. Mở rộng type:
   - `packages/types/src/ai.ts` hoặc nơi định nghĩa `ScamIntent`.
   - `SCAM_INTENT_SUGGESTED_ACTION`.
2. Mở rộng `SCAM_RULES`:
   - Keyword tiếng Việt không dấu và tiếng Anh.
   - Regex ngắn, có khoảng cách `{0,40}` để bắt câu vòng vo.
   - Dùng `escrowThreat=true` cho rule liên quan tiền/ví/link.
   - Dùng `repeatable=true` cho pressure, secrecy, off-platform, investment lure.
3. Mở rộng `llm-classifier.ts`:
   - Thêm allowed intents trong prompt.
   - Không đổi guardrail: LLM chỉ sinh signal.
4. Mở rộng `wallet-parser.ts`:
   - Thêm shortener/domain lure: `rebrand.ly`, `ln.run`, `phantom-airdrop`, `sol-claim`, `walletconnect-*`.
   - Thêm rule phát hiện URL có punycode hoặc domain gần giống `phantom`, `solana`, `trustroom`.
5. Thêm sequence detection nhẹ:
   - Trong `analyze.ts`, dùng `recentMessages`.
   - Nếu `move_off_platform` xuất hiện sau `time_pressure`, cộng 10 điểm.
   - Nếu `fake_payment_proof` + `early_release_request` trong 10 message gần nhất, cộng 20 điểm.
   - Nếu đổi wallet sau khi escrow đã tạo, critical.

### 5.5. Không nên làm ngay

1. ML model fraud riêng.
2. Deepfake detection nâng cao.
3. Full graph AML.
4. OCR ảnh bill phức tạp.

Những phần này tốn thời gian và khó pass test ổn định. MVP nên ưu tiên rule deterministic + LLM optional + test cụ thể.

## 6. Test plan để pass pipeline

### 6.1. Unit tests backend invite

Thêm `apps/api/src/deals/deals.service.spec.ts` hoặc test gần module hiện có.

Test cases:

| Case | Expected |
|---|---|
| Buyer invite seller hợp lệ | tạo `DealParticipant`, tạo `DealEvent`, tạo `Notification` type `DealInvite`, gọi `emitNotification`, gọi `emitDealUpdate`. |
| Seller trùng buyer | throw `PARTICIPANT_CONFLICT`. |
| Deal đã có seller | throw `SELLER_ALREADY_INVITED`. |
| Actor không phải buyer | throw `DEAL_FORBIDDEN`. |
| expectedVersion sai | throw `DEAL_VERSION_CONFLICT`. |

### 6.2. Unit tests websocket

Thêm test cho `WebsocketGateway` bằng mock `Socket` và mock Prisma:

| Case | Expected |
|---|---|
| `join_deal` với wallet participant | socket join `deal:${id}` và `user:${wallet}`. |
| `join_deal` với wallet không thuộc deal | emit `deal_error`, không join room. |
| `chat_message` từ buyer | broadcast cho room, persist transcript, run Scam Guard. |
| `chat_message` chứa seed phrase | emit `message_blocked`, emit `risk_detected`, không broadcast raw chat. |
| sender giả mạo | server dùng `client.data.wallet`, không dùng payload sender. |

### 6.3. Unit tests Scam Guard

Mở rộng `packages/ai/src/scam-guard/detect.test.ts` và `analyze.test.ts`.

Test input nên gồm tiếng Việt có dấu, không dấu, English, câu vòng vo:

| Input | Expected |
|---|---|
| "cam kết lời 20% mỗi ngày không rủi ro" | `guaranteed_profit`, high |
| "tải app này nạp USDT, biểu đồ lời rồi rút sau" | `fake_investment_app`, high |
| "muốn rút tiền phải đóng phí unlock trước" | `recovery_fee`, high |
| "đừng nói support, chỉ mình biết thôi" | `secrecy_pressure`, medium/high |
| "mua gift card gửi code cho mình" | `gift_card_or_wire`, high |
| "cài AnyDesk để mình kiểm tra ví" | `remote_access`, critical, `blockMessage=true` |
| "support TrustRoom bảo bạn release ngay" | `fake_support_escalation`, critical/high |
| "quét QR này để verify wallet" | `qr_payment_lure`, high |

### 6.4. Frontend tests

Nếu repo chưa có Playwright, không cần thêm nặng ngay. Dùng component/hook tests nếu setup sẵn. Nếu chưa setup, manual QA + typecheck là đủ cho MVP.

Manual QA 2 trình duyệt:

1. Browser A login buyer, tạo deal.
2. Browser B login seller wallet, mở dashboard.
3. Browser A invite seller.
4. Browser B thấy notification không cần refresh lâu, hoặc tối đa refetch realtime.
5. Browser B mở deal, accept invite nếu đã build endpoint.
6. A và B cùng mở deal room.
7. A gửi message thường, B nhận ngay.
8. B gửi "release trước đi rồi tôi gửi file sau", cả A/B thấy AI monitor high risk.
9. B gửi "cho mình xin seed phrase", message bị block, AI monitor critical.
10. Refresh page: nếu có chat persistence thì history còn; nếu MVP event-only thì ghi rõ acceptance chỉ yêu cầu realtime trong session.

### 6.5. Lệnh kiểm tra

Chạy theo thứ tự:

```bash
pnpm install
pnpm --filter @trustroom/db generate
pnpm db:push
pnpm typecheck
pnpm test
pnpm build
```

Nếu chỉ sửa AI rules:

```bash
pnpm --filter @trustroom/ai test
pnpm --filter @trustroom/ai typecheck
```

Nếu sửa backend socket/deals:

```bash
pnpm --filter @trustroom/api test
pnpm --filter @trustroom/api typecheck
```

Nếu sửa frontend:

```bash
pnpm --filter @trustroom/web typecheck
```

## 7. Thứ tự triển khai khuyến nghị

### Phase 1 - Fix invite notification

1. Thêm `DealInvite` vào `NotificationType`.
2. Sửa `DealsService.inviteSeller()` tạo notification + websocket emit.
3. Thêm `join_user` trong `WebsocketGateway`.
4. Sửa frontend `SocketProvider`/bridge để join user room khi authenticated.
5. Invalidate/refetch notifications khi nhận socket `notification`.
6. Test invite từ buyer sang seller.

### Phase 2 - Fix chat connect buyer/seller

1. Verify participant trong `join_deal`.
2. Lưu wallet/role vào `client.data`.
3. Sửa `chat_message` không tin sender từ client.
4. Chạy Scam Guard trước broadcast.
5. Thực thi `blockMessage`.
6. Emit lỗi rõ ràng cho frontend.
7. Test 2 browser.

### Phase 3 - Persist chat

1. Chọn `ChatMessage` model hoặc tái sử dụng `DealEvent`.
2. Thêm API load history.
3. `useDealRoom()` load history ban đầu.
4. Emit message có `id`.
5. Test refresh.

### Phase 4 - Rule scam mạnh hơn

1. Thêm intents mới.
2. Thêm rules + regex.
3. Update LLM prompt.
4. Update frontend `explainRiskIntent`.
5. Thêm unit tests theo matrix.
6. Chạy `pnpm --filter @trustroom/ai test`.

## 8. Acceptance criteria

| Feature | Pass khi |
|---|---|
| Invite notification | Seller được tạo notification trong DB, nhận websocket event nếu online, dashboard/panel refetch và hiển thị invite. |
| Deal visibility | Seller được invite gọi `GET /deals/:id` thành công, deal xuất hiện trong list của seller. |
| Chat realtime | 2 wallet participant mở cùng deal nhận message qua Socket.IO trong dưới 1 giây ở local. |
| Chat auth | Wallet không thuộc deal không thể join room hoặc gửi message vào room. |
| Scam block | Message credential/private key/OTP bị `message_blocked`, không broadcast raw text cho đối phương. |
| Scam alert | Early release, off-platform, external wallet, suspicious link, fake proof tạo `risk_detected`. |
| New scam rules | Các rule mới có unit test và pass deterministic khi không có API key. |
| Pipeline | `pnpm typecheck`, `pnpm test`, `pnpm build` pass. |

## 9. Ghi chú rủi ro kỹ thuật

1. Socket hiện chưa dùng JWT handshake. Nếu làm production, nên đưa JWT vào `io(WS_URL, { auth: { token } })` và verify ở gateway thay vì tin `wallet` client gửi.
2. Prisma enum migration trên PostgreSQL có thể cần `db:push` hoặc migration rõ ràng. Nếu muốn demo nhanh, dùng `SystemMessage` rồi thêm enum sau.
3. `Notification.metadata` trong schema là `Json?`, nhưng service đang `JSON.stringify(metadata)`. Nên lưu object trực tiếp: `metadata: metadata ?? undefined`.
4. `blockMessage` hiện chỉ là hint từ aggregator. Cần đổi thứ tự xử lý trong gateway để block thật.
5. Nếu deploy nhiều API instance, Socket.IO in-memory room không đủ. Cần Redis adapter cho production.

## 10. Nguồn tham khảo dấu hiệu scam

- [FTC - What To Know About Romance Scams](https://consumer.ftc.gov/articles/what-know-about-romance-scams)
- [FBI - Romance Scams](https://www.fbi.gov/how-we-can-help-you/scams-and-safety/common-frauds-and-scams/romance-scams)
- [FBI Norfolk - Romance scam red flags 2026](https://www.fbi.gov/contact-us/field-offices/norfolk/news/fbi-norfolk-warns-of-romance-scams-urges-public-to-recognize-red-flags-ahead-of-valentines-day)
- [FTC - What To Know About Cryptocurrency and Scams](https://consumer.ftc.gov/articles/what-know-about-cryptocurrency-scams)
- [IOSCO - Relationship Investment Scams](https://www.iosco.org/v2/investor_protection/?subsection=relationship_investment_scams)

