import clsx from 'clsx';
import type { Asset } from 'helius-sdk/types/das';

export const FramedImg = ({
  asset,
  hideOnMobile,
}: {
  asset: Asset;
  hideOnMobile?: boolean;
}) => {
  return (
    <div
      className={clsx('flex flex-col items-center gap-2 h-full md:block', {
        hidden: hideOnMobile,
      })}
    >
      <div className="md:h-[90%] h-[70%] aspect-[5/6] bg-cover bg-[url(/frame.png)] flex items-center justify-center">
        <div
          style={{
            backgroundImage: `url(https://img-cdn.magiceden.dev/rs:fill:400:400:0:0/plain/${asset.content?.links?.image})`,
          }}
          className="w-[70%] aspect-[5/6.5] bg-center bg-size-[127%] bg-no-repeat"
        />
      </div>
      <p className="text-black lg:text-[1rem] md:text-[1.5vw] text-[1.5rem] font-semibold">
        {asset.content?.metadata.name}
      </p>
    </div>
  );
};
