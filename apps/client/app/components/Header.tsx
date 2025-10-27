import { useWalletUiAccount } from '@wallet-ui/react';
import { Wallet } from './Wallet';
import { Link } from 'react-router';

export const Header = ({ authority }: { authority: string }) => {
  const wallet = useWalletUiAccount();
  return (
    <div className="w-full h-20 border-b-red border-b-2 flex items-center justify-between px-5 py-2">
      <div className="w-[153.66px]">
        {wallet.account?.address === authority && (
          <Link to="/admin" className="text-red">
            Admin
          </Link>
        )}
      </div>
      <Link to="/" className="h-full block">
        <img src="/logo.svg" className="h-full" />
      </Link>
      <div className="w-[153.66px] text-red ">
        <Wallet />
      </div>
    </div>
  );
};
