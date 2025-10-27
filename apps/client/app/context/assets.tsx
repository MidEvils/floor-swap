import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from 'react';
import type { Asset } from 'helius-sdk/types/das';
import { useSettings } from './settings';
import { useRpc } from './rpc';

const Context = createContext<
  | {
      assets: Asset[];
      selected: string[];
      setSelected: Dispatch<SetStateAction<string[]>>;
      removeAssets: (ids: string[]) => void;
      addAssets: (assets: Asset[]) => void;
    }
  | undefined
>(undefined);

export const AssetsProvider = ({
  children,
  owner,
}: PropsWithChildren<{ owner?: string }>) => {
  const { collection } = useSettings();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const { rpc } = useRpc();

  useEffect(() => {
    (async () => {
      if (!owner) {
        setAssets([]);
        setSelected([]);
        return;
      }
      const assets = await rpc
        .searchAssets({
          ownerAddress: owner,
          grouping: ['colllection', collection],
        })
        .send();

      setAssets(assets.items);
      setSelected([]);
    })();
  }, [owner]);

  function removeAssets(ids: string[]) {
    setAssets((assets) => assets.filter((a) => !ids.includes(a.id)));
    setSelected([]);
  }

  function addAssets(assets: Asset[]) {
    setAssets((prev) => [...prev, ...assets]);
    setSelected([]);
  }

  return (
    <Context.Provider
      value={{ assets, selected, setSelected, removeAssets, addAssets }}
    >
      {children}
    </Context.Provider>
  );
};

export const useAssets = () => {
  const context = useContext(Context);

  if (context === undefined) {
    throw new Error('useAssets must be used in an AssetsProvider');
  }

  return context;
};
