use anchor_lang::prelude::*;

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

        emit!(EscrowCreated {
            deal_id_hash,
            buyer: escrow.buyer,
            seller: escrow.seller,
            amount,
        });
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>) -> Result<()> {
        let amount = ctx.accounts.escrow.amount;
        require!(ctx.accounts.escrow.state == EscrowState::Initialized, EscrowError::InvalidState);

        let escrow_key = ctx.accounts.escrow.to_account_info().key();
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &escrow_key,
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.escrow.to_account_info(),
            ],
        )?;

        let escrow = &mut ctx.accounts.escrow;
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
        let amount = ctx.accounts.escrow.amount;
        require!(
            ctx.accounts.escrow.state == EscrowState::DeliverySubmitted,
            EscrowError::ReleaseBeforeDelivery
        );
        require_keys_eq!(ctx.accounts.buyer.key(), ctx.accounts.escrow.buyer, EscrowError::Unauthorized);

        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += amount;

        let escrow = &mut ctx.accounts.escrow;
        escrow.state = EscrowState::Released;
        emit!(EscrowReleased {
            deal_id_hash: escrow.deal_id_hash,
            amount,
        });
        Ok(())
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let amount = ctx.accounts.escrow.amount;
        require!(
            matches!(ctx.accounts.escrow.state, EscrowState::Deposited | EscrowState::TermsConfirmed),
            EscrowError::InvalidState
        );

        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.buyer.to_account_info().try_borrow_mut_lamports()? += amount;

        let escrow = &mut ctx.accounts.escrow;
        escrow.state = EscrowState::Refunded;
        emit!(EscrowRefunded {
            deal_id_hash: escrow.deal_id_hash,
            amount,
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
        let amount = ctx.accounts.escrow.amount;
        require!(ctx.accounts.escrow.state == EscrowState::Disputed, EscrowError::InvalidState);

        match outcome {
            DisputeOutcome::Release => {
                **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= amount;
                **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += amount;
            }
            DisputeOutcome::Refund => {
                **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= amount;
                **ctx.accounts.buyer.to_account_info().try_borrow_mut_lamports()? += amount;
            }
            DisputeOutcome::Split => {
                let half = amount / 2;
                **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= amount;
                **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += half;
                **ctx.accounts.buyer.to_account_info().try_borrow_mut_lamports()? += amount - half;
            }
        }

        let escrow = &mut ctx.accounts.escrow;
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

    #[account(address = escrow.buyer)]
    pub buyer: Signer<'info>,

    /// CHECK: seller wallet to receive SOL
    #[account(mut, address = escrow.seller)]
    pub seller: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut, seeds = [b"escrow", escrow.deal_id_hash.as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, EscrowAccount>,

    #[account(address = escrow.buyer)]
    pub buyer: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(mut, seeds = [b"escrow", escrow.deal_id_hash.as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, EscrowAccount>,

    #[account(address = escrow.buyer)]
    pub authority: Signer<'info>,

    /// CHECK: seller wallet
    #[account(mut, address = escrow.seller)]
    pub seller: AccountInfo<'info>,

    /// CHECK: buyer wallet
    #[account(mut, address = escrow.buyer)]
    pub buyer: AccountInfo<'info>,
}
