#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

declare_id!("EaRJascHaUBn9KAdGNqtsj4ZnzkkDm4ZYCEeBp77aQUM");

#[program]
pub mod vespercount {
    use super::*;

    /// Inisialisasi akun counter baru (PDA) dengan nilai awal 0
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = 0;
        counter.authority = ctx.accounts.authority.key();
        counter.bump = ctx.bumps.counter;
        msg!("Counter initialized! Count: {}", counter.count);
        Ok(())
    }

    /// Increment counter sebesar 1
    pub fn increment(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = counter.count.checked_add(1).ok_or(ErrorCode::Overflow)?;
        msg!("Counter incremented! Count: {}", counter.count);
        Ok(())
    }

    /// Decrement counter sebesar 1
    pub fn decrement(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = counter.count.checked_sub(1).ok_or(ErrorCode::Underflow)?;
        msg!("Counter decremented! Count: {}", counter.count);
        Ok(())
    }
}

// ─── Account Structs ─────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = Counter::LEN,
        seeds = [b"counter", authority.key().as_ref()],
        bump
    )]
    pub counter: Account<'info, Counter>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(
        mut,
        seeds = [b"counter", authority.key().as_ref()],
        bump = counter.bump,
        has_one = authority
    )]
    pub counter: Account<'info, Counter>,

    pub authority: Signer<'info>,
}

// ─── Data Account ─────────────────────────────────────────────────────────────

#[account]
pub struct Counter {
    pub authority: Pubkey, // 32 bytes
    pub count: i64,        // 8 bytes (signed agar bisa negatif)
    pub bump: u8,          // 1 byte  (PDA bump seed)
}

impl Counter {
    // discriminator (8) + authority (32) + count (8) + bump (1)
    pub const LEN: usize = 8 + 32 + 8 + 1;
}

// ─── Custom Errors ────────────────────────────────────────────────────────────

#[error_code]
pub enum ErrorCode {
    #[msg("Counter overflow: nilai sudah mencapai batas maksimum.")]
    Overflow,
    #[msg("Counter underflow: nilai sudah mencapai batas minimum.")]
    Underflow,
}
