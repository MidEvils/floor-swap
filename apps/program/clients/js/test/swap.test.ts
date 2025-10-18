import test from 'ava';
import {
  createAndDepositAsset,
  createDefaultSolanaClient,
  createDefaultTransaction,
  createPoolForAuthority,
  generateKeyPairSignerWithSol,
  getBalance,
  setPoolActive,
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
  FLOOR_SWAP_ERROR__POOL_INACTIVE,
  FLOOR_SWAP_PROGRAM_ADDRESS,
  getSwapInstruction,
} from '../src';
import {
  AssetV1,
  fetchAssetV1,
  MPL_CORE_PROGRAM_PROGRAM_ADDRESS,
} from '../sdks/mpl-core/generated';

test('it can swap an asset from the pool', async (t) => {
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

  const destAssetPk = await createAndDepositAsset(
    client,
    authority,
    collection,
    poolPda
  );

  const payer = await generateKeyPairSignerWithSol(client);

  const sourceAssetPk = await createCoreAsset(
    client,
    authority,
    collection,
    payer.address
  );

  await setPoolActive(client, authority, poolPda, true);

  await pipe(
    await createDefaultTransaction(client, authority),
    (tx) =>
      appendTransactionMessageInstruction(
        getSwapInstruction({
          pool: poolPda,
          collection,
          sourceAsset: sourceAssetPk,
          destAsset: destAssetPk,
          payer,
          treasury,
          coreProgram: MPL_CORE_PROGRAM_PROGRAM_ADDRESS,
        }),
        tx
      ),
    (tx) => signAndSendTransaction(client, tx)
  );

  const [sourceAsset, destAsset, treasuryBalance] = await Promise.all([
    fetchAssetV1(client.rpc, sourceAssetPk),
    fetchAssetV1(client.rpc, destAssetPk),
    getBalance(client, treasury),
  ]);

  t.like(sourceAsset, <Account<AssetV1>>{
    data: {
      owner: poolPda,
    },
  });

  t.like(destAsset, <Account<AssetV1>>{
    data: {
      owner: payer.address,
    },
  });

  t.deepEqual(treasuryBalance, 10000000n);
});

test('it cannot swap if the pool is inactive', async (t) => {
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

  const destAssetPk = await createAndDepositAsset(
    client,
    authority,
    collection,
    poolPda
  );

  const payer = await generateKeyPairSignerWithSol(client);

  const sourceAssetPk = await createCoreAsset(
    client,
    authority,
    collection,
    payer.address
  );

  const transactionMessage = pipe(
    await createDefaultTransaction(client, authority),
    (tx) =>
      appendTransactionMessageInstruction(
        getSwapInstruction({
          pool: poolPda,
          collection,
          sourceAsset: sourceAssetPk,
          destAsset: destAssetPk,
          payer,
          treasury,
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
      FLOOR_SWAP_ERROR__POOL_INACTIVE
    )
  );
});

test('it cannot swap if the source asset is from the wrong collection', async (t) => {
  t.timeout(30000);
  const client = createDefaultSolanaClient();
  const authority = await generateKeyPairSignerWithSol(client);
  const collection = await createCoreCollection(client, authority);
  const collection2 = await createCoreCollection(client, authority);
  const treasury = (await generateKeyPairSigner()).address;
  const [poolPda] = await createPoolForAuthority(
    client,
    authority,
    collection,
    treasury
  );

  const destAssetPk = await createAndDepositAsset(
    client,
    authority,
    collection,
    poolPda
  );

  const payer = await generateKeyPairSignerWithSol(client);

  const sourceAssetPk = await createCoreAsset(
    client,
    authority,
    collection2,
    payer.address
  );

  await setPoolActive(client, authority, poolPda, true);

  const transactionMessage = pipe(
    await createDefaultTransaction(client, authority),
    (tx) =>
      appendTransactionMessageInstruction(
        getSwapInstruction({
          pool: poolPda,
          collection,
          sourceAsset: sourceAssetPk,
          destAsset: destAssetPk,
          payer,
          treasury,
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
