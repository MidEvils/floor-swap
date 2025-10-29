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
  pipe,
  signature,
  SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED,
  SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_CONNECTION_CLOSED,
  type Address,
  type Instruction,
  type Signature,
  type SignatureBytes,
  type Transaction,
  type TransactionMessage,
  type TransactionSendingSigner,
  type TransactionWithBlockhashLifetime,
} from 'gill';
import { createBlockHeightExceedencePromiseFactory } from '@solana/transaction-confirmation';
import type { Client } from '~/context/rpc';
import { CORE_PROGRAM_ADDRESS } from '@midevils/shared';
import { chunk } from 'lodash-es';

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

  const ixs = chunk(assets, 23).map((assets) =>
    assets.map((asset) =>
      getDepositInstruction({
        asset,
        payer: signer,
        pool,
        collection,
        coreProgram: CORE_PROGRAM_ADDRESS,
      })
    )
  );

  await sendTxs(client, signer, ixs);
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

  const ixs = chunk(assets, 23).map((assets) =>
    assets.map((asset) =>
      getWithdrawInstruction({
        asset,
        authority: signer,
        pool,
        collection,
        coreProgram: CORE_PROGRAM_ADDRESS,
      })
    )
  );

  await sendTxs(client, signer, ixs);
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
  const [poolAcc, balance] = await Promise.all([
    fetchPool(client.rpc, pool),
    client.rpc.getBalance(signer.address).send(),
  ]);

  if (balance.value < poolAcc.data.feeAmount + 5000n) {
    throw new Error(
      `Insufficient balance for swap, please ensure you have at least ${
        poolAcc.data.feeAmount / 10n ** 9n
      } SOL swap fee, plus a small amount to cover Solana transaction fee`
    );
  }

  const ix = getSwapInstruction({
    pool,
    payer: signer,
    sourceAsset,
    destAsset,
    collection,
    treasury: poolAcc.data.treasury,
    coreProgram: CORE_PROGRAM_ADDRESS,
  });

  await sendTxs(client, signer, [[ix]]);
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

  await sendTxs(client, signer, [[ix]]);
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

  await sendTxs(client, signer, [[ix]]);
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

  await sendTxs(client, signer, [[ix]]);
}

async function sendTxs(
  client: Client,
  signer: TransactionSendingSigner,
  ixGroups: Instruction[][]
) {
  const { value: latestBlockhash } = await client.rpc
    .getLatestBlockhash()
    .send();

  const txs = ixGroups.map((ixs) =>
    createTransaction({
      feePayer: signer,
      version: 0,
      instructions: ixs,
      latestBlockhash,
    })
  );

  await Promise.all(
    txs.map(async (tx) => {
      try {
        const sim = await client.rpc
          .simulateTransaction(
            getBase64EncodedWireTransaction(compileTransaction(tx)),
            {
              encoding: 'base64',
            }
          )
          .send();

        if (sim.value?.err) {
          throw getSolanaErrorFromTransactionError(sim.value.err);
        } else {
          if ((sim as any).error) {
            throw (sim as any).error.message;
          }
        }
      } catch (e) {
        if (isSolanaError(e)) {
          if (isFloorSwapError(e, tx)) {
            const message = getFloorSwapErrorMessage(e.context.code);
            console.log(message);
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
    })
  );

  const sigs = await signer.signAndSendTransactions(
    txs.map(compileTransaction)
  );

  await Promise.all(
    sigs.map((sig, index) => confirmTx(client, sig, txs[index]))
  );
}

async function confirmTx(
  client: Client,
  sig: SignatureBytes,
  tx: TransactionMessage & TransactionWithBlockhashLifetime
) {
  const abortController = new AbortController();
  const sigNotifications = await client.ws
    .signatureNotifications(
      signature(getBase58Decoder().decode(sig as Uint8Array<ArrayBufferLike>)),
      {
        commitment: 'confirmed',
      }
    )
    .subscribe({ abortSignal: abortController.signal });

  const confirm = createBlockHeightExceedencePromiseFactory({
    rpc: client.rpc,
    rpcSubscriptions: client.ws,
  });

  try {
    for await (const notification of sigNotifications) {
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

  await sendTxs(client, authority, [[createIx]]);
}
