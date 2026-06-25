#!/usr/bin/env bash
# =============================================================================
# TrustRoom AI — VPS Deployment Script
# =============================================================================
# Chạy trên VPS Ubuntu/Debian mới tinh (3GB RAM khuyên dùng)
#
# Cách dùng:
#   # SSH vào VPS rồi chạy:
#   curl -fsSL https://raw.githubusercontent.com/tutran27/trust-room-AI/main/scripts/deploy-vps.sh | bash
#
#   # Hoặc clone về rồi chạy local:
#   git clone https://github.com/tutran27/trust-room-AI.git ~/trustroom-ai
#   cd ~/trustroom-ai && bash scripts/deploy-vps.sh
#
# Sau khi chạy xong NHỚ sửa file .env và điền API key.
# =============================================================================

set -euo pipefail

# ─── Color ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${CYAN}[i]${NC} $1"; }

# ─── Config ──────────────────────────────────────────────────────────────────
PROJECT_DIR="${HOME}/trustroom-ai"
NODE_VERSION="22"
API_PORT="${API_PORT:-4000}"
WEB_PORT="${WEB_PORT:-3000}"

# ─── Step 0: Detect OS ─────────────────────────────────────────────────────
check_os() {
  if [ ! -f /etc/os-release ]; then
    err "Chỉ hỗ trợ Ubuntu/Debian. Không tìm thấy /etc/os-release"
  fi
  # shellcheck disable=SC1091
  . /etc/os-release
  case "$ID" in
    ubuntu|debian) log "Phát hiện OS: $ID $VERSION_ID" ;;
    *) err "OS '$ID' chưa được hỗ trợ. Cần Ubuntu hoặc Debian." ;;
  esac
}

# ─── Step 1: System dependencies ────────────────────────────────────────────
install_system_deps() {
  info ">>> Cập nhật apt & cài system dependencies..."

  sudo apt-get update -qq
  sudo apt-get install -y -qq \
    curl git unzip htop \
    ca-certificates gnupg lsb-release

  # Docker (nếu chưa có)
  if ! command -v docker &>/dev/null; then
    info "Cài Docker..."
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
      sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo usermod -aG docker "$USER"
    log "Docker installed"
    warn "Logout/login lại để dùng docker không cần sudo, hoặc dùng 'newgrp docker'"
  else
    log "Docker đã có"
  fi

  # Node.js via fnm
  if ! command -v fnm &>/dev/null; then
    info "Cài fnm (Fast Node Manager)..."
    curl -fsSL https://fnm.vercel.app/install | bash
  fi

  # Load fnm vào shell hiện tại
  export PATH="${HOME}/.local/share/fnm:${PATH}"
  if command -v fnm &>/dev/null; then
    eval "$(fnm env --use-on-cd --shell bash 2>/dev/null)" || true
  fi

  # Ghi fnm vào .bashrc nếu chưa có (cho PM2 non-interactive)
  if ! grep -q "fnm env" "${HOME}/.bashrc" 2>/dev/null; then
    {
      echo ''
      echo '# fnm (Fast Node Manager)'
      echo "export PATH=\"${HOME}/.local/share/fnm:\${PATH}\""
      echo 'eval "$(fnm env --use-on-cd --shell bash 2>/dev/null)"' || true
    } >> "${HOME}/.bashrc"
    log "Đã thêm fnm vào .bashrc"
  fi

  # Node.js 22
  if ! command -v node &>/dev/null || [[ "$(node -v 2>/dev/null)" != v22* ]]; then
    info "Cài Node.js ${NODE_VERSION}..."
    fnm install "${NODE_VERSION}"
    fnm default "${NODE_VERSION}"
    fnm use "${NODE_VERSION}"
  fi
  log "Node $(node -v) — $(which node)"

  # pnpm
  if ! command -v pnpm &>/dev/null; then
    info "Cài pnpm..."
    npm install -g pnpm@latest &>/dev/null
  fi
  log "pnpm $(pnpm -v)"

  # PM2
  if ! command -v pm2 &>/dev/null; then
    info "Cài PM2..."
    npm install -g pm2 &>/dev/null
  fi
  log "PM2 $(pm2 -v)"
}

