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

## Deploy lên VPS

Dự án chạy tốt trên **VPS 3GB RAM** (dư tài nguyên). Stack: Docker (PostgreSQL + Redis) + PM2 + Nginx.

### Yêu cầu VPS

- Ubuntu 22.04 / 24.04 hoặc Debian 12
- RAM tối thiểu: **2GB** (khuyên dùng: 3GB+)
- Docker + Docker Compose (script tự cài)
- Domain trỏ về IP VPS (tùy chọn, có thể dùng IP)

### Cách 1: Script tự động (khuyên dùng)

SSH vào VPS và chạy một lệnh duy nhất:

```bash
curl -fsSL https://raw.githubusercontent.com/tutran27/trust-room-AI/main/scripts/deploy-vps.sh | bash
```

Script sẽ tự động:
1. Cài Docker, Node.js 22, pnpm, PM2
2. Clone project
3. Tạo file `.env` (JWT secret random)
4. Khởi động PostgreSQL + Redis (Docker)
5. Cài dependencies + Prisma generate + push schema
6. Build web + api
7. Cấu hình Nginx reverse proxy
8. Start services với PM2 (tự động restart nếu crash)

Sau khi script chạy xong:

```bash
# 1. Sửa API key
nano ~/trustroom-ai/.env
# Điền: GROQ_API_KEY, AGORA_APP_ID, AGORA_APP_CERTIFICATE, SUPABASE_URL, SUPABASE_ANON_KEY

# 2. Restart để áp dụng
pm2 restart all

# 3. Kiểm tra
pm2 status
curl http://localhost:4000/api/health
```

### Cách 2: Từng bước thủ công

```bash
# SSH vào VPS
# Cài Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Logout rồi login lại

# Cài Node.js 22 + pnpm
npm install -g pnpm pm2

# Clone project
git clone https://github.com/tutran27/trust-room-AI.git ~/trustroom-ai
cd ~/trustroom-ai

# Env
cp .env.example .env
# Sửa JWT_SECRET, GROQ_API_KEY, AGORA_*, SUPABASE_*

# Start DB
docker compose -f infra/docker/docker-compose.yml up -d

# Install & build
pnpm install
pnpm --filter @trustroom/db generate
pnpm --filter @trustroom/db db:push
pnpm --filter @trustroom/types build
pnpm --filter @trustroom/ai build
pnpm --filter @trustroom/solana build
pnpm --filter @trustroom/tts build
pnpm --filter @trustroom/ui build
pnpm --filter @trustroom/db build
pnpm --filter @trustroom/api build
pnpm --filter @trustroom/web build

# Start với PM2
pm2 start apps/api/dist/main.js --name trustroom-api --cwd apps/api
pm2 start apps/web/.next/standalone/apps/web/server.js --name trustroom-web --cwd apps/web
pm2 save
pm2 startup
```

### Cấu trúc VPS

```
VPS (3GB RAM)
├── Docker: PostgreSQL (300MB) + Redis (50MB)
├── PM2: API NestJS (200MB) + Web Next.js (200MB)
└── Nginx: reverse proxy port 80
```

Toàn bộ chỉ tốn ~**1-1.5GB RAM**, còn dư cho OS.

### Nginx + Domain (tùy chọn)

Nếu có domain, chạy script với flag:

```bash
bash scripts/deploy-vps.sh --domain trustroom.example.com
```

Sau đó setup SSL với Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d trustroom.example.com
```

## Lưu ý

- Escrow dùng **SOL** (native token) trên devnet — không phải USDC/SPL token
- Phantom wallet phải switch sang **Devnet** mới ký được tx
- Airdrop SOL devnet tại https://faucet.solana.com
- Program đã deploy sẵn, không cần build lại trừ khi sửa smart contract
