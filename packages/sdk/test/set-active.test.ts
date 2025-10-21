import test from 'ava';
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  createPoolForAuthority,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from './_setup';
import { createCoreCollection } from './_mpl-core';
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
  fetchPoolFromSeeds,
  FLOOR_SWAP_ERROR__ACCOUNT_MISMATCH,
  FLOOR_SWAP_PROGRAM_ADDRESS,
  getSetActiveInstruction,
  Pool,
} from '../src';

test('it can activate a pool', async (t) => {
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

  await pipe(
    await createDefaultTransaction(client, authority),
    (tx) =>
      appendTransactionMessageInstruction(
        getSetActiveInstruction({
          pool: poolPda,
          authority,
          active: true,
        }),
        tx
      ),
    (tx) => signAndSendTransaction(client, tx)
  );

  const pool = await fetchPoolFromSeeds(client.rpc, {
    authority: authority.address,
    collection,
  });

  t.like(pool, <Account<Pool>>{
    data: {
      enabled: true,
    },
  });
});

test('it cannot activate a pool if not the authority', async (t) => {
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

  const unauthorizedSigner = await generateKeyPairSignerWithSol(client);

  const transactionMessage = pipe(
    await createDefaultTransaction(client, unauthorizedSigner),
    (tx) =>
      appendTransactionMessageInstruction(
        getSetActiveInstruction({
          pool: poolPda,
          authority: unauthorizedSigner,
          active: true,
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

test('it can deactivate a pool', async (t) => {
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

  await pipe(
    await createDefaultTransaction(client, authority),
    (tx) =>
      appendTransactionMessageInstruction(
        getSetActiveInstruction({
          pool: poolPda,
          authority,
          active: true,
        }),
        tx
      ),
    (tx) => signAndSendTransaction(client, tx)
  );

  let pool = await fetchPoolFromSeeds(client.rpc, {
    authority: authority.address,
    collection,
  });

  t.like(pool, <Account<Pool>>{
    data: {
      enabled: true,
    },
  });

  await pipe(
    await createDefaultTransaction(client, authority),
    (tx) =>
      appendTransactionMessageInstruction(
        getSetActiveInstruction({
          pool: poolPda,
          authority,
          active: false,
        }),
        tx
      ),
    (tx) => signAndSendTransaction(client, tx)
  );

  pool = await fetchPoolFromSeeds(client.rpc, {
    authority: authority.address,
    collection,
  });

  t.like(pool, <Account<Pool>>{
    data: {
      enabled: false,
    },
  });
});