# ─── Step 2: Clone / Copy project ──────────────────────────────────────────
setup_project() {
  if [ -d "$PROJECT_DIR" ] && [ -f "$PROJECT_DIR/package.json" ]; then
    log "Project đã có tại $PROJECT_DIR"
    cd "$PROJECT_DIR"
    if git rev-parse --git-dir &>/dev/null; then
      info "Git pull bản mới nhất..."
      git pull origin main 2>/dev/null || warn "Git pull thất bại (bỏ qua)"
    fi
  else
    # Nếu script đang chạy từ trong project (đã clone sẵn)
    if [ -f "./package.json" ] && grep -q "trustroom" ./package.json 2>/dev/null; then
      PROJECT_DIR="$(pwd)"
      log "Đang chạy từ project directory: $PROJECT_DIR"
    else
      info "Clone project từ GitHub..."
      git clone -b feature/ui https://github.com/tutran27/trust-room-AI.git "$PROJECT_DIR"
      cd "$PROJECT_DIR"
    fi
  fi
}

# ─── Step 3: Môi trường ─────────────────────────────────────────────────────
setup_env() {
  cd "$PROJECT_DIR"

  if [ -f .env ]; then
    warn "File .env đã tồn tại — giữ nguyên"
    info "Nếu cần reset: cp .env.example .env rồi sửa"
  else
    info "Tạo .env từ .env.example..."
    cp .env.example .env
    # Random JWT secret
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s/JWT_SECRET=/JWT_SECRET=${JWT_SECRET}/" .env
    else
      sed -i "s/JWT_SECRET=/JWT_SECRET=${JWT_SECRET}/" .env
    fi
    log "Đã tạo .env"
    warn ">>> NHỚ sửa các API key: GROQ_API_KEY, AGORA_APP_ID, AGORA_APP_CERTIFICATE, SUPABASE_URL, SUPABASE_ANON_KEY"
  fi
}

# ─── Step 4: Docker services (PostgreSQL, Redis) ────────────────────────────
start_docker_services() {
  cd "$PROJECT_DIR"

  info "Khởi động PostgreSQL và Redis qua Docker..."

  # Tạo logs directory
  mkdir -p "${PROJECT_DIR}/logs"

  sudo docker compose -f infra/docker/docker-compose.yml up -d 2>&1 || {
    warn "Docker compose thất bại — thử docker-compose (có dấu gạch)..."
    sudo docker-compose -f infra/docker/docker-compose.yml up -d 2>/dev/null || {
      err "Không thể start Docker services. Kiểm tra: docker ps"
    }
  }
  log "Docker services started"

  # Đợi PostgreSQL ready (tối đa 30s)
  info "Đợi PostgreSQL sẵn sàng..."
  for i in $(seq 1 30); do
    if sudo docker exec trustroom-postgres pg_isready -U postgres -d trustroom &>/dev/null; then
      log "PostgreSQL ready!"
      break
    fi
    if [ "$i" -eq 30 ]; then
      warn "PostgreSQL chưa ready — kiểm tra: sudo docker logs trustroom-postgres"
    fi
    sleep 1
  done
}

# ─── Step 5: Install dependencies ───────────────────────────────────────────
install_deps() {
  cd "$PROJECT_DIR"

  info "Cài dependencies (pnpm install)..."
  pnpm install 2>&1 || err "pnpm install thất bại"
  log "pnpm install hoàn tất"
}

# ─── Step 6: Prisma setup ────────────────────────────────────────────────────
setup_prisma() {
  cd "$PROJECT_DIR"

  info "Generate Prisma client..."
  pnpm --filter @trustroom/db generate 2>&1 || err "Prisma generate thất bại"
  log "Prisma client generated"

  # Chạy migration
  info "Push database schema..."
  if pnpm --filter @trustroom/db db:push 2>&1; then
    log "Database schema pushed"
  else
    warn "db:push thất bại — thử migrate dev..."
    (cd packages/db && npx prisma migrate dev --name init 2>/dev/null) || \
      warn "Migration thất bại. Kiểm tra DATABASE_URL trong .env"
  fi

  # Seed (nếu --seed)
  if [ "${SEED_DB:-false}" = "true" ]; then
    info "Seed database..."
    (cd packages/db && node prisma/seed.js) 2>/dev/null || warn "Seed thất bại (bỏ qua)"
    log "DB seeded"
  fi
}

