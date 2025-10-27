import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { Button } from './Button';

export function ControlledModal({
  children,
  triggerLabel,
}: PropsWithChildren<{ triggerLabel: ReactNode }>) {
  const [open, setOpen] = useState(false);

  return (
    <Modal open={open} setOpen={setOpen} triggerLabel={triggerLabel}>
      {children}
    </Modal>
  );
}

export function Modal({
  children,
  triggerLabel,
  trigger,
  open,
  setOpen,
}: PropsWithChildren<{
  triggerLabel?: ReactNode;
  trigger?: ReactNode;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}>) {
  const ref = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    if (!open) {
      ref.current?.close();
    } else if (open) {
      ref.current?.showModal();
    }
  }, [open]);

  const openModal = useCallback(() => {
    setOpen(true);
  }, [setOpen]);

  const closeModal = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  return (
    <>
      {trigger ? (
        <button onClick={openModal}>{trigger}</button>
      ) : (
        <Button onClick={openModal}>{triggerLabel}</Button>
      )}

      <dialog ref={ref} className="modal" onClose={closeModal}>
        <div className="modal-box md:bg-[url(/modal-bg.svg)] md:w-[unset] w-full overflow-hidden bg-[length:100%_100%] lg:h-3/4 md:h-[unset] h-full max-w-[unset] bg-transparent md:aspect-[4/2.9] w-[unset] bg-cover md:p-10 md:pr-20 overflow-hidden">
          {children}
        </div>

        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  );
}
