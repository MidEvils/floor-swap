import {
  type Dispatch,
  type MouseEvent,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { Modal } from './Modal';
import { AssetCarousel } from './AssetCarousel';
import { useAssets } from '~/context/assets';
import { Button } from './Button';
import type { Asset } from 'helius-sdk/types/das';

export const AssetSelector = ({
  triggerLabel,
  assets,
  onAction,
  size = 'md',
  open,
  setOpen,
}: {
  triggerLabel: ReactNode;
  assets: Asset[];
  onAction: (selected: string[]) => Promise<void>;
  size?: 'sm' | 'md' | 'lg';
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}) => {
  const { selected, setSelected } = useAssets();

  function toggleSelected(id: string) {
    if (selected.includes(id)) {
      setSelected((selected) => selected.filter((s) => s !== id));
    } else {
      setSelected((selected) => [...selected, id]);
    }
  }

  const allSelected = assets.every((a) => selected.includes(a.id));

  function selectAll(e: MouseEvent<HTMLElement>) {
    e.preventDefault();
    setSelected(allSelected ? [] : assets.map((a) => a.id));
  }

  return (
    <>
      <Modal open={open} setOpen={setOpen} triggerLabel={triggerLabel}>
        <div className="flex flex-col h-full w-full gap-10 justify-center p-10">
          <div className="flex justify-between items center gap-2">
            <h1 className="text-2xl font-semibold text-black">
              {triggerLabel}
            </h1>
            <a
              href="#"
              onClick={selectAll}
              className="text-red font-semibold text-lg border-2 px-2 py1"
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </a>
          </div>
          <AssetCarousel
            assets={assets}
            selected={selected}
            onItemClick={toggleSelected}
            triggerLabel={triggerLabel}
            size={size}
            vertical
          />
          <div className="flex justify-center">
            <Button
              onClick={() => onAction(selected)}
              disabled={!selected.length}
            >
              {triggerLabel}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
