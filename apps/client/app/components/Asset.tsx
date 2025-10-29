import clsx from 'clsx';
import type { Asset as DasAsset } from 'helius-sdk/types/das';
import type { ReactNode } from 'react';

export const Asset = ({
  asset,
  active,
  onAssetClick,
  triggerLabel,
}: {
  asset: DasAsset;
  active?: boolean;
  onAssetClick?: (id: string) => void;
  triggerLabel?: ReactNode;
}) => {
  return (
    <div className="bg-[url(/gradient-bg.svg)] bg-no-repeat bg-cover">
      <div
        className={clsx('p-[3px] cursor-pointer select-none', {
          'bg-gradient-to-br from-[#F89CFF] to-[#67E6F8] -translate-[3px]':
            active,
          'bg-black': !active,
        })}
      >
        <div
          className="w-full relative"
          onClick={() => onAssetClick && onAssetClick(asset.id)}
        >
          <img
            src={`https://img-cdn.magiceden.dev/rs:fill:400:400:0:0/plain/${asset.content?.links?.image}`}
            className={clsx('aspect-square w-full', {
              'clip-path': active,
            })}
          />
          {active && triggerLabel && (
            <div className="flex items-center justify-center absolute bottom-0 w-full bg-[#F3E8F2]/53 text-black h-[19%] font-bold">
              <label className="lg:text-[1rem] md:text-[1.25vw] text-[2vw]">
                {triggerLabel}
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
