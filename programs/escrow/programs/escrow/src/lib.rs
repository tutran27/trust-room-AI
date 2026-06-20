//! TrustRoom AI escrow program (skeleton).
//!
//! Locks buyer funds for a deal and enforces state transitions. AI never calls
//! release/refund — only the authorized buyer (release) or dispute resolution
//! authority (resolve_dispute) can move funds. On-chain we store only minimal,
//! non-sensitive data: pubkeys, amount, state, and the terms/evidence hashes.
//!
//! NOTE: This is an unimplemented scaffold. Function bodies validate state and
//! emit events; SPL-token transfers (deposit/release/refund) are marked TODO and
//! must be wired to `anchor_spl::token` before devnet deployment.

use anchor_lang::prelude::*;

declare_id!("Escrow111111111111111111111111111111111111");

#[program]
pub mod trustroom_escrow {
    use super::*;

    /// Create the escrow account (PDA) for a deal and record the agreed metadata.
    pub fn initialize_deal(
        ctx: Context<InitializeDeal>,
        deal_id_hash: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        escrow.deal_id_hash = deal_id_hash;
        escrow.buyer = ctx.accounts.buyer.key();
        escrow.seller = ctx.accounts.seller.key();
        escrow.token_mint = ctx.accounts.token_mint.key();
        escrow.amount = amount;
        escrow.state = EscrowState::Initialized;
        escrow.terms_hash = [0u8; 32];
        escrow.evidence_hash = [0u8; 32];
        escrow.created_at = Clock::get()?.unix_timestamp;
        escrow.bump = ctx.bumps.escrow;
        emit!(EscrowEvent { deal_id_hash, state: escrow.state });
        Ok(())
    }

    /// Buyer deposits `amount` of the SPL token into the escrow vault.
    pub fn deposit(ctx: Context<Deposit>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.state == EscrowState::Initialized, EscrowError::InvalidState);
        // TODO: anchor_spl::token::transfer(buyer_ata -> vault, escrow.amount)
        escrow.state = EscrowState::Deposited;
        emit!(EscrowEvent { deal_id_hash: escrow.deal_id_hash, state: escrow.state });
        Ok(())
    }

    /// Record that both parties signed the canonical terms hash (verified off-chain).
    pub fn confirm_terms(ctx: Context<Mutate>, terms_hash: [u8; 32]) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.state == EscrowState::Deposited, EscrowError::InvalidState);
        escrow.terms_hash = terms_hash;
        escrow.state = EscrowState::TermsConfirmed;
        emit!(EscrowEvent { deal_id_hash: escrow.deal_id_hash, state: escrow.state });
        Ok(())
    }

    /// Seller marks delivery as submitted (proof stored off-chain in Evidence Vault).
    pub fn submit_delivery(ctx: Context<Mutate>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.state == EscrowState::TermsConfirmed, EscrowError::InvalidState);
        escrow.state = EscrowState::DeliverySubmitted;
        emit!(EscrowEvent { deal_id_hash: escrow.deal_id_hash, state: escrow.state });
        Ok(())
    }

    /// Buyer releases funds to the seller. Invalid before delivery is submitted.
    pub fn release(ctx: Context<Settle>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(
            escrow.state == EscrowState::DeliverySubmitted,
            EscrowError::ReleaseBeforeDelivery
        );
        require_keys_eq!(ctx.accounts.authority.key(), escrow.buyer, EscrowError::Unauthorized);
        // TODO: anchor_spl::token::transfer(vault -> seller_ata, escrow.amount)
        escrow.state = EscrowState::Released;
        emit!(EscrowEvent { deal_id_hash: escrow.deal_id_hash, state: escrow.state });
        Ok(())
    }

    /// Refund the buyer (timeout / mutual cancel before release).
    pub fn refund(ctx: Context<Settle>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(
            matches!(escrow.state, EscrowState::Deposited | EscrowState::TermsConfirmed),
            EscrowError::InvalidState
        );
        // TODO: anchor_spl::token::transfer(vault -> buyer_ata, escrow.amount)
        escrow.state = EscrowState::Refunded;
        emit!(EscrowEvent { deal_id_hash: escrow.deal_id_hash, state: escrow.state });
        Ok(())
    }

    /// Either party raises a dispute, freezing funds until resolution.
    pub fn raise_dispute(ctx: Context<Mutate>, evidence_hash: [u8; 32]) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(
            !matches!(
                escrow.state,
                EscrowState::Released | EscrowState::Refunded | EscrowState::Resolved
            ),
            EscrowError::InvalidState
        );
        escrow.evidence_hash = evidence_hash;
        escrow.state = EscrowState::Disputed;
        emit!(EscrowEvent { deal_id_hash: escrow.deal_id_hash, state: escrow.state });
        Ok(())
    }

    /// Dispute resolution authority settles a disputed deal (release / refund / split).
    pub fn resolve_dispute(ctx: Context<Settle>, outcome: DisputeOutcome) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.state == EscrowState::Disputed, EscrowError::InvalidState);
        // TODO: distribute funds according to `outcome`
        let _ = outcome;
        escrow.state = EscrowState::Resolved;
        emit!(EscrowEvent { deal_id_hash: escrow.deal_id_hash, state: escrow.state });
        Ok(())
    }
}

#[account]
pub struct EscrowAccount {
    pub deal_id_hash: [u8; 32],
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub state: EscrowState,
    pub terms_hash: [u8; 32],
    pub evidence_hash: [u8; 32],
    pub created_at: i64,
    pub bump: u8,
}

impl EscrowAccount {
    // discriminator(8) + 32 + 32 + 32 + 32 + 8 + 1 + 32 + 32 + 8 + 1
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 32 + 8 + 1 + 32 + 32 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum EscrowState {
    Initialized,
    Deposited,
    TermsConfirmed,
    DeliverySubmitted,
    Released,
    Refunded,
    Disputed,
    Resolved,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum DisputeOutcome {
    Release,
    Refund,
    Split,
}

#[event]
pub struct EscrowEvent {
    pub deal_id_hash: [u8; 32],
    pub state: EscrowState,
}

#[error_code]
pub enum EscrowError {
    #[msg("Action is not valid in the current escrow state.")]
    InvalidState,
    #[msg("Cannot release escrow before delivery has been submitted.")]
    ReleaseBeforeDelivery,
    #[msg("Signer is not authorized for this action.")]
    Unauthorized,
}

#[derive(Accounts)]
#[instruction(deal_id_hash: [u8; 32])]
pub struct InitializeDeal<'info> {
    #[account(
        init,
        payer = buyer,
        space = EscrowAccount::SPACE,
        seeds = [b"escrow", deal_id_hash.as_ref()],
        bump
    )]
    pub escrow: Account<'info, EscrowAccount>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// CHECK: stored for reference only; validated off-chain.
    pub seller: UncheckedAccount<'info>,
    /// CHECK: SPL mint of the escrowed token.
    pub token_mint: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut, seeds = [b"escrow", escrow.deal_id_hash.as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, EscrowAccount>,
    #[account(mut, address = escrow.buyer)]
    pub buyer: Signer<'info>,
}

#[derive(Accounts)]
pub struct Mutate<'info> {
    #[account(mut, seeds = [b"escrow", escrow.deal_id_hash.as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, EscrowAccount>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(mut, seeds = [b"escrow", escrow.deal_id_hash.as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, EscrowAccount>,
    pub authority: Signer<'info>,
}
