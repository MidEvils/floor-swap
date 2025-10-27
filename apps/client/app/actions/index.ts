import {
  fetchPool,
  getCloseInstruction,
  getCreateInstructionAsync,
  getDepositInstruction,
  getFloorSwapErrorMessage,
  getSetActiveInstruction,
  getSetFeeInstruction,
  getSwapInstruction,
  getWithdrawInstruction,
  isFloorSwapError,
} from '@midevils/sdk';
import {
  compileTransaction,
  createTransaction,
  getBase58Decoder,
  getBase64EncodedWireTransaction,
  getSolanaErrorFromTransactionError,
  isSolanaError,
  signature,
  SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED,
  SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_CONNECTION_CLOSED,
  type Address,
  type Instruction,
  type Signature,
  type Transaction,
  type TransactionMessage,
  type TransactionSendingSigner,
  type TransactionWithBlockhashLifetime,
} from 'gill';
import { createBlockHeightExceedencePromiseFactory } from '@solana/transaction-confirmation';
import type { Client } from '~/context/rpc';
import { CORE_PROGRAM_ADDRESS } from '@midevils/shared';

export async function deposit({
  client,
  collection,
  pool,
  assets,
  signer,
}: {
  client: Client;
  collection: Address;
  pool: Address;
  assets: Address[];
  signer: TransactionSendingSigner;
}) {
  if (!assets.length) {
    return;
  }

  const ixs = assets.map((asset) =>
    getDepositInstruction({
      asset,
      payer: signer,
      pool,
      collection,
      coreProgram: CORE_PROGRAM_ADDRESS,
    })
  );

  await sendTx(client, signer, ixs);
}

export async function withdraw({
  client,
  collection,
  pool,
  assets,
  signer,
}: {
  client: Client;
  collection: Address;
  pool: Address;
  assets: Address[];
  signer: TransactionSendingSigner;
}) {
  if (!assets.length) {
    return;
  }

  const ixs = assets.map((asset) =>
    getWithdrawInstruction({
      asset,
      authority: signer,
      pool,
      collection,
      coreProgram: CORE_PROGRAM_ADDRESS,
    })
  );

  await sendTx(client, signer, ixs);
}

export async function swap({
  client,
  collection,
  pool,
  signer,
  sourceAsset,
  destAsset,
}: {
  client: Client;
  collection: Address;
  pool: Address;
  sourceAsset: Address;
  destAsset: Address;
  signer: TransactionSendingSigner;
}) {
  const poolAcc = await fetchPool(client.rpc, pool);
  const ix = getSwapInstruction({
    pool,
    payer: signer,
    sourceAsset,
    destAsset,
    collection,
    treasury: poolAcc.data.treasury,
    coreProgram: CORE_PROGRAM_ADDRESS,
  });

  await sendTx(client, signer, [ix]);
}

export async function setActive({
  client,
  pool,
  signer,
  active,
}: {
  client: Client;
  pool: Address;
  signer: TransactionSendingSigner;
  active: boolean;
}) {
  const ix = getSetActiveInstruction({
    authority: signer,
    pool,
    active,
  });

  await sendTx(client, signer, [ix]);
}

export async function closePool({
  client,
  pool,
  signer,
}: {
  client: Client;
  pool: Address;
  signer: TransactionSendingSigner;
}) {
  const ix = getCloseInstruction({
    authority: signer,
    pool,
  });

  await sendTx(client, signer, [ix]);
}

export async function setFee({
  client,
  pool,
  signer,
  feeAmount,
}: {
  client: Client;
  pool: Address;
  signer: TransactionSendingSigner;
  feeAmount: bigint;
}) {
  const ix = getSetFeeInstruction({
    authority: signer,
    pool,
    feeAmount,
  });

  await sendTx(client, signer, [ix]);
}

async function sendTx(
  client: Client,
  signer: TransactionSendingSigner,
  ixs: Instruction[]
) {
  const { value: latestBlockhash } = await client.rpc
    .getLatestBlockhash()
    .send();

  const tx = createTransaction({
    feePayer: signer,
    version: 0,
    instructions: ixs,
    latestBlockhash,
  });

  const sendableTx = compileTransaction(tx);

  try {
    const sim = await client.rpc
      .simulateTransaction(getBase64EncodedWireTransaction(sendableTx), {
        encoding: 'base64',
      })
      .send();

    if (sim.value.err) {
      throw getSolanaErrorFromTransactionError(sim.value.err);
    }

    const [sig] = await signer.signAndSendTransactions([sendableTx]);

    const base58Signature = getBase58Decoder().decode(
      sig as Uint8Array<ArrayBufferLike>
    );

    console.log(base58Signature);

    await confirmTx(client, signature(base58Signature), tx);
  } catch (e) {
    if (isSolanaError(e)) {
      if (isFloorSwapError(e, tx)) {
        const message = getFloorSwapErrorMessage(e.context.code);
        if (message.includes('Invalid owner for asset')) {
          throw new Error(
            'Invalid owner for asset: Please wait for previous tx to be finalized, or refresh if the problem persists'
          );
        }
        throw new Error(message);
      } else if (isSolanaError(e, SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED)) {
        throw new Error('Tx expired');
      }
    }

    throw e;
  }
}

async function confirmTx(
  client: Client,
  sig: Signature,
  tx: TransactionMessage & TransactionWithBlockhashLifetime
) {
  const abortController = new AbortController();
  const signNotifications = await client.ws
    .signatureNotifications(sig, {
      commitment: 'confirmed',
    })
    .subscribe({ abortSignal: abortController.signal });

  const confirm = createBlockHeightExceedencePromiseFactory({
    rpc: client.rpc,
    rpcSubscriptions: client.ws,
  });

  try {
    for await (const notification of signNotifications) {
      console.log(notification);
      if (notification.value.err) {
        throw getSolanaErrorFromTransactionError(notification.value.err);
      } else {
        abortController.abort();
        return;
      }
    }

    console.log('OK');

    await confirm({
      abortSignal: abortController.signal,
      commitment: 'confirmed',
      lastValidBlockHeight: tx.lifetimeConstraint.lastValidBlockHeight,
    });
  } catch (e) {
    if (
      isSolanaError(
        e,
        SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_CONNECTION_CLOSED
      )
    ) {
      throw new Error('Ws connection closed');
    } else if (isSolanaError(e) && isFloorSwapError(e, tx)) {
      const msg = getFloorSwapErrorMessage(e.context.code);

      if (msg.includes('Invalid owner for asset')) {
        throw new Error('Please wait for previous tx to be finalized');
      }
      throw new Error(msg);
    } else {
      throw e;
    }
  }
}

export async function createPool({
  client,
  collection,
  authority,
  treasury,
  feeAmount,
}: {
  client: Client;
  authority: TransactionSendingSigner;
  collection: Address;
  treasury: Address;
  feeAmount: bigint;
}) {
  const createIx = await getCreateInstructionAsync({
    authority,
    collection,
    treasury,
    feeAmount,
  });

  await sendTx(client, authority, [createIx]);
}
