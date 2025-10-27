import { createContext, useContext, type PropsWithChildren } from 'react';
import { getRpc, getSubscriptionsRpc } from '@midevils/shared';

export type Client = {
  rpc: ReturnType<typeof getRpc>;
  ws: ReturnType<typeof getSubscriptionsRpc>;
};

const Context = createContext<Client | undefined>(undefined);

export const RpcProvider = ({
  children,
  rpcUrl,
}: PropsWithChildren<{ rpcUrl: string }>) => {
  return (
    <Context.Provider
      value={{
        rpc: getRpc(rpcUrl),
        ws: getSubscriptionsRpc(rpcUrl.replace('https://', 'wss://')),
      }}
    >
      {children}
    </Context.Provider>
  );
};

export const useRpc = () => {
  const context = useContext(Context);

  if (context === undefined) {
    throw new Error('useRpc must be used in a RpcProvider');
  }

  return context;
};
