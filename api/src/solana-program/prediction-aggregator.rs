/**
 * Prediction Market Aggregator - Solana Program
 *
 * On-chain vault that enables:
 * - Trustless deposits in SOL
 * - PDA-based vault accounts
 * - Oracle-verified market outcomes
 * - Automatic profit distribution
 *
 * Architecture:
 * - VaultAccount: User's aggregated balance and positions
 * - MarketAccount: Tracked prediction market with oracle data
 * - PositionAccount: User's position in a specific market
 * - OracleAccount: Authorized oracle for market resolution
 */

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("PRED111111111111111111111111111111111111111");

// ============================================================================
// Program
// ============================================================================

#[program]
pub mod prediction_aggregator {
    use super::*;

    /// Initialize the protocol with admin authority
    pub fn initialize(ctx: Context<Initialize>, protocol_fee_bps: u16) -> Result<()> {
        let protocol = &mut ctx.accounts.protocol;
        protocol.authority = ctx.accounts.authority.key();
        protocol.treasury = ctx.accounts.treasury.key();
        protocol.protocol_fee_bps = protocol_fee_bps;
        protocol.total_volume = 0;
        protocol.total_vaults = 0;
        protocol.bump = ctx.bumps.protocol;

        emit!(ProtocolInitialized {
            authority: protocol.authority,
            treasury: protocol.treasury,
            fee_bps: protocol_fee_bps,
        });

        Ok(())
    }

    /// Create a new vault for a user
    pub fn create_vault(ctx: Context<CreateVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.owner.key();
        vault.balance_lamports = 0;
        vault.total_deposited = 0;
        vault.total_withdrawn = 0;
        vault.total_pnl = 0;
        vault.position_count = 0;
        vault.created_at = Clock::get()?.unix_timestamp;
        vault.bump = ctx.bumps.vault;

        let protocol = &mut ctx.accounts.protocol;
        protocol.total_vaults += 1;

        emit!(VaultCreated {
            owner: vault.owner,
            vault: ctx.accounts.vault.key(),
        });

        Ok(())
    }

