import {
  Account,
  appendTransactionMessageInstruction,
  generateKeyPairSigner,
  isProgramError,
  isSolanaError,
  pipe,
  SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
} from '@solana/kit';
import test from 'ava';
import {
  FLOOR_SWAP_ERROR__EXPECTED_MPL_CORE_COLLECTION,
  FLOOR_SWAP_ERROR__INVALID_PROGRAM_OWNER,
  FLOOR_SWAP_PROGRAM_ADDRESS,
  Pool,
  fetchPoolFromSeeds,
  getCreateInstructionAsync,
} from '../src';
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from './_setup';
import { createCoreAsset, createCoreCollection } from './_mpl-core';

test('it creates a new pool account', async (t) => {
  t.timeout(30000);
  // Given an authority key pair with some SOL.
  const client = createDefaultSolanaClient();
  const authority = await generateKeyPairSignerWithSol(client);
  const treasury = (await generateKeyPairSigner()).address;

  const collection = await createCoreCollection(client, authority);
  const feeAmount = 10000000n; // 0.01 sol

  // When we create a new counter account.
  const createIx = await getCreateInstructionAsync({
    authority,
    collection,
    treasury,
    feeAmount, // 0.01 sol
  });
  await pipe(
    await createDefaultTransaction(client, authority),
    (tx) => appendTransactionMessageInstruction(createIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Then we expect the counter account to exist and have a value of 0.
  const pool = await fetchPoolFromSeeds(client.rpc, {
    authority: authority.address,
  });
  t.like(pool, <Account<Pool>>{
    data: {
      authority: authority.address,
      collection,
      treasury,
      feeAmount,
      enabled: false,
    },
  });
});

test('it cannot create a new pool account with an invalid collection', async (t) => {
  t.timeout(30000);

  const client = createDefaultSolanaClient();
  const authority = await generateKeyPairSignerWithSol(client);
  const treasury = (await generateKeyPairSigner()).address;

  const collection = (await generateKeyPairSigner()).address;
  const feeAmount = 10000000n; // 0.01 sol

  const createIx = await getCreateInstructionAsync({
    authority,
    collection,
    treasury,
    feeAmount, // 0.01 sol
  });
  const transactionMessage = pipe(
    await createDefaultTransaction(client, authority),
    (tx) => appendTransactionMessageInstruction(createIx, tx)
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
      FLOOR_SWAP_ERROR__INVALID_PROGRAM_OWNER
    )
  );
});

test('it cannot create a new pool account with an asset instead of a collection', async (t) => {
  t.timeout(30000);

  const client = createDefaultSolanaClient();
  const authority = await generateKeyPairSignerWithSol(client);
  const treasury = (await generateKeyPairSigner()).address;

  const asset = await createCoreAsset(client, authority);
  const feeAmount = 10000000n; // 0.01 sol

  const createIx = await getCreateInstructionAsync({
    authority,
    collection: asset,
    treasury,
    feeAmount, // 0.01 sol
  });
  const transactionMessage = pipe(
    await createDefaultTransaction(client, authority),
    (tx) => appendTransactionMessageInstruction(createIx, tx)
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
      FLOOR_SWAP_ERROR__EXPECTED_MPL_CORE_COLLECTION
    )
  );
});
