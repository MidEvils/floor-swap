use borsh::{BorshDeserialize, BorshSerialize};
use shank::{ShankContext, ShankInstruction};

#[derive(BorshDeserialize, BorshSerialize, Clone, Debug, ShankContext, ShankInstruction)]
#[rustfmt::skip]
pub enum AppInstruction {
    /// Creates the app account derived from the provided collection.
    #[account(0, writable, name="pool", desc = "The program derived address of the Pool account to create (seeds: ['floor_swap', authority, collection])")]
    #[account(1, name="collection", desc = "The mpl-core collection")]
    #[account(2, signer, name="authority", desc = "The authority of the pool")]
    #[account(3, name="treasury", desc = "The treasury where fees are sent")]
    #[account(4, writable, signer, name="payer", desc = "The account paying for the storage fees")]
    #[account(5, name="system_program", desc = "The system program")]
    Create { fee_amount: u64 },

    /// Toggles the app on/off
    #[account(0, writable, name="pool", desc = "The program derived address of the Pool account to toggle (seeds: ['floor_swap', authority, collection])")]
    #[account(1, signer, name="authority", desc = "The authority of the app")]
    SetActive { active: bool },

    // Updates the swap fee
    #[account(0, writable, name="pool", desc = "The program derived address of the Pool account (seeds: ['floor_swap', authority, collection])")]
    #[account(1, signer, name="authority", desc = "The authority of the app")]
    SetFee { fee_amount: u64 },

    /// Performs a swap
    #[account(0, name="pool", desc = "The program derived address of the Pool account to toggle (seeds: ['floor_swap', authority, collection])")]
    #[account(1, writable, name="source_asset", desc = "The mpl asset to send to the protocol")]
    #[account(2, writable, name="dest_asset", desc = "The mpl asset to receive from the protocol")]
    #[account(3, writable, signer, name="payer", desc = "The user performing the swap")]
    #[account(4, writable, name="treasury", desc = "The treasury where fees are sent")]
    #[account(5, name="collection", desc = "The collection of the pool")]
    #[account(6, name="core_program", desc = "The MPL Core program")]
    #[account(7, name="system_program", desc = "The system program")]
    Swap,

    /// Deposits an asset
    #[account(0, writable, name="pool", desc = "The PDA of the Pool account (seeds: ['floor_swap', authority, collection])")]
    #[account(1, writable, name="asset", desc = "The mpl-core asset to deposit")]
    #[account(2, name="collection", desc = "The collection of the asset")]
    #[account(3, signer, name="payer", desc = "The user depositing the asset")]
    #[account(4, name="core_program", desc = "The MPL Core program")]
    Deposit,

    /// Withdraws an asset
    #[account(0, writable, name="pool", desc = "The PDA of the Pool account (seeds: ['floor_swap', authority, collection])")]
    #[account(1, signer, name="authority", desc = "The authority of the pool")]
    #[account(2, writable, name="asset", desc = "The mpl-core asset to deposit")]
    #[account(3, name="collection", desc = "The collection of the asset")]
    #[account(4, optional, name="destination", desc = "The wallet to receive the asset")]
    #[account(5, name="core_program", desc = "The MPL Core program")]
    Withdraw,

    /// Closes a pool
    #[account(0, writable, name="pool", desc = "The PDA of the Pool account (seeds: ['floor_swap', authority, collection])")]
    #[account(1, signer, name="authority", desc = "The authority of the pool")]
    #[account(2, name="system_program", desc = "The system program")]
    Close
}
