import { usePool, WebSocketState } from '~/context/pool';
import clsx from 'clsx';

export function ConnectionStatus() {
  const { status } = usePool();
  return (
    <span className="relative flex size-3">
      {status === WebSocket.OPEN && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
      )}

      <span
        className={clsx('relative inline-flex size-3 rounded-full', {
          'bg-green-500': status === WebSocket.OPEN,
          'bg-red': status === WebSocket.CLOSED,
          'bg-orange-500': [
            WebSocketState.CONNECTING,
            WebSocketState.CLOSING,
          ].includes(status),
        })}
      ></span>
    </span>
  );
}
