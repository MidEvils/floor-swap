use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, program::invoke_signed, pubkey::Pubkey,
    rent::Rent, system_instruction, sysvar::Sysvar,
};

/// Create a new account from the given size.
pub(crate) fn create_account<'a>(
    target_account: &AccountInfo<'a>,
    funding_account: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    size: usize,
    owner: &Pubkey,
    signer_seeds: Option<&[&[&[u8]]]>,
) -> ProgramResult {
    let rent = Rent::get()?;
    let lamports: u64 = rent.minimum_balance(size);

    invoke_signed(
        &system_instruction::create_account(
            funding_account.key,
            target_account.key,
            lamports,
            size as u64,
            owner,
        ),
        &[
            funding_account.clone(),
            target_account.clone(),
            system_program.clone(),
        ],
        signer_seeds.unwrap_or(&[]),
    )
}
