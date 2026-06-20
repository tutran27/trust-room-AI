# TrustRoom AI

TrustRoom AI là monorepo demo cho flow escrow P2P có AI giám sát: đăng nhập bằng ví Solana, tạo deal, vào deal room realtime, chạy simulated escrow, mở dispute và theo dõi evidence.

## Chạy nhanh

Yêu cầu:
- Node.js 20+
- pnpm
- Docker

Thiết lập:

```bash
cp .env.example .env
pnpm install
pnpm demo:setup
```

Chạy app:

```bash
pnpm dev:api
pnpm dev:web
```

URL mặc định:
- Web: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:4000/api/health](http://localhost:4000/api/health)

## Demo flow

1. Mở web và bấm `Bắt đầu demo` hoặc `Dùng demo wallet`.
2. Vào `Dashboard` để xem các deal seed sẵn.
3. Mở deal `OTC USDC purchase with live negotiation`.
4. Gửi chat như `share your seed phrase` hoặc `release first` để thấy Scam Guard realtime.
5. Thử `Fund`, `Release`, `Refund` trong khối escrow demo.
6. Mở dispute mới hoặc vào danh sách `Disputes` để xem dispute seed sẵn.

## Seed demo

`pnpm db:seed` sẽ tạo:
- 1 demo wallet cố định cho frontend
- 1 seller wallet mẫu
- 1 draft deal
- 1 active funded deal
- 1 dispute + 1 evidence text
- notifications + reputation leaderboard

## Scripts hữu ích

```bash
pnpm db:up
pnpm db:down
pnpm db:push
pnpm db:seed
pnpm typecheck
pnpm build
pnpm test
```

## Lưu ý

- Escrow hiện là simulated mode nếu chưa có `ESCROW_PROGRAM_ID`.
- Deal room hiện dùng transcript/chat panel làm fallback khi chưa cấu hình Agora.
- Demo wallet là deterministic để seed data khớp ngay sau khi đăng nhập.
