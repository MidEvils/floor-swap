import { address, type Address } from 'gill';
import { createContext, useContext, type PropsWithChildren } from 'react';

const Context = createContext<
  { collection: Address; authority: Address; pool: Address } | undefined
>(undefined);

export const SettingsProvider = ({
  children,
  collection,
  authority,
  pool,
}: PropsWithChildren<{
  collection: string;
  authority: string;
  pool: string;
}>) => {
  return (
    <Context.Provider
      value={{
        collection: address(collection),
        authority: address(authority),
        pool: address(pool),
      }}
    >
      {children}
    </Context.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(Context);

  if (context === undefined) {
    throw new Error('useSettings must be used in a SettingsProvider');
  }

  return context;
};
