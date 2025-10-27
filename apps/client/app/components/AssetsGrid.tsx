import { AssetsProvider, useAssets } from '~/context/assets';
import { Asset } from './Asset';
import clsx from 'clsx';
import { Modal } from './Modal';
import { useWalletUiAccount, type UiWalletAccount } from '@wallet-ui/react';
import { Swap } from './Swap';
import { usePool } from '~/context/pool';
import type { Asset as DasAsset } from 'helius-sdk/types/das';
import { useCallback, useState } from 'react';
import { Wallet } from './Wallet';

const PoolAsset = ({
  asset,
  size,
  account,
}: {
  asset: DasAsset;
  size: 'small' | 'large';
  account?: UiWalletAccount;
}) => {
  const [open, setOpen] = useState(false);

  const onClose = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  return (
    <Modal
      open={open}
      setOpen={setOpen}
      trigger={
        <div>
          <Asset asset={asset} />
          <div
            className={clsx(
              'bg-[#DBBD8A] text-black border-2 border-t-0 py-2 font-bold',
              {
                'text-[4vw] sm:text-[2vw] md:text-[1.5vw] lg:text-[1vw]':
                  size === 'large',
                'text-[2vw] sm:text-[1.5vw] md:text-[1vw] lg:text-[0.75vw] xl:text-[0.5vw]':
                  size === 'small',
              }
            )}
          >
            {asset.content?.metadata.name}
          </div>
        </div>
      }
    >
      <button
        className="cursor-pointer btn btn-lg btn-circle absolute right-10 top-10 block md:hidden z-50"
        onClick={onClose}
      >
        ✕
      </button>
      {account ? (
        <Swap account={account} toAsset={asset} onClose={onClose} />
      ) : (
        <div className="w-full h-full flex justify-center items-center">
          <Wallet />
        </div>
      )}
    </Modal>
  );
};

export const AssetsGrid = ({ size }: { size: 'large' | 'small' }) => {
  const { account } = useWalletUiAccount();
  const assets = usePool();

  return (
    <AssetsProvider owner={account?.address}>
      <div
        className={clsx('grid  gap-2 items-start grid-rows', {
          'xl:grid-cols-6 lg:grid-cols-4 sm:grid-cols-3 md:grid-cols-4 grid-cols-1':
            size === 'large',
          'xl:grid-cols-14 lg:grid-cols-12 sm:grid-cols-6 md:grid-cols-9 grid-cols-2':
            size === 'small',
        })}
      >
        {assets.map((asset) => (
          <PoolAsset asset={asset} size={size} account={account} />
        ))}
      </div>
    </AssetsProvider>
  );
};
