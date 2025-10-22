use mpl_core::instructions::TransferV1CpiBuilder;
use mpl_core::ID as MPL_CORE_ID;
use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, system_program};

use crate::assertions::{
    assert_asset_owner, assert_mpl_core_asset, assert_mpl_core_collection, assert_pda,
    assert_pool_active, assert_pool_empty, assert_program_owner, assert_same_pubkeys,
    assert_signer, assert_writable,
};
use crate::error::FloorSwapError;
use crate::instruction::accounts::{
    CloseAccounts, CreateAccounts, DepositAccounts, SetActiveAccounts, SetFeeAccounts,
    SwapAccounts, WithdrawAccounts,
};
use crate::state::pool::Pool;
use crate::state::Key;
use crate::utils::{close_account, create_account, pay_fee};

pub(crate) fn create<'a>(accounts: &'a [AccountInfo<'a>], fee_amount: u64) -> ProgramResult {
    // Accounts.
    let ctx = CreateAccounts::context(accounts)?;

    // Guards.
    let bump = assert_pda(
        "pool",
        ctx.accounts.pool,
        &crate::ID,
        &Pool::seeds(ctx.accounts.authority.key, ctx.accounts.collection.key),
    )?;
    assert_mpl_core_collection("collection", ctx.accounts.collection)?;

    assert_signer("authority", ctx.accounts.authority)?;
    assert_signer("payer", ctx.accounts.payer)?;
    assert_writable("payer", ctx.accounts.payer)?;
    assert_same_pubkeys(
        "system_program",
        ctx.accounts.system_program,
        &system_program::id(),
    )?;

    // Do nothing if the domain already exists.
    if !ctx.accounts.pool.data_is_empty() {
        return Ok(());
    }

    // Create Pool PDA.
    let pool = Pool {
        key: Key::Pool,
        authority: *ctx.accounts.authority.key,
        collection: *ctx.accounts.collection.key,
        treasury: *ctx.accounts.treasury.key,
        fee_amount,
        enabled: false,
        num_assets: 0,
    };
    let mut seeds = Pool::seeds(ctx.accounts.authority.key, ctx.accounts.collection.key);
    let bump = [bump];
    seeds.push(&bump);
    create_account(
        ctx.accounts.pool,
        ctx.accounts.payer,
        ctx.accounts.system_program,
        Pool::LEN,
        &crate::ID,
        Some(&[&seeds]),
    )?;

    pool.save(ctx.accounts.pool)
}

pub(crate) fn set_active<'a>(accounts: &'a [AccountInfo<'a>], active: bool) -> ProgramResult {
    // Accounts.
    let ctx = SetActiveAccounts::context(accounts)?;

    // Guards.
    assert_signer("authority", ctx.accounts.authority)?;
    assert_program_owner("pool", ctx.accounts.pool, &crate::ID)?;
    let mut pool = Pool::load(ctx.accounts.pool)?;
    assert_same_pubkeys("authority", ctx.accounts.authority, &pool.authority)?;

    // Toggle PDA active
    pool.enabled = active;
    pool.save(ctx.accounts.pool)
}

pub(crate) fn set_fee<'a>(accounts: &'a [AccountInfo<'a>], fee_amount: u64) -> ProgramResult {
    // Accounts.
    let ctx = SetFeeAccounts::context(accounts)?;

    // Guards.
    assert_signer("authority", ctx.accounts.authority)?;
    assert_program_owner("pool", ctx.accounts.pool, &crate::ID)?;
    let mut pool: Pool = Pool::load(ctx.accounts.pool)?;
    assert_same_pubkeys("authority", ctx.accounts.authority, &pool.authority)?;

    pool.fee_amount = fee_amount;
    pool.save(ctx.accounts.pool)
}

pub(crate) fn swap<'a>(accounts: &'a [AccountInfo<'a>]) -> ProgramResult {
    // Accounts.
    let ctx = SwapAccounts::context(accounts)?;

    // Guards.
    assert_mpl_core_collection("collection", ctx.accounts.collection)?;
    assert_same_pubkeys("core_program", ctx.accounts.core_program, &MPL_CORE_ID)?;
    let pool: Pool = Pool::load(ctx.accounts.pool)?;

    assert_pool_active(&pool, ctx.accounts.pool)?;

    let source_asset =
        assert_mpl_core_asset("source_asset", ctx.accounts.source_asset, &pool.collection)?;
    assert_asset_owner("source_asset", source_asset, ctx.accounts.payer.key)?;
    let dest_asset =
        assert_mpl_core_asset("dest_asset", ctx.accounts.dest_asset, &pool.collection)?;
    assert_asset_owner("dest_asset", dest_asset, ctx.accounts.pool.key)?;

    assert_signer("payer", ctx.accounts.payer)?;

    assert_writable("payer", ctx.accounts.payer)?;
    assert_writable("source_asset", ctx.accounts.source_asset)?;
    assert_writable("dest_asset", ctx.accounts.dest_asset)?;

    assert_same_pubkeys("collection", ctx.accounts.collection, &pool.collection)?;

    assert_same_pubkeys(
        "system_program",
        ctx.accounts.system_program,
        &system_program::id(),
    )?;

    let bump = assert_pda(
        "pool",
        ctx.accounts.pool,
        &crate::ID,
        &Pool::seeds(&pool.authority, &pool.collection),
    )?;

    let mut seeds = Pool::seeds(&pool.authority, &pool.collection);
    let bump = [bump];
    seeds.push(&bump);

    pay_fee(ctx.accounts.payer, ctx.accounts.treasury, pool.fee_amount)?;

    TransferV1CpiBuilder::new(ctx.accounts.core_program)
        .asset(ctx.accounts.source_asset)
        .new_owner(ctx.accounts.pool)
        .collection(Some(ctx.accounts.collection))
        .payer(ctx.accounts.payer)
        .authority(Some(ctx.accounts.payer))
        .invoke()?;

    TransferV1CpiBuilder::new(ctx.accounts.core_program)
        .asset(ctx.accounts.dest_asset)
        .new_owner(ctx.accounts.payer)
        .collection(Some(ctx.accounts.collection))
        .payer(ctx.accounts.payer)
        .authority(Some(ctx.accounts.pool))
        .invoke_signed(&[&seeds])
}

