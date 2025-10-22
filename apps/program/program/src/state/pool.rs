use borsh::{BorshDeserialize, BorshSerialize};
use shank::ShankAccount;
use solana_program::account_info::AccountInfo;
use solana_program::entrypoint::ProgramResult;
use solana_program::msg;
use solana_program::program_error::ProgramError;
use solana_program::pubkey::Pubkey;

use crate::{
    error::FloorSwapError,
    state::{Key, SolanaAccount},
};

pub(crate) const PREFIX: &str = "floor_swap";

#[repr(C)]
#[derive(Clone, BorshSerialize, BorshDeserialize, Debug, ShankAccount)]
pub struct Pool {
    pub key: Key,
    pub collection: Pubkey,
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub fee_amount: u64,
    pub enabled: bool,
    pub num_assets: u16,
}

impl Pool {
    pub const LEN: usize = 1 + 32 + 32 + 32 + 8 + 1 + 2;

    pub fn seeds<'a>(authority: &'a Pubkey, collection: &'a Pubkey) -> Vec<&'a [u8]> {
        vec![PREFIX.as_bytes(), authority.as_ref(), collection.as_ref()]
    }

    pub fn find_pda(authority: &Pubkey, collection: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&Self::seeds(authority, collection), &crate::ID)
    }

    pub fn load(account: &AccountInfo) -> Result<Self, ProgramError> {
        let mut bytes: &[u8] = &(*account.data).borrow();
        Pool::deserialize(&mut bytes).map_err(|error| {
            msg!("Error: {}", error);
            FloorSwapError::DeserializationError.into()
        })
    }

    pub fn save(&self, account: &AccountInfo) -> ProgramResult {
        borsh::to_writer(&mut account.data.borrow_mut()[..], self).map_err(|error| {
            msg!("Error: {}", error);
            FloorSwapError::SerializationError.into()
        })
    }
}

impl SolanaAccount for Pool {
    fn key() -> Key {
        Key::Pool
    }
}
