# TrustRoom Escrow (Solana / Anchor)

On-chain escrow program for TrustRoom AI. Locks buyer funds and enforces deal state
transitions. **AI never moves funds** — only the buyer (release) or the dispute
authority (resolve_dispute) can.

> ⚠️ **Skeleton.** State transitions and accounts are scaffolded; the SPL-token
> transfers in `deposit` / `release` / `refund` / `resolve_dispute` are marked
> `TODO` and must be implemented (via `anchor-spl`) before any devnet deployment.

## Layout

```
programs/escrow/
  Anchor.toml                       # Anchor workspace config
  Cargo.toml                        # Rust workspace (members = programs/*)
  programs/escrow/                  # the program crate (trustroom_escrow)
    Cargo.toml
    src/lib.rs
  tests/                            # ts-mocha integration tests (to add)
```

## Program instructions

`initialize_deal` · `deposit` · `confirm_terms` · `submit_delivery` · `release`
· `refund` · `raise_dispute` · `resolve_dispute`

On-chain `EscrowAccount` stores only: `deal_id_hash`, `buyer`, `seller`,
`token_mint`, `amount`, `state`, `terms_hash`, `evidence_hash`, `created_at`.
No transcript / PII / media ever goes on-chain.

## Toolchain (not installed in this environment)

This program cannot be built here — install the Solana/Rust/Anchor toolchain first:

```bash
# 1. Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# 3. Anchor via avm (pin 0.30.1 to match @coral-xyz/anchor)
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.30.1 && avm use 0.30.1

# 4. Build & test (from this directory)
anchor build
anchor test            # spins up a local validator
```

On Windows, use WSL2 for the Solana/Anchor toolchain — native Windows support is limited.

## After build

`anchor build` emits the IDL + TS types under `target/`. Generate the program ID
with `anchor keys sync`, then set `ESCROW_PROGRAM_ID` in `.env` and update
`declare_id!` / `Anchor.toml`.
