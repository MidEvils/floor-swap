import {
  createSolanaDevnet,
  createSolanaLocalnet,
  createSolanaMainnet,
  createWalletUiConfig,
  WalletUi,
} from '@wallet-ui/react';
import type { ReactNode } from 'react';
const config = createWalletUiConfig({
  clusters: [
    // You can add mainnet when you're ready
    createSolanaMainnet(
      'https://mainnet.helius-rpc.com/?api-key=d8bb99b6-342b-40d8-9d9f-731827589922'
    ),
    createSolanaDevnet(),
    createSolanaLocalnet(),
  ],
});
export function WalletUiProvider({ children }: { children: ReactNode }) {
  return <WalletUi config={config}>{children}</WalletUi>;
}
