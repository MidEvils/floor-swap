import {
  Address,
  appendTransactionMessageInstruction,
  generateKeyPairSigner,
  KeyPairSigner,
  pipe,
  TransactionSigner,
} from '@solana/kit';
import {
  Client,
  createDefaultTransaction,
  signAndSendTransaction,
} from './_setup';
import { DataState } from '@metaplex-foundation/mpl-core';
import {
  getCreateCollectionV2Instruction,
  getCreateV2Instruction,
} from '../sdks/mpl-core/generated';

export async function createCoreCollection(
  client: Client,
  authority: KeyPairSigner,
  name = 'Test collection',
  uri = 'https://bafybeih5rnavjmj4u4aslm6k5qtqznxzla2mthsf7p2c3lrk2wc33m2h3i.ipfs.w3s.link/collection.json'
): Promise<Address> {
  const collection = await generateKeyPairSigner();

  const ix = getCreateCollectionV2Instruction({
    collection,
    updateAuthority: authority.address,
    payer: authority,
    name,
    uri,
    plugins: [],
    externalPluginAdapters: [],
  });

  await pipe(
    await createDefaultTransaction(client, authority),
    (tx) => appendTransactionMessageInstruction(ix, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  return collection.address;
}

export async function createCoreAsset(
  client: Client,
  authority: TransactionSigner,
  collection?: Address,
  owner?: Address,
  name = 'Test asset',
  uri = 'https://bafybeih5rnavjmj4u4aslm6k5qtqznxzla2mthsf7p2c3lrk2wc33m2h3i.ipfs.w3s.link/2884.json'
): Promise<Address> {
  const asset = await generateKeyPairSigner();

  const ix = getCreateV2Instruction({
    asset,
    updateAuthority: collection ? undefined : authority.address,
    payer: authority,
    name,
    uri,
    owner,
    dataState: DataState.AccountState,
    collection,
    plugins: [],
    externalPluginAdapters: [],
  });

  await pipe(
    await createDefaultTransaction(client, authority),
    (tx) => appendTransactionMessageInstruction(ix, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  return asset.address;
}
