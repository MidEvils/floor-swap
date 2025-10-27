import { type ReactNode } from 'react';
import { Asset } from './Asset';
import type { Asset as DasAsset } from 'helius-sdk/types/das';

export const AssetCarousel = ({
  triggerLabel,
  assets,
  selected,
  onItemClick,
  size = 'md',
}: {
  triggerLabel: ReactNode;
  assets: DasAsset[];
  selected: string[];
  onItemClick: (id: string) => void;
  size: 'sm' | 'md' | 'lg';
}) => {
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
      <div className="flex gap-4 h-full">
        {assets.map((asset) => {
          return (
            <div className="h-full aspect-square">
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
