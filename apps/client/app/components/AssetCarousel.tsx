import { type ReactNode } from 'react';
import { Asset } from './Asset';
import type { Asset as DasAsset } from 'helius-sdk/types/das';
import clsx from 'clsx';

export const AssetCarousel = ({
  triggerLabel,
  assets,
  selected,
  onItemClick,
  size = 'md',
  vertical = false,
  loading = false,
  error = false,
}: {
  triggerLabel: ReactNode;
  assets: DasAsset[];
  selected: string[];
  onItemClick: (id: string) => void;
  size: 'sm' | 'md' | 'lg';
  vertical?: boolean;
  loading?: boolean;
  error?: boolean;
}) => {
  if (loading) {
    return (
      <p className="text-xl text-black font-bold text-center">Loading…</p>
    );
  }

  if (error) {
    return (
      <p className="text-xl text-black font-bold text-center">
        Couldn’t load your MidEvils — please try again.
      </p>
    );
  }

  if (!assets.length) {
    return (
      <p className="text-xl text-black font-bold text-center">
        No assets found
      </p>
    );
  }

  return (
    <div className="overflow-scroll scrollbar pl-[4px] pt-[4px] h-full">
      {/* <div className="overflow-visible"> */}
      <div
        className={clsx('gap-4', {
          'grid sm:grid-cols-3 md:grid-cols-5 grid-cols-2 w-full': vertical,
          'flex h-full': !vertical,
        })}
      >
        {assets.map((asset) => {
          return (
            <div key={asset.id} className={clsx('h-full aspect-square', {})}>
              <Asset
                asset={asset}
                onAssetClick={onItemClick}
                active={selected.includes(asset.id)}
                triggerLabel={triggerLabel}
              />
            </div>
          );
        })}
      </div>
      {/* </div> */}
    </div>
  );
};
