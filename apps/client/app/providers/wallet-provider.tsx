import {
  createSolanaDevnet,
  createSolanaLocalnet,
  createSolanaMainnet,
  createWalletUiConfig,
  WalletUi,
} from '@wallet-ui/react';
import type { ReactNode } from 'react';
export function WalletUiProvider({
  children,
  rpcUrl,
}: {
  children: ReactNode;
  rpcUrl: string;
}) {
  return (
    <WalletUi
      config={createWalletUiConfig({
        clusters: [
          createSolanaMainnet(rpcUrl),
          createSolanaDevnet(),
          createSolanaLocalnet(),
        ],
      })}
    >
      {children}
    </WalletUi>
  );
}