pub(crate) fn deposit<'a>(accounts: &'a [AccountInfo<'a>]) -> ProgramResult {
    // Accounts.
    let ctx = DepositAccounts::context(accounts)?;

    // Guards.
    assert_same_pubkeys("core_program", ctx.accounts.core_program, &MPL_CORE_ID)?;
    assert_writable("asset", ctx.accounts.asset)?;
    assert_writable("payer", ctx.accounts.payer)?;
    assert_signer("payer", ctx.accounts.payer)?;

    let mut pool = Pool::load(ctx.accounts.pool)?;
    assert_mpl_core_collection("collection", ctx.accounts.collection)?;
    assert_same_pubkeys("collection", ctx.accounts.collection, &pool.collection)?;
    assert_mpl_core_asset("asset", ctx.accounts.asset, &pool.collection)?;

    TransferV1CpiBuilder::new(ctx.accounts.core_program)
        .asset(ctx.accounts.asset)
        .new_owner(ctx.accounts.pool)
        .collection(Some(ctx.accounts.collection))
        .payer(ctx.accounts.payer)
        .authority(Some(ctx.accounts.payer))
        .invoke()?;

    pool.num_assets = pool
        .num_assets
        .checked_add(1)
        .ok_or(FloorSwapError::NumericalOverflow)?;
    pool.save(ctx.accounts.pool)
}

pub(crate) fn withdraw<'a>(accounts: &'a [AccountInfo<'a>]) -> ProgramResult {
    // Accounts.
    let ctx = WithdrawAccounts::context(accounts)?;

    // Guards.
    let mut pool = Pool::load(ctx.accounts.pool)?;

    let asset = assert_mpl_core_asset("asset", ctx.accounts.asset, &pool.collection)?;
    assert_mpl_core_collection("collection", ctx.accounts.collection)?;
    assert_asset_owner("asset", asset, &ctx.accounts.pool.key)?;

    assert_same_pubkeys("core_program", ctx.accounts.core_program, &MPL_CORE_ID)?;
    assert_same_pubkeys("collection", ctx.accounts.collection, &pool.collection)?;
    assert_same_pubkeys("authority", ctx.accounts.authority, &pool.authority)?;

    assert_writable("asset", ctx.accounts.asset)?;
    assert_signer("authority", ctx.accounts.authority)?;

    let bump = assert_pda(
        "pool",
        ctx.accounts.pool,
        &crate::ID,
        &Pool::seeds(ctx.accounts.authority.key, ctx.accounts.collection.key),
    )?;

    let mut seeds = Pool::seeds(ctx.accounts.authority.key, ctx.accounts.collection.key);
    let bump = [bump];
    seeds.push(&bump);

    let destination = ctx.accounts.destination.unwrap_or(ctx.accounts.authority);

    TransferV1CpiBuilder::new(ctx.accounts.core_program)
        .asset(ctx.accounts.asset)
        .new_owner(destination)
        .collection(Some(ctx.accounts.collection))
        .payer(ctx.accounts.authority)
        .authority(Some(ctx.accounts.pool))
        .invoke_signed(&[&seeds])?;

    // We allow a withdrawal even if num_assets is zero, this is because
    // it's possible assets were sent to the pool not using the deposit ix
    pool.num_assets = pool.num_assets.checked_sub(1).unwrap_or(0);
    pool.save(ctx.accounts.pool)
}

pub(crate) fn close<'a>(accounts: &'a [AccountInfo<'a>]) -> ProgramResult {
    let ctx = CloseAccounts::context(accounts)?;
    let pool = Pool::load(ctx.accounts.pool)?;

    assert_pool_empty(&pool, ctx.accounts.pool)?;

    assert_same_pubkeys("authority", ctx.accounts.authority, &pool.authority)?;
    assert_signer("authority", ctx.accounts.authority)?;

    close_account(ctx.accounts.pool, ctx.accounts.authority)?;

    Ok(())
}
