import {
  useWalletUiAccount,
  useWalletUiSigner,
  type UiWalletAccount,
} from '@wallet-ui/react';

import { address, type Account } from 'gill';
import { Container } from '~/components/Container';
import { useEffect, useState } from 'react';
import { AssetSelector } from '~/components/AssetSelector';
import { useSettings } from '~/context/settings';
import {
  closePool,
  createPool,
  deposit,
  setActive,
  setFee,
  withdraw,
} from '~/actions';
import toast from 'react-hot-toast';
import { AssetsProvider, useAssets } from '~/context/assets';
import { Modal } from '~/components/Modal';
import { Button } from '~/components/Button';
import { useRpc } from '~/context/rpc';
import clsx from 'clsx';
import { useNavigate } from 'react-router';
import { fetchMaybePool, type Pool } from '@midevils/sdk';
import { SYSTEM_PROGRAM_ADDRESS } from '@midevils/shared';
import { Wallet } from '~/components/Wallet';
import { usePool } from '~/context/pool';

function Create({ account }: { account: UiWalletAccount }) {
  const [open, setOpen] = useState(false);
  const signer = useWalletUiSigner({ account });
  const [treasury, setTreasury] = useState<string>('');
  const [treasuryError, setTreasuryError] = useState<string | null>(null);
  const [feeAmount, setFeeAmount] = useState<number | ''>('');
  const { collection } = useSettings();
  const client = useRpc();
  const navigate = useNavigate();

  const canSubmit = feeAmount && treasury;

  useEffect(() => {
    (async () => {
      if (!treasury) {
        setTreasuryError(null);
        return;
      }
      try {
        const parsed = address(treasury);
        const accInfo = await client.rpc.getAccountInfo(parsed).send();

        if (!accInfo.value || accInfo.value.owner !== SYSTEM_PROGRAM_ADDRESS) {
          throw new Error('Not a wallet address');
        }
        setTreasuryError(null);
      } catch (err: any) {
        console.log(err);
        if (err.message.includes('Expected base58-encoded address')) {
          setTreasuryError('Invalid address');
        } else {
          setTreasuryError(err.message);
        }
      }
    })();
  }, [treasury]);

  async function onAction() {
    const promise = createPool({
      client,
      authority: signer,
      treasury: address(treasury),
      feeAmount: BigInt(Number(feeAmount) * 10 ** 9),
      collection,
    });

    setOpen(false);

    toast.promise(promise, {
      loading: 'Creating pool',
      success: 'Pool created successfully',
      error: (err) => err.message || 'Error creating pool',
    });

    await promise;

    navigate('/');
  }

  return (
    <Modal triggerLabel="Create pool" open={open} setOpen={setOpen}>
      <Container className="items-center justify-center flex-col gap-10">
        <div className="flex flex-col gap-2 w-2/3 items-center">
          <h1 className="text-2xl text-black font-bold">Create pool</h1>
          <fieldset className="fieldset w-full">
            <legend className="fieldset-legend text-black">
              Enter the treasury wallet address
            </legend>
            <input
              type="text"
              className={clsx('input w-full', { 'input-error': treasuryError })}
              placeholder="Treasury wallet"
              value={treasury}
              onChange={(e) => setTreasury(e.target.value)}
            />
            {treasuryError && (
              <p className="label label-red">{treasuryError}</p>
            )}
          </fieldset>

          <fieldset className="fieldset w-full">
            <legend className="fieldset-legend text-black">
              Enter the swap fee in SOL
            </legend>
            <input
              type="number"
              className={clsx('input w-full')}
              placeholder="Swap fee in SOL"
              value={feeAmount}
              onChange={(e) =>
                setFeeAmount(e.target.value ? Number(e.target.value) : '')
              }
            />
          </fieldset>
        </div>
        <Button disabled={!canSubmit} onClick={onAction}>
          Create pool
        </Button>
      </Container>
    </Modal>
  );
}

function UpdateFee({ account }: { account: UiWalletAccount }) {
  const [open, setOpen] = useState(false);
  const signer = useWalletUiSigner({ account });
  const [feeAmount, setFeeAmount] = useState<number | ''>('');
  const { pool } = useSettings();
  const client = useRpc();

  const canSubmit = feeAmount;

  async function onAction() {
    const promise = setFee({
      client,
      pool,
      feeAmount: BigInt(Number(feeAmount) * 10 ** 9),
      signer,
    });

    setOpen(false);

    toast.promise(promise, {
      loading: 'Updating fee',
      success: 'Fee updated successfully',
      error: (err) => err.message || 'Error updating fee',
    });

    await promise;
  }

  return (
    <Modal triggerLabel="Update fee" open={open} setOpen={setOpen}>
      <Container className="items-center justify-center flex-col gap-10">
        <div className="flex flex-col gap-2 w-2/3 items-center">
          <h1 className="text-2xl text-black font-bold">Update fee</h1>

          <fieldset className="fieldset w-full">
            <legend className="fieldset-legend text-black">
              Enter the swap fee in SOL
            </legend>
            <input
              type="number"
              className={clsx('input w-full')}
              placeholder="Swap fee in SOL"
              value={feeAmount}
              onChange={(e) =>
                setFeeAmount(e.target.value ? Number(e.target.value) : '')
              }
            />
          </fieldset>
        </div>
        <Button disabled={!canSubmit} onClick={onAction}>
          Update fee
        </Button>
      </Container>
    </Modal>
  );
}

