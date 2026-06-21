//! TrustRoom AI escrow program.
//!
//! Locks buyer funds (SOL) for a deal and enforces state transitions.
//! AI never calls release/refund — only the authorized buyer (release)
//! or dispute resolution authority (resolve_dispute) can move funds.

use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("3DyccqgiVSUupDEfgvME8rduMHAgJdLxqhGEdPuhbjR7");

#[program]
pub mod trustroom_escrow {
    use super::*;

    pub fn initialize_deal(
        ctx: Context<InitializeDeal>,
        deal_id_hash: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        escrow.deal_id_hash = deal_id_hash;
        escrow.buyer = ctx.accounts.buyer.key();
        escrow.seller = ctx.accounts.seller.key();
        escrow.amount = amount;
        escrow.state = EscrowState::Initialized;
        escrow.terms_hash = [0u8; 32];
        escrow.evidence_hash = [0u8; 32];
        escrow.created_at = Clock::get()?.unix_timestamp;
        escrow.bump = ctx.bumps.escrow;

        // Create vault PDA via system_program::create_account
        let vault_bump = ctx.bumps.vault;
        let vault_seeds: &[&[u8]] = &[b"vault", deal_id_hash.as_ref(), &[vault_bump]];
        let vault_lamports = Rent::get()?.minimum_balance(0);

        system_program::create_account(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::CreateAccount {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
                &[vault_seeds],
            ),
            vault_lamports,
            0, // space
            &ctx.program_id, // owner = this program
        )?;

        emit!(EscrowCreated {
            deal_id_hash,
            buyer: escrow.buyer,
            seller: escrow.seller,
            amount,
        });
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.state == EscrowState::Initialized, EscrowError::InvalidState);

        // Transfer SOL: buyer → vault PDA
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &ctx.accounts.vault.key(),
            escrow.amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.vault.to_account_info(),
            ],
        )?;

        escrow.state = EscrowState::Deposited;
        emit!(EscrowStateChanged {
            deal_id_hash: escrow.deal_id_hash,
            state: escrow.state,
        });
        Ok(())
    }

    pub fn confirm_terms(ctx: Context<Mutate>, terms_hash: [u8; 32]) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.state == EscrowState::Deposited, EscrowError::InvalidState);
        escrow.terms_hash = terms_hash;
        escrow.state = EscrowState::TermsConfirmed;
        emit!(EscrowStateChanged {
            deal_id_hash: escrow.deal_id_hash,
            state: escrow.state,
        });
        Ok(())
    }

    pub fn submit_delivery(ctx: Context<Mutate>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.state == EscrowState::TermsConfirmed, EscrowError::InvalidState);
        escrow.state = EscrowState::DeliverySubmitted;
        emit!(EscrowStateChanged {
            deal_id_hash: escrow.deal_id_hash,
            state: escrow.state,
        });
        Ok(())
    }

    pub fn release(ctx: Context<Release>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(
            escrow.state == EscrowState::DeliverySubmitted,
            EscrowError::ReleaseBeforeDelivery
        );
        require_keys_eq!(ctx.accounts.buyer.key(), escrow.buyer, EscrowError::Unauthorized);

        // Transfer SOL: vault PDA → seller
        **ctx.accounts.vault.try_borrow_mut_lamports()? -= escrow.amount;
        **ctx.accounts.seller.try_borrow_mut_lamports()? += escrow.amount;

        escrow.state = EscrowState::Released;
        emit!(EscrowReleased {
            deal_id_hash: escrow.deal_id_hash,
            amount: escrow.amount,
        });
        Ok(())
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(
            matches!(escrow.state, EscrowState::Deposited | EscrowState::TermsConfirmed),
            EscrowError::InvalidState
        );

        // Transfer SOL: vault PDA → buyer
        **ctx.accounts.vault.try_borrow_mut_lamports()? -= escrow.amount;
        **ctx.accounts.buyer.try_borrow_mut_lamports()? += escrow.amount;

        escrow.state = EscrowState::Refunded;
        emit!(EscrowRefunded {
            deal_id_hash: escrow.deal_id_hash,
            amount: escrow.amount,
        });
        Ok(())
    }

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
        emit!(EscrowStateChanged {
            deal_id_hash: escrow.deal_id_hash,
            state: escrow.state,
        });
        Ok(())
    }

    pub fn resolve_dispute(ctx: Context<ResolveDispute>, outcome: DisputeOutcome) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.state == EscrowState::Disputed, EscrowError::InvalidState);

        match outcome {
            DisputeOutcome::Release => {
                **ctx.accounts.vault.try_borrow_mut_lamports()? -= escrow.amount;
                **ctx.accounts.seller.try_borrow_mut_lamports()? += escrow.amount;
            }
            DisputeOutcome::Refund => {
                **ctx.accounts.vault.try_borrow_mut_lamports()? -= escrow.amount;
                **ctx.accounts.buyer.try_borrow_mut_lamports()? += escrow.amount;
            }
            DisputeOutcome::Split => {
                let half = escrow.amount / 2;
                let seller_amount = half;
                let buyer_amount = escrow.amount - half;
                **ctx.accounts.vault.try_borrow_mut_lamports()? -= escrow.amount;
                **ctx.accounts.seller.try_borrow_mut_lamports()? += seller_amount;
                **ctx.accounts.buyer.try_borrow_mut_lamports()? += buyer_amount;
            }
        }

        escrow.state = EscrowState::Resolved;
        emit!(EscrowResolved {
            deal_id_hash: escrow.deal_id_hash,
            outcome,
        });
        Ok(())
    }
}

