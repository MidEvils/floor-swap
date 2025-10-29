import type { Asset } from 'helius-sdk/types/das';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

export enum WebSocketState {
  'CONNECTING',
  'OPEN',
  'CLOSING',
  'CLOSED',
}

const Context = createContext<
  | {
      assets: Asset[];
      refresh: () => void;
      loading: boolean;
      status: WebSocketState;
    }
  | undefined
>(undefined);

export const PoolProvider = ({
  children,
  wsUrl,
}: PropsWithChildren<{ wsUrl: string }>) => {
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const pingInterval = useRef<ReturnType<typeof setInterval>>(null);

  function connectToWs(wsUrl: string) {
    setLoading(true);
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (msg) => {
      if (typeof msg.data !== 'string') {
        return;
      } else if (msg.data === 'pong') {
        console.log('server heartbeat received');
        return;
      }

      const parsed = JSON.parse(msg.data);
      setAssets(parsed);
      setLoading(false);
    };

    return socket;
  }

  function refresh() {
    if (socket) {
      setLoading(true);
      socket.send('refresh');
    } else {
      connectToWs(wsUrl);
    }
  }

  function ping(ws: WebSocket) {
    if (ws.readyState === ws.OPEN) {
      ws.send('ping');
    }
  }

  function clearPingTimer() {
    if (pingInterval.current) {
      clearInterval(pingInterval.current);
      pingInterval.current = null;
    }
  }

  function startPingTimer(ws: WebSocket) {
    ping(ws);
    pingInterval.current = setInterval(() => ping(ws), 1000 * 10); // 5m
  }

  useEffect(() => {
    if (
      !socket ||
      ![socket.OPEN, socket.CONNECTING].includes(socket.readyState as any)
    ) {
      clearPingTimer();
      const socket = connectToWs(wsUrl);
      setSocket(socket);
      startPingTimer(socket);
    } else {
      if (socket && !pingInterval.current) {
        startPingTimer(socket);
      }
    }
    return () => {
      clearPingTimer();
    };
  }, [wsUrl, socket?.readyState]);

  return (
    <Context.Provider
      value={{
        assets,
        refresh,
        loading,
        status: socket
          ? (socket?.readyState as WebSocketState)
          : WebSocketState.CLOSED,
      }}
    >
      {children}
    </Context.Provider>
  );
};

export const usePool = () => {
  const context = useContext(Context);

  if (context === undefined) {
    throw new Error('usePool must be used in a PoolProvider');
  }

  return context;
};
