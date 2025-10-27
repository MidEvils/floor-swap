import { type Dispatch, type ReactNode, type SetStateAction } from 'react';
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

  return (
    <>
      <Modal open={open} setOpen={setOpen} triggerLabel={triggerLabel}>
        <div className="flex flex-col h-full w-full gap-10 justify-center p-10">
          <h1 className="text-2xl font-semibold text-black">{triggerLabel}</h1>
          <AssetCarousel
            assets={assets}
            selected={selected}
            onItemClick={toggleSelected}
            triggerLabel={triggerLabel}
            size={size}
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
