import {
  Address,
  Commitment,
  TransactionSigner,
  TransactionMessageWithBlockhashLifetime,
  ProgramDerivedAddress,
  Rpc,
  RpcSubscriptions,
  SolanaRpcApi,
  SolanaRpcSubscriptionsApi,
  airdropFactory,
  appendTransactionMessageInstruction,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getSignatureFromTransaction,
  lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  TransactionMessage,
  TransactionMessageWithFeePayer,
  SendableTransaction,
  Transaction,
  TransactionBlockhashLifetime,
  generateKeyPair,
  createSignerFromKeyPair,
} from '@solana/kit';
import { createCoreAsset } from './_mpl-core';
import {
  findPoolPda,
  getCreateInstructionAsync,
  getDepositInstruction,
  getSetActiveInstruction,
} from '../src';
import { MPL_CORE_PROGRAM_PROGRAM_ADDRESS } from '../sdks/mpl-core/generated';

export type Client = {
  rpc: Rpc<SolanaRpcApi>;
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
};

export const createDefaultSolanaClient = (): Client => {
  const rpc = createSolanaRpc('http://127.0.0.1:8899');
  const rpcSubscriptions = createSolanaRpcSubscriptions('ws://127.0.0.1:8900');
  return { rpc, rpcSubscriptions };
};

export const generateKeyPairSignerWithSol = async (
  client: Client,
  putativeLamports: bigint = 1_000_000_000n
) => {
  const keypair = await generateKeyPair();
  const signer = await createSignerFromKeyPair(keypair);
  await airdropFactory(client)({
    recipientAddress: signer.address,
    lamports: lamports(putativeLamports),
    commitment: 'confirmed',
  });
  return signer;
};

export const createDefaultTransaction = async (
  client: Client,
  feePayer: TransactionSigner
) => {
  const { value: latestBlockhash } = await client.rpc
    .getLatestBlockhash()
    .send();
  return pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(feePayer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx)
  );
};

export const signAndSendTransaction = async (
  client: Client,
  transactionMessage: TransactionMessage &
    TransactionMessageWithFeePayer &
    TransactionMessageWithBlockhashLifetime,
  commitment: Commitment = 'confirmed'
) => {
  const signedTransaction = (await signTransactionMessageWithSigners(
    transactionMessage
  )) as SendableTransaction &
    Transaction & {
      readonly lifetimeConstraint: TransactionBlockhashLifetime;
    };
  const signature = getSignatureFromTransaction(signedTransaction);
  await sendAndConfirmTransactionFactory(client)(signedTransaction, {
    commitment,
  });
  return signature;
};

export const getBalance = async (client: Client, address: Address) =>
  (await client.rpc.getBalance(address, { commitment: 'confirmed' }).send())
    .value;

export const createPoolForAuthority = async (
  client: Client,
  authority: TransactionSigner,
  collection: Address,
  treasury: Address,
  feeAmount = 10000000n // 0.01 sol
): Promise<ProgramDerivedAddress> => {
  const [transaction, counterPda, createIx] = await Promise.all([
    createDefaultTransaction(client, authority),
    findPoolPda({ authority: authority.address }),
    getCreateInstructionAsync({
      authority,
      collection,
      treasury,
      feeAmount,
    }),
  ]);
  await pipe(
    transaction,
    (tx) => appendTransactionMessageInstruction(createIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  return counterPda;
};

export const createAndDepositAsset = async (
  client: Client,
  authority: TransactionSigner,
  collection: Address,
  pool: Address
) => {
  const assetPk = await createCoreAsset(client, authority, collection);

  await pipe(
    await createDefaultTransaction(client, authority),
    (tx) =>
      appendTransactionMessageInstruction(
        getDepositInstruction({
          pool,
          collection,
          asset: assetPk,
          payer: authority,
          coreProgram: MPL_CORE_PROGRAM_PROGRAM_ADDRESS,
        }),
        tx
      ),
    (tx) => signAndSendTransaction(client, tx)
  );

  return assetPk;
};

export const setPoolActive = async (
  client: Client,
  authority: TransactionSigner,
  pool: Address,
  active: boolean
) => {
  await pipe(
    await createDefaultTransaction(client, authority),
    (tx) =>
      appendTransactionMessageInstruction(
        getSetActiveInstruction({
          pool,
          authority,
          active,
        }),
        tx
      ),
    (tx) => signAndSendTransaction(client, tx)
  );
};