    /// Deposit SOL into vault
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, PredictionError::InvalidAmount);

        // Transfer SOL from user to vault PDA
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, amount)?;

        let vault = &mut ctx.accounts.vault;
        vault.balance_lamports += amount;
        vault.total_deposited += amount;

        emit!(Deposited {
            vault: ctx.accounts.vault.key(),
            owner: ctx.accounts.owner.key(),
            amount,
            new_balance: vault.balance_lamports,
        });

        Ok(())
    }

    /// Withdraw SOL from vault
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;

        require!(amount > 0, PredictionError::InvalidAmount);
        require!(vault.balance_lamports >= amount, PredictionError::InsufficientBalance);

        // Calculate protocol fee
        let protocol = &ctx.accounts.protocol;
        let fee = (amount as u128 * protocol.protocol_fee_bps as u128 / 10000) as u64;
        let net_amount = amount - fee;

        // Transfer SOL from vault PDA to user
        **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= net_amount;
        **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += net_amount;

        // Transfer fee to treasury
        if fee > 0 {
            **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= fee;
            **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += fee;
        }

        vault.balance_lamports -= amount;
        vault.total_withdrawn += amount;

        emit!(Withdrawn {
            vault: ctx.accounts.vault.key(),
            owner: ctx.accounts.owner.key(),
            amount: net_amount,
            fee,
            new_balance: vault.balance_lamports,
        });

        Ok(())
    }

    /// Register a new market for tracking
    pub fn register_market(
        ctx: Context<RegisterMarket>,
        market_id: String,
        platform: Platform,
        title: String,
        close_timestamp: i64,
    ) -> Result<()> {
        require!(market_id.len() <= 64, PredictionError::StringTooLong);
        require!(title.len() <= 256, PredictionError::StringTooLong);

        let market = &mut ctx.accounts.market;
        market.market_id = market_id.clone();
        market.platform = platform;
        market.title = title;
        market.yes_price = 5000; // 50% in basis points
        market.no_price = 5000;
        market.total_volume = 0;
        market.resolved = false;
        market.outcome = None;
        market.close_timestamp = close_timestamp;
        market.oracle = ctx.accounts.oracle.key();
        market.bump = ctx.bumps.market;

        emit!(MarketRegistered {
            market: ctx.accounts.market.key(),
            market_id,
            platform,
        });

        Ok(())
    }

    /// Update market price (oracle only)
    pub fn update_price(
        ctx: Context<UpdatePrice>,
        yes_price: u16,
        no_price: u16,
    ) -> Result<()> {
        require!(yes_price <= 10000, PredictionError::InvalidPrice);
        require!(no_price <= 10000, PredictionError::InvalidPrice);

        let market = &mut ctx.accounts.market;
        market.yes_price = yes_price;
        market.no_price = no_price;

        emit!(PriceUpdated {
            market: ctx.accounts.market.key(),
            yes_price,
            no_price,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Open a position in a market
    pub fn open_position(
        ctx: Context<OpenPosition>,
        side: Side,
        amount: u64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let market = &ctx.accounts.market;

        require!(!market.resolved, PredictionError::MarketResolved);
        require!(amount > 0, PredictionError::InvalidAmount);
        require!(vault.balance_lamports >= amount, PredictionError::InsufficientBalance);

        // Calculate quantity based on price
        let price = match side {
            Side::Yes => market.yes_price,
            Side::No => market.no_price,
        };
        let quantity = (amount as u128 * 10000 / price as u128) as u64;

        // Deduct from vault
        vault.balance_lamports -= amount;
        vault.position_count += 1;

        // Create position
        let position = &mut ctx.accounts.position;
        position.vault = ctx.accounts.vault.key();
        position.market = ctx.accounts.market.key();
        position.side = side;
        position.quantity = quantity;
        position.entry_price = price;
        position.amount_invested = amount;
        position.settled = false;
        position.pnl = 0;
        position.created_at = Clock::get()?.unix_timestamp;
        position.bump = ctx.bumps.position;

        emit!(PositionOpened {
            position: ctx.accounts.position.key(),
            vault: ctx.accounts.vault.key(),
            market: ctx.accounts.market.key(),
            side,
            quantity,
            price,
            amount,
        });

        Ok(())
    }

    /// Close a position before market resolution
    pub fn close_position(ctx: Context<ClosePosition>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let market = &ctx.accounts.market;
        let position = &mut ctx.accounts.position;

        require!(!market.resolved, PredictionError::MarketResolved);
        require!(!position.settled, PredictionError::PositionAlreadySettled);

        // Calculate current value
        let current_price = match position.side {
            Side::Yes => market.yes_price,
            Side::No => market.no_price,
        };
        let current_value = (position.quantity as u128 * current_price as u128 / 10000) as u64;

        // Calculate PnL
        let pnl = current_value as i64 - position.amount_invested as i64;

        // Return funds to vault
        vault.balance_lamports += current_value;
        vault.total_pnl += pnl;
        vault.position_count -= 1;

        position.settled = true;
        position.pnl = pnl;

        emit!(PositionClosed {
            position: ctx.accounts.position.key(),
            vault: ctx.accounts.vault.key(),
            value_returned: current_value,
            pnl,
        });

        Ok(())
    }

    /// Resolve a market (oracle only)
    pub fn resolve_market(
        ctx: Context<ResolveMarket>,
        outcome: Outcome,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;

        require!(!market.resolved, PredictionError::MarketAlreadyResolved);

        market.resolved = true;
        market.outcome = Some(outcome);

        emit!(MarketResolved {
            market: ctx.accounts.market.key(),
            outcome,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Settle a position after market resolution
    pub fn settle_position(ctx: Context<SettlePosition>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let market = &ctx.accounts.market;
        let position = &mut ctx.accounts.position;

        require!(market.resolved, PredictionError::MarketNotResolved);
        require!(!position.settled, PredictionError::PositionAlreadySettled);

        let outcome = market.outcome.ok_or(PredictionError::MarketNotResolved)?;

        // Calculate payout
        let payout = match (position.side, outcome) {
            (Side::Yes, Outcome::Yes) | (Side::No, Outcome::No) => {
                // Winner: gets quantity * $1 (10000 basis points)
                position.quantity
            }
            _ => {
                // Loser: gets nothing
                0
            }
        };

        let pnl = payout as i64 - position.amount_invested as i64;

        // Credit vault
        vault.balance_lamports += payout;
        vault.total_pnl += pnl;
        vault.position_count -= 1;

        position.settled = true;
        position.pnl = pnl;

        emit!(PositionSettled {
            position: ctx.accounts.position.key(),
            vault: ctx.accounts.vault.key(),
            payout,
            pnl,
        });

        Ok(())
    }

    /// Add an authorized oracle
    pub fn add_oracle(ctx: Context<AddOracle>, oracle: Pubkey) -> Result<()> {
        let oracle_account = &mut ctx.accounts.oracle_account;
        oracle_account.authority = oracle;
        oracle_account.markets_resolved = 0;
        oracle_account.active = true;
        oracle_account.bump = ctx.bumps.oracle_account;

        emit!(OracleAdded {
            oracle,
        });

        Ok(())
    }
}

// ============================================================================
// Accounts
// ============================================================================

#[account]
#[derive(Default)]
pub struct Protocol {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub protocol_fee_bps: u16,
    pub total_volume: u64,
    pub total_vaults: u64,
    pub bump: u8,
}

#[account]
#[derive(Default)]
pub struct Vault {
    pub owner: Pubkey,
    pub balance_lamports: u64,
    pub total_deposited: u64,
    pub total_withdrawn: u64,
    pub total_pnl: i64,
    pub position_count: u32,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct Market {
    pub market_id: String,      // External market ID (Kalshi ticker, etc.)
    pub platform: Platform,
    pub title: String,
    pub yes_price: u16,         // Price in basis points (0-10000)
    pub no_price: u16,
    pub total_volume: u64,
    pub resolved: bool,
    pub outcome: Option<Outcome>,
    pub close_timestamp: i64,
    pub oracle: Pubkey,
    pub bump: u8,
}

#[account]
pub struct Position {
    pub vault: Pubkey,
    pub market: Pubkey,
    pub side: Side,
    pub quantity: u64,
    pub entry_price: u16,
    pub amount_invested: u64,
    pub settled: bool,
    pub pnl: i64,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct OracleAccount {
    pub authority: Pubkey,
    pub markets_resolved: u64,
    pub active: bool,
    pub bump: u8,
}

// ============================================================================
// Enums
// ============================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Platform {
    Kalshi,
    Polymarket,
    Manifold,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    Yes,
    No,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    Yes,
    No,
    Invalid,
}

// ============================================================================
// Contexts
// ============================================================================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 2 + 8 + 8 + 1,
        seeds = [b"protocol"],
        bump
    )]
    pub protocol: Account<'info, Protocol>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Treasury account for protocol fees
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateVault<'info> {
    #[account(mut, seeds = [b"protocol"], bump = protocol.bump)]
    pub protocol: Account<'info, Protocol>,

    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 8 + 8 + 8 + 8 + 4 + 8 + 1,
        seeds = [b"vault", owner.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        constraint = vault.owner == owner.key()
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(seeds = [b"protocol"], bump = protocol.bump)]
    pub protocol: Account<'info, Protocol>,

    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        constraint = vault.owner == owner.key()
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: Protocol treasury for fees
    #[account(mut, constraint = treasury.key() == protocol.treasury)]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(market_id: String)]
pub struct RegisterMarket<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 64 + 1 + 256 + 2 + 2 + 8 + 1 + 2 + 8 + 32 + 1,
        seeds = [b"market", market_id.as_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,

    /// CHECK: Oracle that will update/resolve this market
    pub oracle: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(constraint = oracle.key() == market.oracle)]
    pub oracle: Signer<'info>,
}

#[derive(Accounts)]
pub struct OpenPosition<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        constraint = vault.owner == owner.key()
    )]
    pub vault: Account<'info, Vault>,

    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 32 + 1 + 8 + 2 + 8 + 1 + 8 + 8 + 1,
        seeds = [b"position", vault.key().as_ref(), market.key().as_ref()],
        bump
    )]
    pub position: Account<'info, Position>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClosePosition<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        constraint = vault.owner == owner.key()
    )]
    pub vault: Account<'info, Vault>,

    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"position", vault.key().as_ref(), market.key().as_ref()],
        bump = position.bump,
        constraint = position.vault == vault.key()
    )]
    pub position: Account<'info, Position>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(constraint = oracle.key() == market.oracle)]
    pub oracle: Signer<'info>,
}

