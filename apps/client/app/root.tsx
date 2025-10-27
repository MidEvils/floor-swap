import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useOutletContext,
  useRouteLoaderData,
} from 'react-router';
import { Toaster } from 'react-hot-toast';

import type { Route } from './+types/root';
import './app.css';
import { WalletUiProvider } from './providers/wallet-provider';
import { Header } from './components/Header';
import { SettingsProvider } from './context/settings';
import { findPoolPda } from '@midevils/sdk';
import { address } from 'gill';
import { RpcProvider } from './context/rpc';
import { PoolProvider } from './context/pool';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'MidEvil Floor Swap' },
    { name: 'description', content: 'Swap your mids for other mids' },
  ];
}

export const links: Route.LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
  },
];

export const loader = async ({ context }: Route.LoaderArgs) => {
  const authority = address(context.cloudflare.env.AUTHORITY_ADDRESS);
  const collection = address(context.cloudflare.env.COLLECTION_ADDRESS);
  const pool = await findPoolPda({
    authority,
    collection,
  });
  return {
    authority: context.cloudflare.env.AUTHORITY_ADDRESS,
    collection: context.cloudflare.env.COLLECTION_ADDRESS,
    rpcUrl: context.cloudflare.env.RPC_URL,
    wsUrl: context.cloudflare.env.WS_URL,
    pool: pool[0],
  };
};

export function Layout({ children }: { children: React.ReactNode }) {
  const { authority, collection, rpcUrl, pool, wsUrl } =
    useRouteLoaderData('root');

  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="bg-gradient-to-b from-[#2E1804] to-[#4B2603] h-full flex flex-col">
        <PoolProvider wsUrl={wsUrl}>
          <WalletUiProvider>
            <RpcProvider rpcUrl={rpcUrl}>
              <SettingsProvider
                collection={collection}
                authority={authority}
                pool={pool}
              >
                <Header authority={authority} />
                <main className="py-10 px-10 h-full w-full">{children}</main>
              </SettingsProvider>
            </RpcProvider>
          </WalletUiProvider>
        </PoolProvider>
        <Toaster />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details =
      error.status === 404
        ? 'The requested page could not be found.'
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
