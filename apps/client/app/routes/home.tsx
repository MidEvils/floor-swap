import { AssetsGrid } from '~/components/AssetsGrid';
import { useState } from 'react';

export default function Home() {
  const [size, setSize] = useState<'large' | 'small'>('large');
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
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
      <AssetsGrid size={size} />
    </div>
  );
}
