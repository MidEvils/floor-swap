import { AssetsGrid } from '~/components/AssetsGrid';
import { useState } from 'react';
import { usePool } from '~/context/pool';
import clsx from 'clsx';
import { ConnectionStatus } from '~/components/Connected';

export default function Home() {
  const [size, setSize] = useState<'large' | 'small'>('large');
  const { assets, loading, refresh } = usePool();
  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex gap-1 justify-between items-center">
        <div className="flex gap-1">
          <button
            className="border-2 border-red p-2 h-10 cursor-pointer flex text-red gap-2 font-bold"
            onClick={refresh}
          >
            <span className={clsx({ 'animate-spin': loading })}>
              <img src="/refresh.svg" className="block scale-x-[-1] h-full" />
            </span>
            {`${assets.length} Item${assets.length === 1 ? '' : 's'}`}
          </button>
          <button
            className="border-2 border-red p-2 w-10 h-10 block cursor-pointer"
            onClick={() => setSize('small')}
          >
            <img src="/grid-sm.svg" className="block" />
          </button>
          <button
            className="border-2 border-red p-2 w-10 h-10 block cursor-pointer"
            onClick={() => setSize('large')}
          >
            <img src="/grid-lg.svg" className="block" />
          </button>
        </div>

        <ConnectionStatus />
      </div>
      <AssetsGrid size={size} />
    </div>
  );
}
