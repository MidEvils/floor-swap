import test from 'ava';
import {
  createAndDepositAsset,
  createDefaultSolanaClient,
  createDefaultTransaction,
  createPoolForAuthority,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from './_setup';
import { createCoreAsset, createCoreCollection } from './_mpl-core';
import {
  Account,
  appendTransactionMessageInstruction,
  generateKeyPairSigner,
  isProgramError,
  isSolanaError,
  pipe,
  SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
} from '@solana/kit';
import {
  FLOOR_SWAP_ERROR__ACCOUNT_MISMATCH,
  FLOOR_SWAP_ERROR__INVALID_ASSET_OWNER,
  FLOOR_SWAP_PROGRAM_ADDRESS,
  getWithdrawInstruction,
} from '../src';
import {
  AssetV1,
  fetchAssetV1,
  MPL_CORE_PROGRAM_PROGRAM_ADDRESS,
} from '../sdks/mpl-core/generated';

test('it can withdraw an asset from the pool', async (t) => {
  t.timeout(30000);
  const client = createDefaultSolanaClient();
  const authority = await generateKeyPairSignerWithSol(client);
  const collection = await createCoreCollection(client, authority);
  const treasury = (await generateKeyPairSigner()).address;
  const [poolPda] = await createPoolForAuthority(
    client,
    authority,
    collection,
    treasury
  );

  const assetPk = await createAndDepositAsset(
    client,
    authority,
    collection,
    poolPda
  );

  await pipe(
    await createDefaultTransaction(client, authority),
    (tx) =>
      appendTransactionMessageInstruction(
        getWithdrawInstruction({
          pool: poolPda,
          collection,
          asset: assetPk,
          authority,
          coreProgram: MPL_CORE_PROGRAM_PROGRAM_ADDRESS,
        }),
        tx
      ),
    (tx) => signAndSendTransaction(client, tx)
  );

  const asset = await fetchAssetV1(client.rpc, assetPk);

  t.like(asset, <Account<AssetV1>>{
    data: {
      owner: authority.address,
    },
  });
});

test('it can withdraw an asset from the pool to another wallet', async (t) => {
  t.timeout(30000);
  const client = createDefaultSolanaClient();
  const authority = await generateKeyPairSignerWithSol(client);
  const collection = await createCoreCollection(client, authority);
  const treasury = (await generateKeyPairSigner()).address;
  const [poolPda] = await createPoolForAuthority(
    client,
    authority,
    collection,
    treasury
  );

  const assetPk = await createAndDepositAsset(
    client,
    authority,
    collection,
    poolPda
  );

  const destination = (await generateKeyPairSigner()).address;

  await pipe(
    await createDefaultTransaction(client, authority),
    (tx) =>
      appendTransactionMessageInstruction(
        getWithdrawInstruction({
          pool: poolPda,
          collection,
          asset: assetPk,
          authority,
          destination,
          coreProgram: MPL_CORE_PROGRAM_PROGRAM_ADDRESS,
        }),
        tx
      ),
    (tx) => signAndSendTransaction(client, tx)
  );

  const asset = await fetchAssetV1(client.rpc, assetPk);

  t.like(asset, <Account<AssetV1>>{
    data: {
      owner: destination,
    },
  });
});

test('it cannot withdraw an asset from the pool if not authority', async (t) => {
  t.timeout(30000);
  const client = createDefaultSolanaClient();
  const authority = await generateKeyPairSignerWithSol(client);
  const collection = await createCoreCollection(client, authority);
  const treasury = (await generateKeyPairSigner()).address;
  const [poolPda] = await createPoolForAuthority(
    client,
    authority,
    collection,
    treasury
  );

  const assetPk = await createAndDepositAsset(
    client,
    authority,
    collection,
    poolPda
  );

  const unauthorizedSigner = await generateKeyPairSignerWithSol(client);

  const transactionMessage = pipe(
    await createDefaultTransaction(client, unauthorizedSigner),
    (tx) =>
      appendTransactionMessageInstruction(
        getWithdrawInstruction({
          pool: poolPda,
          collection,
          asset: assetPk,
          authority: unauthorizedSigner,
          coreProgram: MPL_CORE_PROGRAM_PROGRAM_ADDRESS,
        }),
        tx
      )
  );

  const promise = signAndSendTransaction(client, transactionMessage);
  const error = await t.throwsAsync(promise);
  t.true(
    isSolanaError(
      error,
      SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE
    )
  );
  t.true(
    isProgramError(
      error.cause,
      transactionMessage,
      FLOOR_SWAP_PROGRAM_ADDRESS,
      FLOOR_SWAP_ERROR__ACCOUNT_MISMATCH
    )
  );
});

test('it cannot withdraw an asset from the pool if not in pool', async (t) => {
  t.timeout(30000);
  const client = createDefaultSolanaClient();
  const authority = await generateKeyPairSignerWithSol(client);
  const collection = await createCoreCollection(client, authority);
  const treasury = (await generateKeyPairSigner()).address;
  const [poolPda] = await createPoolForAuthority(
    client,
    authority,
    collection,
    treasury
  );

  const assetPk = await createCoreAsset(client, authority, collection);

  const transactionMessage = pipe(
    await createDefaultTransaction(client, authority),
    (tx) =>
      appendTransactionMessageInstruction(
        getWithdrawInstruction({
          pool: poolPda,
          collection,
          asset: assetPk,
          authority,
          coreProgram: MPL_CORE_PROGRAM_PROGRAM_ADDRESS,
        }),
        tx
      )
  );

  const promise = signAndSendTransaction(client, transactionMessage);
  const error = await t.throwsAsync(promise);
  t.true(
    isSolanaError(
      error,
      SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE
    )
  );
  t.true(
    isProgramError(
      error.cause,
      transactionMessage,
      FLOOR_SWAP_PROGRAM_ADDRESS,
      FLOOR_SWAP_ERROR__INVALID_ASSET_OWNER
    )
  );
});
