#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

declare_id!("9P3DhxcewypThYYGDkAhxxE5AfcaxNcEsBwdNrtbSojs");

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

    /// Increment counter sebesar amount yang ditentukan
    pub fn increment(ctx: Context<Update>, amount: i64) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = counter.count.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        msg!("Counter incremented by {}! Total Count: {}", amount, counter.count);
        Ok(())
    }

    /// Decrement counter sebesar amount yang ditentukan
    pub fn decrement(ctx: Context<Update>, amount: i64) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = counter.count.checked_sub(amount).ok_or(ErrorCode::Underflow)?;
        msg!("Counter decremented by {}! Total Count: {}", amount, counter.count);
        Ok(())
    }

    /// Reset counter ke 0
    pub fn reset(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = 0;
        msg!("Counter reset! Count: {}", counter.count);
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