#[derive(Accounts)]
pub struct SettlePosition<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        constraint = vault.owner == owner.key()
    )]
    pub vault: Account<'info, Vault>,

    #[account(constraint = market.resolved)]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"position", vault.key().as_ref(), market.key().as_ref()],
        bump = position.bump,
        constraint = position.vault == vault.key()
    )]
    pub position: Account<'info, Position>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct AddOracle<'info> {
    #[account(
        seeds = [b"protocol"],
        bump = protocol.bump,
        constraint = protocol.authority == authority.key()
    )]
    pub protocol: Account<'info, Protocol>,

    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 1 + 1,
        seeds = [b"oracle", oracle.key().as_ref()],
        bump
    )]
    pub oracle_account: Account<'info, OracleAccount>,

    /// CHECK: Oracle being added
    pub oracle: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct ProtocolInitialized {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub fee_bps: u16,
}

#[event]
pub struct VaultCreated {
    pub owner: Pubkey,
    pub vault: Pubkey,
}

#[event]
pub struct Deposited {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub new_balance: u64,
}

#[event]
pub struct Withdrawn {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub fee: u64,
    pub new_balance: u64,
}

#[event]
pub struct MarketRegistered {
    pub market: Pubkey,
    pub market_id: String,
    pub platform: Platform,
}

