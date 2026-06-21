# TrustRoom AI

TrustRoom AI là monorepo demo cho flow escrow P2P có AI giám sát trên **Solana devnet**: đăng nhập bằng ví Solana (Phantom), tạo deal, vào deal room realtime, chạy escrow thật trên blockchain, mở dispute và theo dõi evidence.

## Kiến trúc

```
Frontend (Next.js)  ──►  Backend (NestJS)  ──►  Solana Devnet (Anchor Program)
     │                        │                        │
     │  Phantom Wallet        │  Unsigned tx           │  Real SOL transfers
     │  Sign + Send           │  Build tx              │  PDA escrow accounts
     │                        │                        │
     └────────────────────────┴────────────────────────┘
```

## Yêu cầu

- Node.js 20+
- pnpm 11+
- Docker (cho PostgreSQL)
- Rust + Solana CLI (cho escrow program)
- Phantom wallet (Chrome extension)

## Setup

### 1. Clone & cài dependencies

```bash
git clone <repo-url>
cd trust-room-AI
cp .env.example .env
pnpm install
```

### 2. Database

```bash
pnpm db:up        # Khởi động PostgreSQL Docker
pnpm db:push      # Sync Prisma schema
pnpm db:seed      # Seed demo data (tùy chọn)
```

### 3. Cài Solana toolchain (nếu muốn build/deploy escrow program)

```bash
# Cài Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Cài Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Cài Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install 0.30.1
avm use 0.30.1

# Setup keypair cho devnet
solana-keygen new --no-bip39-passphrase
solana config set --url devnet
solana airdrop 5  # Cần SOL devnet để deploy
```

### 4. Deploy escrow program (nếu muốn chạy on-chain)

Program đã deploy sẵn trên devnet:
- Program ID: `3DyccqgiVSUupDEfgvME8rduMHAgJdLxqhGEdPuhbjR7`
- Network: Solana Devnet

Nếu muốn deploy lại:

```bash
cd programs/escrow
PATH=/home/linh/.local/share/solana/install/releases/3.1.10/solana-release/bin:$PATH \
  cargo-build-sbf --manifest-path Cargo.toml

PATH=/home/linh/.local/share/solana/install/releases/3.1.10/solana-release/bin:$PATH \
  solana program deploy \
    --program-id target/deploy/trustroom_escrow-keypair.json \
    target/deploy/trustroom_escrow.so \
    --url devnet
```

### 5. Env variables

Thêm vào `.env`:

```env
# Solana
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
ESCROW_PROGRAM_ID=3DyccqgiVSUupDEfgvME8rduMHAgJdLxqhGEdPuhbjR7

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/trustroom
```

### 6. Chạy app

```bash
pnpm dev           # Chạy cả web + api
```

Hoặc riêng lẻ:

```bash
pnpm dev:web       # Next.js - http://localhost:3000
pnpm dev:api       # NestJS  - http://localhost:4000/api/health
```

## Demo flow (Escrow thật trên Solana Devnet)

1. **Login**: Mở web → bấm "Kết nối Phantom" → Approve sign message
2. **Tạo deal**: `/deals/new` → nhập tên, amount (ví dụ `0.1`), token `SOL` →邀 seller
3. **Mời seller**: Paste address ví seller → click "Mời seller"
4. **Tạo escrow**: Click "Tạo escrow on-chain" → Phantom Approve → tạo PDA trên devnet
5. **Fund**: Click "Fund (nạp tiền)" → Phantom Approve → SOL chuyển vào vault
6. **Release**: Click "Release (rút tiền)" → Phantom Approve → SOL về seller
   - Hoặc **Refund**: Click "Refund (hoàn tiền)" → Phantom Approve → SOL về buyer
7. **Verify**: Mỗi tx có link Solscan để xem trên blockchain

## Solana Escrow Program

### FSM States

```
Initialized → Deposited → TermsConfirmed → DeliverySubmitted → Released
                 │                                              ↑
                 └──────────── Refunded                         │
                 │                                              │
                 └──────────── Disputed → Resolved              │
```

### Functions

| Function | Mô tả | Ai gọi |
|----------|-------|--------|
| `initialize_deal` | Tạo escrow PDA + vault PDA | Buyer |
| `deposit` | Chuyển SOL vào vault | Buyer |
| `confirm_terms` | Lưu terms hash | Buyer/Seller |
| `submit_delivery` | Đánh dấu giao hàng | Seller |
| `release` | Release SOL cho seller | **Chỉ Buyer** |
| `refund` | Hoàn SOL cho buyer | Buyer |
| `raise_dispute` | Đóng băng funds | Buyer/Seller |
| `resolve_dispute` | Giải quyết dispute | Buyer (MVP) |

### PDA Seeds

```
Escrow PDA: [b"escrow", deal_id_hash]
Vault PDA:  [b"vault",  deal_id_hash]
```

## Scripts hữu ích

```bash
pnpm db:up          # Khởi động PostgreSQL
pnpm db:down        # Tắt PostgreSQL
pnpm db:push        # Sync Prisma schema
pnpm db:seed        # Seed demo data
pnpm typecheck      # Kiểm tra types
pnpm build          # Build tất cả packages
pnpm test           # Chạy tests
```

## Tech Stack

- **Frontend**: Next.js 15, Tailwind CSS, TanStack Query, Solana Web3.js
- **Backend**: NestJS, Prisma, PostgreSQL, Socket.IO
- **Blockchain**: Solana Devnet, Anchor 0.30.1, SPL Token
- **AI**: Groq API (LLM), Qdrant (vector DB), bge-m3 (embeddings)
- **Realtime**: Agora Web RTC, Socket.IO

## Lưu ý

- Escrow dùng **SOL** (native token) trên devnet — không phải USDC/SPL token
- Phantom wallet phải switch sang **Devnet** mới ký được tx
- Airdrop SOL devnet tại https://faucet.solana.com
- Program đã deploy sẵn, không cần build lại trừ khi sửa smart contract
