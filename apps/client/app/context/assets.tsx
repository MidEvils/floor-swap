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
      loading: boolean;
      error: boolean;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const { rpc } = useRpc();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!owner) {
        setAssets([]);
        setSelected([]);
        setError(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(false);
      try {
        const res = await rpc
          .searchAssets({
            ownerAddress: owner,
            grouping: ['collection', collection],
            burnt: false,
          })
          .send();
        if (cancelled) return;
        // Exclude frozen mids (staked in MidTraining or listed on a
        // marketplace): they can't be transferred, so a swap would fail with a
        // cryptic on-chain error. Verified: frozen mpl-core assets report
        // ownership.frozen === true (freeze_delegate plugin).
        setAssets(res.items.filter((a) => !a.ownership?.frozen));
        setSelected([]);
      } catch {
        // Distinguish a failed fetch from genuinely owning nothing, so the UI
        // can show a retry state instead of "No assets found".
        if (cancelled) return;
        setError(true);
        setAssets([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
      value={{
        assets,
        selected,
        setSelected,
        removeAssets,
        addAssets,
        loading,
        error,
      }}
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
