use anchor_lang::prelude::*;
declare_id!("Frp5LsjVZHbxjua8JTuAhYCFQTv7qpYvqZcrmXB8Prsz");

const NULL_ADDRESS: &str = "dead111111111111111111111111111111111111111";
const LAMPORT_PER_SOL: u64 = 1000000000;
#[program]
pub mod swap {
    use super::*;
    // Required Owner init Pair
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let expected = "HhXLdaQxft5yqZb9tYHg2pXoXdBucgB1HW58V6kLYXCZ";
        if !ctx
            .accounts
            .user
            .to_account_info()
            .key
            .to_string()
            .eq(expected)
        {
            return Err(ErrorCode::InvalidProgramAuthority.into());
        }
        let swap_state_account = &mut ctx.accounts.swap_state_account;
        swap_state_account.rate_sol_to_token = 10; // 1 Sol = 10 * decimals Token
        swap_state_account.decimals = 9; // Decimals of Token
        swap_state_account.mint_address = ctx.accounts.mint_account.key.clone(); // 1 Sol = 10 Token
        swap_state_account.authority = ctx.accounts.authority.key.to_owned();
        Ok(())
    }

    // Deposit Token Or SOL
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> { 
        let user = &mut ctx.accounts.user; 
        let pda_account = &mut ctx.accounts.pda_account;
        let from_tokens = &mut ctx.accounts.from_tokens;
        let to_tokens = &mut ctx.accounts.to_tokens;
        let mint_account = &ctx.accounts.mint_account;
        let token_program = ctx.accounts.token_program.clone();
        let associated_token_program = &ctx.accounts.associated_token_program;
        let system_program = &ctx.accounts.system_program;
        let rent = &ctx.accounts.rent;
        let program_id = &ctx.accounts.program_id;
        let seeds: &[u8] = b"token_holder";
        let (pda_accounts, _) = Pubkey::find_program_address(&[seeds], program_id.key);
        
        if ctx.accounts.mint_account.key.to_string().eq(NULL_ADDRESS) {
            let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
                user.to_account_info().key,
                &pda_accounts,
                amount,
            );
            anchor_lang::solana_program::program::invoke(
                &transfer_ix,
                &[
                    pda_account.to_account_info().clone(),
                    user.to_account_info().clone(),
                    ctx.accounts.system_program.to_account_info().clone(),
                ],
            )?;
        } else {
            let associated_token_account =
                anchor_spl::associated_token::get_associated_token_address(
                    &pda_accounts,
                    &mint_account.key,
                );
            if to_tokens.key == &associated_token_account
            {
                if to_tokens.data_is_empty() {
                    let transfer_ix =
                        spl_associated_token_account::instruction::create_associated_token_account(
                            &user.key,
                            &pda_account.key,
                            &mint_account.key,
                        );
                    anchor_lang::solana_program::program::invoke(
                        &transfer_ix,
                        &[
                            user.to_account_info().clone(),
                            to_tokens.clone(),
                            pda_account.clone(),
                            mint_account.clone(),
                            system_program.to_account_info().clone(),
                            associated_token_program.clone(),
                            rent.to_account_info().clone(),
                        ],
                    )
                    .ok();
                }
                let transfer_ix = spl_token::instruction::transfer(
                    token_program.key,
                    from_tokens.key,
                    to_tokens.key,
                    &user.to_account_info().key,
                    &[&user.to_account_info().key],
                    amount,
                )?;
                anchor_lang::solana_program::program::invoke(
                    &transfer_ix,
                    &[
                        from_tokens.clone(),
                        to_tokens.clone(),
                        user.to_account_info().clone(),
                        token_program.clone(),
                    ],
                )?;
            } else {
                return Err(error!(ErrorCode::TokenAddressNotMatch));
            }
        }
        Ok(())
    }

    // Deposit Token Or SOL
    pub fn swap(ctx: Context<Swap>, amount: u64, is_swap_sol_to_spl_token: bool) -> Result<()> {
        let swap_state_account = &ctx.accounts.swap_state_account;
        let user = &mut ctx.accounts.user;
        let pda_account = &mut ctx.accounts.pda_account;
        let from_tokens = &mut ctx.accounts.from_tokens;
        let to_tokens = &mut ctx.accounts.to_tokens;
        let mint_account = &ctx.accounts.mint_account;
        let token_program = ctx.accounts.token_program.clone();
        let associated_token_program = &ctx.accounts.associated_token_program;
        let system_program = &ctx.accounts.system_program;
        let rent = &ctx.accounts.rent;
        let program_id = &ctx.accounts.program_id;
        let seeds: &[u8] = b"token_holder";
        let (pda_accounts, bumb) = Pubkey::find_program_address(&[seeds], program_id.key);
        // Check mint address
        if !swap_state_account.mint_address.eq(
            mint_account.key
        ){
            return Err(ErrorCode::MintAccountNotMatch.into());
        }
        // Swap SOL -> Spl_Token
        if is_swap_sol_to_spl_token {
            // Transfer Sol to Program Wallet
            let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
                user.to_account_info().key,
                &pda_accounts,
                amount,
            );
            anchor_lang::solana_program::program::invoke(
                &transfer_ix,
                &[
                    pda_account.to_account_info().clone(),
                    user.to_account_info().clone(),
                    ctx.accounts.system_program.to_account_info().clone(),
                ],
            )?;
            // Create Associate Account Token Spl
            if to_tokens.data_is_empty() {
                let transfer_ix_2 =
                        spl_associated_token_account::instruction::create_associated_token_account(
                            &user.key,
                            &user.to_account_info().key,
                            &mint_account.key,
                        );
                    anchor_lang::solana_program::program::invoke(
                        &transfer_ix_2,
                        &[
                            user.to_account_info().clone(),
                            to_tokens.clone(),
                            user.to_account_info().clone(),
                            mint_account.clone(),
                            system_program.to_account_info().clone(),
                            associated_token_program.clone(),
                            rent.to_account_info().clone(),
                        ],
                    )
                    .ok();
            }
            // Transfer SPL to User
            let token_amount = (amount * swap_state_account.clone().rate_sol_to_token * u64::pow(10, swap_state_account.clone().decimals)) / LAMPORT_PER_SOL ;
            let transfer_ix_3 = spl_token::instruction::transfer(
                token_program.key,
                from_tokens.key,
                to_tokens.key,
                &pda_accounts,
                &[&pda_accounts],
                token_amount,
            )?;
            anchor_lang::solana_program::program::invoke_signed(
                &transfer_ix_3,
                &[
                    from_tokens.clone(),
                    to_tokens.clone(),
                    pda_account.clone(),
                    token_program.clone(),
                ],
                &[&[&seeds, &[bumb]]],
            )?;
        } else {
            // Must Init Associate for pda account first
            let associated_token_account =
                anchor_spl::associated_token::get_associated_token_address(
                    &pda_accounts,
                    &mint_account.key,
                );
            if to_tokens.key == &associated_token_account
            {
                // Transfer Token To Program Wallet
                let transfer_ix = spl_token::instruction::transfer(
                    token_program.key,
                    from_tokens.key,
                    to_tokens.key,
                    &user.to_account_info().key,
                    &[&user.to_account_info().key],
                    amount,
                )?;
                anchor_lang::solana_program::program::invoke(
                    &transfer_ix,
                    &[
                        from_tokens.clone(),
                        to_tokens.clone(),
                        user.to_account_info().clone(),
                        token_program.clone(),
                    ],
                )?;
                // Withdraw Sol to User Account
                let sol_amount = amount * LAMPORT_PER_SOL / swap_state_account.rate_sol_to_token / u64::pow(10, swap_state_account.decimals);
                let transfer_ix_2 = anchor_lang::solana_program::system_instruction::transfer(
                    pda_account.key,
                    to_tokens.key,
                    sol_amount,
                );
                anchor_lang::solana_program::program::invoke_signed(
                    &transfer_ix_2,
                    &[
                        pda_account.clone(),
                        to_tokens.clone(),
                        ctx.accounts.system_program.to_account_info().clone(),
                    ],
                    &[&[&seeds, &[bumb]]],
                )?;  
            } else {
                return Err(error!(ErrorCode::TokenAddressNotMatch));
            }
        }
        Ok(())
    }
}
#[derive(Accounts)]
pub struct Initialize<'info> {
    // account used by the instruction
    #[account(init, payer = user, space = 3217)]
    pub swap_state_account: Account<'info, SwapState>,
    // transaction signer
    #[account(mut)]
    pub user: Signer<'info>,
    pub authority: AccountInfo<'info>,
    pub mint_account: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>, 
    #[account(mut)]
    pub from_tokens: AccountInfo<'info>,
    #[account(mut)]
    pub to_tokens: AccountInfo<'info>,
    pub mint_account: AccountInfo<'info>,
    #[account(mut)]
    pub pda_account: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>, 
    pub associated_token_program: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub program_id: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub user: Signer<'info>, 
    pub swap_state_account: Account<'info, SwapState>,
    #[account(mut)]
    pub from_tokens: AccountInfo<'info>,
    #[account(mut)]
    pub to_tokens: AccountInfo<'info>,
    pub mint_account: AccountInfo<'info>,
    #[account(mut)]
    pub pda_account: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub program_id: AccountInfo<'info>,
}

#[account]
pub struct SwapState {
    pub authority: Pubkey,
    pub mint_address: Pubkey, // Mint Pair (SOL-MOVE)
    pub decimals: u32,
    pub rate_sol_to_token: u64 // On percentage (1 SOL = rate_sol_to_token / 1000);
}

#[error_code]
pub enum ErrorCode {
    #[msg("Error Token Program not Match!")]
    TokenProgramMismatch,
    #[msg("Error User Not Authorized!")]
    UserNotAuthorized,
    #[msg("User is Not Owner of Program!")]
    InvalidProgramAuthority,
    #[msg("Insufficient Token Or SOL")]
    InsufficientAmount,
    #[msg("Token Address Not Matchs")]
    TokenAddressNotMatch,
    #[msg("Mint Account Not Matchs")]
    MintAccountNotMatch,
}