// ── Account Structs ─────────────────────────────────────────────────────────

#[account]
pub struct EscrowAccount {
    pub deal_id_hash: [u8; 32],
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub amount: u64,
    pub state: EscrowState,
    pub terms_hash: [u8; 32],
    pub evidence_hash: [u8; 32],
    pub created_at: i64,
    pub bump: u8,
}

impl EscrowAccount {
    // discriminator(8) + deal_id_hash(32) + buyer(32) + seller(32) + amount(8)
    // + state(1) + terms_hash(32) + evidence_hash(32) + created_at(8) + bump(1)
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 8 + 1 + 32 + 32 + 8 + 1;
}

// ── Enums ───────────────────────────────────────────────────────────────────

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

// ── Events ──────────────────────────────────────────────────────────────────

#[event]
pub struct EscrowCreated {
    pub deal_id_hash: [u8; 32],
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub amount: u64,
}

#[event]
pub struct EscrowStateChanged {
    pub deal_id_hash: [u8; 32],
    pub state: EscrowState,
}

#[event]
pub struct EscrowReleased {
    pub deal_id_hash: [u8; 32],
    pub amount: u64,
}

#[event]
pub struct EscrowRefunded {
    pub deal_id_hash: [u8; 32],
    pub amount: u64,
}

#[event]
pub struct EscrowResolved {
    pub deal_id_hash: [u8; 32],
    pub outcome: DisputeOutcome,
}

// ── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum EscrowError {
    #[msg("Action is not valid in the current escrow state.")]
    InvalidState,
    #[msg("Cannot release escrow before delivery has been submitted.")]
    ReleaseBeforeDelivery,
    #[msg("Signer is not authorized for this action.")]
    Unauthorized,
}

// ── Context Structs ─────────────────────────────────────────────────────────

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

    /// CHECK: vault PDA — holds SOL balance
    #[account(
        mut,
        seeds = [b"vault", deal_id_hash.as_ref()],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: stored for reference only; validated off-chain.
    pub seller: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut, seeds = [b"escrow", escrow.deal_id_hash.as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, EscrowAccount>,

    /// CHECK: vault PDA — holds SOL balance
    #[account(mut, seeds = [b"vault", escrow.deal_id_hash.as_ref()], bump)]
    pub vault: AccountInfo<'info>,

    #[account(mut, address = escrow.buyer)]
    pub buyer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Mutate<'info> {
    #[account(mut, seeds = [b"escrow", escrow.deal_id_hash.as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, EscrowAccount>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Release<'info> {
    #[account(mut, seeds = [b"escrow", escrow.deal_id_hash.as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, EscrowAccount>,

    /// CHECK: vault PDA — holds SOL balance
    #[account(mut, seeds = [b"vault", escrow.deal_id_hash.as_ref()], bump)]
    pub vault: AccountInfo<'info>,

    /// Only the buyer can release.
    #[account(address = escrow.buyer)]
    pub buyer: Signer<'info>,

    /// CHECK: seller wallet to receive SOL
    #[account(mut, address = escrow.seller)]
    pub seller: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut, seeds = [b"escrow", escrow.deal_id_hash.as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, EscrowAccount>,

    /// CHECK: vault PDA — holds SOL balance
    #[account(mut, seeds = [b"vault", escrow.deal_id_hash.as_ref()], bump)]
    pub vault: AccountInfo<'info>,

    /// Only the buyer can request refund.
    #[account(address = escrow.buyer)]
    pub buyer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(mut, seeds = [b"escrow", escrow.deal_id_hash.as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, EscrowAccount>,

    /// CHECK: vault PDA — holds SOL balance
    #[account(mut, seeds = [b"vault", escrow.deal_id_hash.as_ref()], bump)]
    pub vault: AccountInfo<'info>,

    /// Only the buyer (as dispute authority for MVP) can resolve.
    #[account(address = escrow.buyer)]
    pub authority: Signer<'info>,

    /// CHECK: seller wallet
    #[account(mut, address = escrow.seller)]
    pub seller: AccountInfo<'info>,

    /// CHECK: buyer wallet (for refund/split)
    #[account(mut, address = escrow.buyer)]
    pub buyer: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}
