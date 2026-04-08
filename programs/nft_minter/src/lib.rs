#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_master_edition_v3, create_metadata_accounts_v3, CreateMasterEditionV3,
        CreateMetadataAccountsV3,
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};
use mpl_token_metadata::types::DataV2;

// The official VesperCount Treasury Address (Hardcoded for demo)
// Replace with the real treasury pubkey on Mainnet.
// Using a dummy address here.
pub const TREASURY_ADDRESS: &str = "HQ4yY5sLhHntJzUWe7nDBXp8H2K2S4aXWz8S1L4H4Bqw";

declare_id!("GH5zJpDnndzAidTPmhbnPNQDWXadcrMK9Kz9b1rcCj1t");

#[program]
pub mod nft_minter {
    use super::*;
    use std::str::FromStr;

    pub fn mint_nft(
        ctx: Context<MintNft>,
        name: String,
        symbol: String,
        uri: String,
        seller_fee_basis_points: u16,
        max_supply: Option<u64>,
    ) -> Result<()> {
        msg!("Validating inputs...");
        
        // 1. Memory Sanitization (Rent Cost Mitigation)
        require!(name.len() <= 32, ErrorCode::NameTooLong);
        require!(symbol.len() <= 10, ErrorCode::SymbolTooLong);
        require!(uri.len() <= 200, ErrorCode::UriTooLong);

        // 2. Access Control / Monetization (0.05 SOL Fee)
        let expected_treasury = Pubkey::from_str(TREASURY_ADDRESS).unwrap();
        require!(ctx.accounts.treasury.key() == expected_treasury, ErrorCode::InvalidTreasury);

        let fee_lamports: u64 = 50_000_000; // 0.05 SOL
        let transfer_cpi_accounts = system_program::Transfer {
            from: ctx.accounts.signer.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
        };
        let transfer_cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_cpi_accounts,
        );
        system_program::transfer(transfer_cpi_ctx, fee_lamports)?;
        msg!("Minting fee of 0.05 SOL collected to treasury.");

        msg!("Minting NFT...");

        // 3. Mint 1 token to the user's ATA
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.signer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        mint_to(cpi_ctx, 1)?;
        msg!("Token minted successfully.");

        // 4. Create Metadata Account
        let cpi_accounts = CreateMetadataAccountsV3 {
            metadata: ctx.accounts.metadata.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            mint_authority: ctx.accounts.signer.to_account_info(),
            payer: ctx.accounts.signer.to_account_info(),
            update_authority: ctx.accounts.signer.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_metadata_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        let data_v2 = DataV2 {
            name,
            symbol,
            uri,
            seller_fee_basis_points,
            creators: None,
            collection: None,
            uses: None,
        };

        create_metadata_accounts_v3(cpi_ctx, data_v2, false, true, None)?;
        msg!("Metadata created successfully.");

        // 5. Create Master Edition Account
        let cpi_accounts = CreateMasterEditionV3 {
            edition: ctx.accounts.master_edition.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            update_authority: ctx.accounts.signer.to_account_info(),
            mint_authority: ctx.accounts.signer.to_account_info(),
            payer: ctx.accounts.signer.to_account_info(),
            metadata: ctx.accounts.metadata.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_metadata_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        create_master_edition_v3(cpi_ctx, max_supply)?;
        msg!("Master Edition created successfully.");

        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintNft<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    /// CHECK: The treasury account receiving the minting fee. Validation done in instruction.
    #[account(mut)]
    pub treasury: SystemAccount<'info>,

    #[account(
        init,
        payer = signer,
        mint::decimals = 0,
        mint::authority = signer,
        mint::freeze_authority = signer,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = signer,
    )]
    pub token_account: Account<'info, TokenAccount>,

    /// CHECK: Metaplex metadata account
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: Metaplex master edition account
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    
    /// CHECK: Metaplex Token Metadata Program
    pub token_metadata_program: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Provided Name exceeds the maximum length of 32 characters.")]
    NameTooLong,
    #[msg("Provided Symbol exceeds the maximum length of 10 characters.")]
    SymbolTooLong,
    #[msg("Provided URI exceeds the maximum length of 200 characters.")]
    UriTooLong,
    #[msg("Invalid Treasury Address provided.")]
    InvalidTreasury,
}
