import {
  useWalletUiAccount,
  useWalletUiSigner,
  type UiWalletAccount,
} from '@wallet-ui/react';
import { fetchPoolFromSeeds, getCreateInstructionAsync } from '@midevils/sdk';

import {
  address,
  compileTransaction,
  createSolanaRpc,
  createTransaction,
} from 'gill';

function SendButton({ account }: { account: UiWalletAccount }) {
  const signer = useWalletUiSigner({ account });

  async function createApp() {
    const rpc = createSolanaRpc(
      'https://mainnet.helius-rpc.com/?api-key=d8bb99b6-342b-40d8-9d9f-731827589922'
    );

    if (!wallet) {
      throw new Error('Wallet not connected');
    }
    const collection = address('w44WvLKRdLGye2ghhDJBxcmnWpBo31A1tCBko2G6DgW');
    const createIx = await getCreateInstructionAsync({
      authority: signer,
      collection,
      treasury: address('JCapwSzWyHkjuVrT5ZTyKwBHzV9oYrTNhZguAMc9PiEc'),
      feeAmount: 10000000n,
    });

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    const tx = createTransaction({
      feePayer: signer,
      version: 0,
      instructions: [createIx],
      latestBlockhash,
    });

    await signer.signAndSendTransactions([compileTransaction(tx)]);

    console.log('success');

    const pool = await fetchPoolFromSeeds(
      rpc,
      {
        authority: signer.address,
        collection,
      },
      { commitment: 'processed' }
    );

    console.log(pool);
  }

  return (
    <div>
      <button onClick={createApp}>Create</button>
    </div>
  );
}

export default function Admin() {
  const { account } = useWalletUiAccount();
  if (!account) {
    return <p>No account selected.</p>;
  }

  return <SendButton account={account} />;
}