function ToggleActive({
  account,
  poolAcc,
}: {
  account: UiWalletAccount;
  poolAcc: Account<Pool>;
}) {
  const [open, setOpen] = useState(false);
  const signer = useWalletUiSigner({ account });
  const [isActive, setIsActive] = useState<boolean>(poolAcc.data.enabled);
  const { pool } = useSettings();
  const client = useRpc();

  async function onAction(isActive: boolean) {
    const promise = setActive({
      client,
      pool,
      active: isActive,
      signer,
    });

    setOpen(false);

    toast.promise(promise, {
      loading: isActive ? 'Activating pool' : 'Disabling pool',
      success: 'Pool updated successfully',
      error: (err) => err.message || 'Error updating pool',
    });

    await promise;

    setIsActive(isActive);
  }

  return (
    <Modal triggerLabel="Toggle pool active" open={open} setOpen={setOpen}>
      <Container className="items-center justify-center flex-col gap-10">
        <div className="flex flex-col gap-2 w-2/3 items-center">
          <h1 className="text-2xl text-black font-bold">Toggle pool active</h1>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => onAction(e.target.checked)}
            className="toggle toggle-xl"
          />
        </div>
      </Container>
    </Modal>
  );
}

function ClosePool({ account }: { account: UiWalletAccount }) {
  const [open, setOpen] = useState(false);
  const signer = useWalletUiSigner({ account });
  const { pool } = useSettings();
  const client = useRpc();
  const navigate = useNavigate();

  async function onAction() {
    const promise = closePool({
      client,
      pool,
      signer,
    });

    setOpen(false);

    toast.promise(promise, {
      loading: 'Closing pool',
      success: 'Pool closed successfully',
      error: (err) => err.message || 'Error closing pool',
    });

    await promise;
    navigate('/admin');
  }

  return (
    <Modal triggerLabel="Close pool" open={open} setOpen={setOpen}>
      <Container className="items-center justify-center flex-col gap-10">
        <div className="flex flex-col gap-2 w-2/3 items-center">
          <h1 className="text-2xl text-black font-bold">Close pool</h1>
          <p className="text-black">
            You should make sure all assets are removed before closing the pool
          </p>
          <Button onClick={onAction}>Close pool</Button>
        </div>
      </Container>
    </Modal>
  );
}

function Deposit({ account }: { account: UiWalletAccount }) {
  const [open, setOpen] = useState(false);
  const signer = useWalletUiSigner({ account });
  const client = useRpc();
  const { collection, pool } = useSettings();
  const { removeAssets, assets } = useAssets();

  async function onAction(assets: string[]) {
    const promise = deposit({
      client,
      collection,
      pool,
      assets: assets.map(address),
      signer,
    });

    setOpen(false);

    toast.promise(promise, {
      loading: `Depositing assets`,
      success: 'Deposited successfully',
      error: (err) => err.message || 'Error depositing assets',
    });

    await promise;

    removeAssets(assets);
  }

  return (
    <AssetSelector
      open={open}
      setOpen={setOpen}
      assets={assets}
      onAction={onAction}
      triggerLabel="Deposit"
    />
  );
}

function Withdraw({ account }: { account: UiWalletAccount }) {
  const [open, setOpen] = useState(false);
  const { pool, collection } = useSettings();
  const client = useRpc();
  const signer = useWalletUiSigner({ account });
  const { addAssets } = useAssets();
  const poolAssets = usePool();

  async function onAction(assets: string[]) {
    const promise = withdraw({
      client,
      collection,
      pool,
      assets: assets.map(address),
      signer,
    });

    setOpen(false);

    toast.promise(promise, {
      loading: `Withdrawing assets`,
      success: 'Assets withdrawn successfully',
      error: (err) => err.message || 'Error withdrawing assets',
    });

    await promise;
    addAssets(poolAssets.filter((p) => assets.includes(p.id)));
  }

  return (
    <AssetSelector
      open={open}
      setOpen={setOpen}
      assets={poolAssets}
      triggerLabel="Withdraw"
      onAction={onAction}
    />
  );
}

export default function Admin() {
  const { account } = useWalletUiAccount();
  const [poolAcc, setPoolAcc] = useState<Account<Pool> | null>(null);
  const client = useRpc();
  const { pool } = useSettings();

  useEffect(() => {
    (async () => {
      const poolAcc = await fetchMaybePool(client.rpc, pool);
      if (poolAcc.exists) {
        setPoolAcc(poolAcc);
      } else {
        setPoolAcc(null);
      }
    })();
  }, []);

  if (!account) {
    return <Wallet />;
  }

  return (
    <Container>
      <div className="flex flex-col gap-2 w-2/3 justify-center">
        {poolAcc ? (
          <>
            <UpdateFee account={account} />
            <ToggleActive account={account} poolAcc={poolAcc} />
            <AssetsProvider owner={account.address}>
              <Deposit account={account} />
              <Withdraw account={account} />
            </AssetsProvider>
            <ClosePool account={account} />
          </>
        ) : (
          <Create account={account} />
        )}
      </div>
    </Container>
  );
}
