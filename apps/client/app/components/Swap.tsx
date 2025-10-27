import { useState } from 'react';
import { FramedImg } from './FramedImg';
import { Wallet } from './Wallet';
import { AssetCarousel } from './AssetCarousel';
import { useAssets } from '~/context/assets';
import type { Asset } from 'helius-sdk/types/das';
import { useWalletUiSigner, type UiWalletAccount } from '@wallet-ui/react';
import clsx from 'clsx';
import { Button } from './Button';
import { swap } from '~/actions';
import { useRpc } from '~/context/rpc';
import { useSettings } from '~/context/settings';
import { address } from 'gill';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router';

const Arrow = ({ className }: { className?: string }) => {
  return (
    <div
      className={clsx(
        'w-[40px] h-[40px] rounded-full border-2 border-black absolute top-[50%] left-[50%] ml-[-20px] mt-[-20px] bg-[#DBBD8A] flex items-center justify-center p-1',
        className
      )}
    >
      <img src="/arrow.svg" className="h-full" />
    </div>
  );
};

export const Swap = ({
  toAsset,
  onClose,
  account,
}: {
  toAsset: Asset;
  onClose: () => void;
  account: UiWalletAccount;
}) => {
  const [selected, setSelected] = useState<string>();
  const signer = useWalletUiSigner({ account });
  const { assets, addAssets, removeAssets } = useAssets();
  const client = useRpc();
  const { collection, pool } = useSettings();
  const navigate = useNavigate();

  function onSelectedChange(id: string) {
    if (selected === id) {
      setSelected(undefined);
    } else {
      setSelected(id);
    }
  }

  const fromAsset = assets.find((a) => a.id === selected);

  async function onAction() {
    if (!fromAsset) {
      toast.error('No MidEvil selected');
      return;
    }
    const promise = swap({
      client,
      pool,
      signer,
      collection,
      sourceAsset: address(fromAsset.id),
      destAsset: address(toAsset.id),
    });

    onClose();

    toast.promise(promise, {
      loading: 'Swapping Mids',
      success: 'Swapped successfully',
      error: (err) => err.message || 'Error closing pool',
    });

    await promise;
    addAssets([toAsset]);
    removeAssets([fromAsset.id]);
    setSelected(undefined);
    navigate('/');
  }

  return (
    <div className="flex flex-col justify-between gap-3 md:p-10 relative h-full">
      <div className="border-3 border-black w-full p-5 bg-[#DBBD8A] grow-1 shrink-0 basis-0 relative h-full">
        <h3 className="text-black font-bold text-[1.5rem] md:hidden">
          You receive
        </h3>
        <div className="flex justify-center gap-16 items-center h-full">
          {fromAsset && <FramedImg asset={fromAsset} hideOnMobile />}
          {fromAsset && <Arrow className="rotate-90 hidden md:flex" />}
          <FramedImg asset={toAsset} />
        </div>
      </div>
      {!fromAsset ? (
        <Arrow />
      ) : (
        <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center">
          <Button onClick={onAction}>Swap</Button>
        </div>
      )}
      <div className="border-3 border-black w-full p-5 flex flex-col justify-center bg-[#DBBD8A] grow-1 shrink-0 basis-0 gap-5 h-full overflow-hidden">
        <h3 className="text-black font-bold text-[1.5rem]">Choose a MidEvil</h3>

        {!account?.address ? (
          <Wallet />
        ) : (
          <AssetCarousel
            assets={assets}
            triggerLabel="Swap"
            selected={selected ? [selected] : []}
            onItemClick={onSelectedChange}
            size="sm"
          />
        )}
      </div>
    </div>
  );
};
