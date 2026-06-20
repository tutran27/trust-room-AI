# Infra

Local development services for TrustRoom AI.

## Local services (Docker)

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

Brings up:

| Service  | Port        | Purpose                                  |
|----------|-------------|------------------------------------------|
| Postgres | 5432        | Primary database (Prisma)                |
| Redis    | 6379        | BullMQ queues / cache                    |
| Qdrant   | 6333 / 6334 | Vector DB for scam-playbook similarity   |

Match these to `.env` (`DATABASE_URL`, `REDIS_URL`, `QDRANT_URL`).

Stop & remove:

```bash
docker compose -f infra/docker/docker-compose.yml down        # keep volumes
docker compose -f infra/docker/docker-compose.yml down -v     # wipe data
```

## Deployment targets

- **Web** (`apps/web`) → Vercel
- **API** (`apps/api`) → Railway
- **Database / Storage** → Supabase (Postgres + Storage bucket `evidence`)
- **Escrow program** (`programs/escrow`) → Solana devnet (see `programs/escrow/README.md`)