# ─── Step 7: Build ──────────────────────────────────────────────────────────
build_project() {
  cd "$PROJECT_DIR"

  info "Build project (turborepo)..."
  # Build từng package theo thứ tự để dễ debug nếu lỗi
  # (ui package là source-only, không có build script)
  pnpm --filter @trustroom/types build 2>&1 || err "types build failed"
  pnpm --filter @trustroom/ai build 2>&1    || err "ai build failed"
  pnpm --filter @trustroom/solana build 2>&1|| err "solana build failed"
  pnpm --filter @trustroom/tts build 2>&1   || err "tts build failed"
  pnpm --filter @trustroom/db build 2>&1    || err "db build failed"
  pnpm --filter @trustroom/api build 2>&1   || err "API build failed"
  pnpm --filter @trustroom/web build 2>&1   || err "Web build failed"

  log "Build hoàn tất!"
}

# ─── Step 8: Nginx reverse proxy ────────────────────────────────────────────
setup_nginx() {
  cd "$PROJECT_DIR"

  # Không cài nginx nếu chưa có
  if ! command -v nginx &>/dev/null; then
    warn "Nginx chưa được cài — cài qua: sudo apt install nginx"
    info "Hoặc dùng --skip-nginx để bỏ qua"
    sudo apt-get install -y -qq nginx ufw 2>/dev/null || {
      warn "Không thể cài nginx — bỏ qua"
      return
    }
  fi

  info "Cấu hình Nginx reverse proxy..."
  local domain="${PUBLIC_DOMAIN:-_}"  # _ = server IP

  sudo tee /etc/nginx/sites-available/trustroom.conf > /dev/null <<NGINX
server {
    listen 80;
    server_name ${domain};
    client_max_body_size 32m;

    # Web (Next.js)
    location / {
        proxy_pass http://127.0.0.1:${WEB_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # API
    location /api {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # WebSocket cho Socket.IO
    location /socket.io {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400s;
    }
}
NGINX

  sudo ln -sf /etc/nginx/sites-available/trustroom.conf /etc/nginx/sites-enabled/
  sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

  # Check config trước khi reload
  sudo nginx -t 2>&1 || {
    warn "Nginx config sai — kiểm tra: sudo nginx -t"
    return
  }
  sudo systemctl reload nginx 2>/dev/null || sudo nginx -s reload 2>/dev/null || true

  # Firewall
  sudo ufw allow 80/tcp 2>/dev/null || true
  sudo ufw allow 443/tcp 2>/dev/null || true

  log "Nginx config done (domain: ${domain})"
}

# ─── Step 9: Start services với PM2 ───────────────────────────────────────
start_services() {
  cd "$PROJECT_DIR"

  info "Khởi động services với PM2..."

  # Dừng các process cũ (nếu có)
  pm2 delete trustroom-api 2>/dev/null || true
  pm2 delete trustroom-web 2>/dev/null || true
  mkdir -p "${PROJECT_DIR}/logs"

  # API — dùng ecosystem file inline
  cat > "${PROJECT_DIR}/ecosystem.config.cjs" <<'ECOSYSTEM'
module.exports = {
  apps: [
    {
      name: 'trustroom-api',
      cwd: './apps/api',
      script: './dist/main.js',
      interpreter: 'node',
      env_file: './.env',
      log_file: './logs/api.log',
      error_file: './logs/api-err.log',
      max_memory_restart: '512M',
      restart_delay: 3000,
      wait_ready: true,
      listen_timeout: 30000,
      kill_timeout: 10000,
    },
    {
      name: 'trustroom-web',
      cwd: './apps/web',
      script: '.next/standalone/apps/web/server.js',
      interpreter: 'node',
      env_file: './.env',
      log_file: './logs/web.log',
      error_file: './logs/web-err.log',
      max_memory_restart: '512M',
      restart_delay: 3000,
      kill_timeout: 10000,
    },
  ],
};
ECOSYSTEM

  pm2 start "${PROJECT_DIR}/ecosystem.config.cjs" 2>&1 || err "PM2 start thất bại"
  pm2 save
  pm2 startup systemd -u "$USER" 2>/dev/null || true

  log "Services started! Kiểm tra: pm2 status"
}

# ─── Step 10: Verify ────────────────────────────────────────────────────────
verify() {
  info "Kiểm tra services (đợi 5s để services khởi động)..."
  sleep 5

  # API health check
  if curl -sf "http://localhost:${API_PORT}/api/health" > /dev/null 2>&1; then
    log "API: http://localhost:${API_PORT}/api/health — OK"
  else
    warn "API health check không phản hồi"
    info "Xem log: pm2 logs trustroom-api --lines 30"
  fi

  # Web check
  if curl -sf -o /dev/null "http://localhost:${WEB_PORT}" 2>&1; then
    log "Web: http://localhost:${WEB_PORT} — OK"
  else
    warn "Web không phản hồi"
    info "Xem log: pm2 logs trustroom-web --lines 30"
  fi

  # Nginx
  if command -v nginx &>/dev/null && curl -sf -o /dev/null "http://localhost" 2>&1; then
    log "Nginx reverse proxy: http://localhost — OK"
  fi
}

# ─── Help ─────────────────────────────────────────────────────────────────────
show_help() {
    echo ""
    echo "TrustRoom AI — Deploy Script"
    echo ""
    echo "Usage: bash scripts/deploy-vps.sh [options]"
    echo ""
    echo "Options:"
    echo "  --seed         Seed database sau khi migrate"
    echo "  --domain NAME  Public domain (mặc định: server IP)"
    echo "  --skip-nginx   Bỏ qua cấu hình Nginx"
    echo "  --skip-docker  Bỏ qua Docker services"
    echo "  --help         Show this help"
    echo ""
    echo "Sau khi chạy, NHỚ sửa .env với API key:"
    echo "  nano ${PROJECT_DIR}/.env && pm2 restart all"
    echo ""
    echo "API keys cần: GROQ_API_KEY, AGORA_APP_ID, AGORA_APP_CERTIFICATE,"
    echo "SUPABASE_URL, SUPABASE_ANON_KEY, SOLANA_RPC_URL"
    echo ""
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
  # Parse flags
  SEED_DB=false
  PUBLIC_DOMAIN=""
  SKIP_NGINX=false
  SKIP_DOCKER=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --seed)        SEED_DB=true; shift ;;
      --domain)      PUBLIC_DOMAIN="$2"; shift 2 ;;
      --skip-nginx)  SKIP_NGINX=true; shift ;;
      --skip-docker) SKIP_DOCKER=true; shift ;;
      --help|-h)     show_help; exit 0 ;;
      *)             warn "Unknown option: $1"; shift ;;
    esac
  done

  echo ""
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║        TrustRoom AI — VPS Deployment                ║"
  echo "╚══════════════════════════════════════════════════════╝"
  echo ""

  check_os
  install_system_deps
  setup_project
  setup_env

  if [ "$SKIP_DOCKER" = false ]; then
    start_docker_services
  fi

  install_deps
  setup_prisma
  build_project

  if [ "$SKIP_NGINX" = false ]; then
    setup_nginx
  fi

  start_services
  verify

  # Summary
  local ip
  ip=$(curl -sf ifconfig.me 2>/dev/null || echo "<IP_VPS>")

  echo ""
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║            Deploy hoàn tất!                         ║"
  echo "╠══════════════════════════════════════════════════════╣"
  echo "║ Web:       http://${ip}:${WEB_PORT}                     ║"
  echo "║ API:       http://${ip}:${API_PORT}/api/health          ║"
  echo "║                                                      ║"
  echo "║ PM2:       pm2 status / pm2 logs                     ║"
  echo "║ Restart:   pm2 restart all                           ║"
  echo "║                                                      ║"
  echo "║ >>> NHỚ sửa .env: nano ${PROJECT_DIR}/.env       ║"
  echo "║ >>> Rồi:     pm2 restart all                         ║"
  echo "╚══════════════════════════════════════════════════════╝"
  echo ""
}

main "$@"
