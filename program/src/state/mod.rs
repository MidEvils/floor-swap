use borsh::{BorshDeserialize, BorshSerialize};
use num_derive::{FromPrimitive, ToPrimitive};

mod traits;
use strum::EnumIter;
pub use traits::*;

pub mod pool;

/// An enum representing account discriminators.
#[derive(
    Clone,
    Copy,
    BorshSerialize,
    BorshDeserialize,
    Debug,
    PartialEq,
    Eq,
    ToPrimitive,
    FromPrimitive,
    EnumIter,
)]
pub enum Key {
    /// Uninitialized or invalid account.
    Uninitialized,
    /// An account holding master settings.
    Pool,
}

impl Key {
    const BASE_LEN: usize = 1; // 1 byte for the discriminator
}

impl DataBlob for Key {
    fn len(&self) -> usize {
        Self::BASE_LEN
    }
}
