import test from 'ava';
import {
  createAndDepositAsset,
  createDefaultSolanaClient,
  createDefaultTransaction,
  createPoolForAuthority,
  generateKeyPairSignerWithSol,
  getBalance,
  signAndSendTransaction,
} from './_setup';
import { createCoreAsset, createCoreCollection } from './_mpl-core';
import {
  appendTransactionMessageInstruction,
  appendTransactionMessageInstructions,
  fetchEncodedAccount,
  generateKeyPairSigner,
  isProgramError,
  isSolanaError,
  pipe,
  SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
} from '@solana/kit';
import {
  FLOOR_SWAP_ERROR__POOL_NOT_EMPTY,
  FLOOR_SWAP_PROGRAM_ADDRESS,
  getCloseInstruction,
  getWithdrawInstruction,
} from '../src';
import {
  fetchAssetV1,
  getTransferV1Instruction,
  MPL_CORE_PROGRAM_PROGRAM_ADDRESS,
} from '../sdks/mpl-core/generated';

test('it can close an empty pool', async (t) => {
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

  const balanceBefore = await getBalance(client, authority.address);
  const pool = await fetchEncodedAccount(client.rpc, poolPda);
  const rent = pool.exists ? pool.lamports : 0n;

  await pipe(
    await createDefaultTransaction(client, authority),
    (tx) =>
      appendTransactionMessageInstruction(
        getCloseInstruction({
          pool: poolPda,
          authority,
        }),
        tx
      ),
    (tx) => signAndSendTransaction(client, tx)
  );

  const acc = await fetchEncodedAccount(client.rpc, poolPda);

  t.deepEqual(acc.exists, false);

  const balanceAfter = await getBalance(client, authority.address);

  t.deepEqual(balanceAfter, balanceBefore + rent - 5000n);
});

test('it cannot close a pool containing assets', async (t) => {
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

  await createAndDepositAsset(client, authority, collection, poolPda);

  const transactionMessage = pipe(
    await createDefaultTransaction(client, authority),
    (tx) =>
      appendTransactionMessageInstruction(
        getCloseInstruction({
          pool: poolPda,
          authority,
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
      FLOOR_SWAP_ERROR__POOL_NOT_EMPTY
    )
  );
});

test('it can reopen a pool and claim manually sent assets if closed', async (t) => {
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
      appendTransactionMessageInstructions(
        [
          getTransferV1Instruction({
            asset: assetPk,
            newOwner: poolPda,
            authority,
            payer: authority,
            collection,
            compressionProof: null,
          }),
          getCloseInstruction({
            pool: poolPda,
            authority,
          }),
        ],
        tx
      ),
    (tx) => signAndSendTransaction(client, tx)
  );

  const poolAcc = await fetchEncodedAccount(client.rpc, poolPda);

  t.deepEqual(poolAcc.exists, false);

  let asset = await fetchAssetV1(client.rpc, assetPk);

  t.deepEqual(asset.data.owner, poolPda);

  await createPoolForAuthority(client, authority, collection, treasury);

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

  asset = await fetchAssetV1(client.rpc, assetPk);

  t.deepEqual(asset.data.owner, authority.address);
});
