import clsx from 'clsx';
import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

export const Button = ({
  children,
  className,
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) => {
  return (
    <button
      className={clsx(
        'btn diamond text-black rounded-none border-0 btn-lg',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};