#[event]
pub struct PriceUpdated {
    pub market: Pubkey,
    pub yes_price: u16,
    pub no_price: u16,
    pub timestamp: i64,
}

#[event]
pub struct PositionOpened {
    pub position: Pubkey,
    pub vault: Pubkey,
    pub market: Pubkey,
    pub side: Side,
    pub quantity: u64,
    pub price: u16,
    pub amount: u64,
}

#[event]
pub struct PositionClosed {
    pub position: Pubkey,
    pub vault: Pubkey,
    pub value_returned: u64,
    pub pnl: i64,
}

#[event]
pub struct MarketResolved {
    pub market: Pubkey,
    pub outcome: Outcome,
    pub timestamp: i64,
}

#[event]
pub struct PositionSettled {
    pub position: Pubkey,
    pub vault: Pubkey,
    pub payout: u64,
    pub pnl: i64,
}

#[event]
pub struct OracleAdded {
    pub oracle: Pubkey,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum PredictionError {
    #[msg("Invalid amount")]
    InvalidAmount,

    #[msg("Insufficient balance")]
    InsufficientBalance,

    #[msg("Invalid price (must be 0-10000)")]
    InvalidPrice,

    #[msg("Market already resolved")]
    MarketAlreadyResolved,

    #[msg("Market not resolved")]
    MarketNotResolved,

    #[msg("Market is resolved")]
    MarketResolved,

    #[msg("Position already settled")]
    PositionAlreadySettled,

    #[msg("String too long")]
    StringTooLong,

    #[msg("Unauthorized oracle")]
    UnauthorizedOracle,
}
