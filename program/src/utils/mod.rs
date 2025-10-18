mod account;
pub(crate) use account::*;

use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    system_instruction,
};

use num_traits::FromPrimitive;

use crate::{error::FloorSwapError, state::Key};

/// Transfer lamports.
#[inline(always)]
pub fn transfer_lamports<'a>(
    from: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    lamports: u64,
    signer_seeds: Option<&[&[&[u8]]]>,
) -> ProgramResult {
    invoke_signed(
        &system_instruction::transfer(from.key, to.key, lamports),
        &[from.clone(), to.clone()],
        signer_seeds.unwrap_or(&[]),
    )
}

/// Transfer lamports.
#[inline(always)]
pub fn pay_fee<'a>(from: &AccountInfo<'a>, to: &AccountInfo<'a>, lamports: u64) -> ProgramResult {
    invoke(
        &system_instruction::transfer(from.key, to.key, lamports),
        &[from.clone(), to.clone()],
    )
}

pub fn transfer_lamports_from_pdas<'a>(
    from: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    lamports: u64,
) -> ProgramResult {
    **from.lamports.borrow_mut() = from
        .lamports()
        .checked_sub(lamports)
        .ok_or::<ProgramError>(FloorSwapError::NumericalOverflow.into())?;

    **to.lamports.borrow_mut() = to
        .lamports()
        .checked_add(lamports)
        .ok_or::<ProgramError>(FloorSwapError::NumericalOverflow.into())?;

    Ok(())
}

/// Load the one byte key from the account data at the given offset.
pub fn load_key(account: &AccountInfo, offset: usize) -> Result<Key, ProgramError> {
    let key = Key::from_u8((*account.data).borrow()[offset])
        .ok_or(FloorSwapError::DeserializationError)?;

    Ok(key)
}
