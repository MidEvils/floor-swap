use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg, program_error::ProgramError,
};

use crate::{error::FloorSwapError, state::Key, utils::load_key};

/// A trait for generic blobs of data that have size.
#[allow(clippy::len_without_is_empty)]
pub trait DataBlob: BorshSerialize + BorshDeserialize {
    /// Get the current length of the data blob.
    fn len(&self) -> usize;
}

/// A trait for Solana accounts.
pub trait SolanaAccount: BorshSerialize + BorshDeserialize {
    /// Get the discriminator key for the account.
    fn key() -> Key;

    /// Load the account from the given account info starting at the offset.
    fn load(account: &AccountInfo, offset: usize) -> Result<Self, ProgramError> {
        let key = load_key(account, offset)?;

        if key != Self::key() {
            return Err(FloorSwapError::DeserializationError.into());
        }

        let mut bytes: &[u8] = &(*account.data).borrow()[offset..];
        Self::deserialize(&mut bytes).map_err(|error| {
            msg!("Error: {}", error);
            FloorSwapError::DeserializationError.into()
        })
    }

    /// Save the account to the given account info starting at the offset.
    fn save(&self, account: &AccountInfo, offset: usize) -> ProgramResult {
        borsh::to_writer(&mut account.data.borrow_mut()[offset..], self).map_err(|error| {
            msg!("Error: {}", error);
            FloorSwapError::SerializationError.into()
        })
    }
}
