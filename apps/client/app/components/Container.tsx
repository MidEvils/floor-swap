import clsx from 'clsx';
import type { PropsWithChildren } from 'react';

export const Container = ({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) => {
  return (
    <div className={clsx('w-full h-full flex justify-center', className)}>
      {children}
    </div>
  );
};
