import test from 'ava';
import {
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
  FLOOR_SWAP_ERROR__INVALID_COLLECTION_FOR_ASSET,
  FLOOR_SWAP_PROGRAM_ADDRESS,
  getDepositInstruction,
} from '../src';
import {
  AssetV1,
  fetchAssetV1,
  MPL_CORE_PROGRAM_PROGRAM_ADDRESS,
} from '../sdks/mpl-core/generated';

test('it can deposit an asset into the pool', async (t) => {
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

  await pipe(
    await createDefaultTransaction(client, authority),
    (tx) =>
      appendTransactionMessageInstruction(
        getDepositInstruction({
          pool: poolPda,
          collection,
          asset: assetPk,
          payer: authority,
          coreProgram: MPL_CORE_PROGRAM_PROGRAM_ADDRESS,
        }),
        tx
      ),
    (tx) => signAndSendTransaction(client, tx)
  );

  const asset = await fetchAssetV1(client.rpc, assetPk);

  t.like(asset, <Account<AssetV1>>{
    data: {
      owner: poolPda,
    },
  });
});

test('it cannot deposit an asset from the wrong collection into the pool', async (t) => {
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

  const collection2 = await createCoreCollection(client, authority);

  const assetPk = await createCoreAsset(client, authority, collection2);

  const transactionMessage = pipe(
    await createDefaultTransaction(client, authority),
    (tx) =>
      appendTransactionMessageInstruction(
        getDepositInstruction({
          pool: poolPda,
          asset: assetPk,
          collection,
          payer: authority,
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
      FLOOR_SWAP_ERROR__INVALID_COLLECTION_FOR_ASSET
    )
  );
});
