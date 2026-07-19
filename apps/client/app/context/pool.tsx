import type { Asset } from 'helius-sdk/types/das';
import {
  createContext,
  useCallback,
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

const PING_INTERVAL_MS = 30_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

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
  const [status, setStatus] = useState<WebSocketState>(WebSocketState.CLOSED);

  const socketRef = useRef<WebSocket | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(1000);
  const unmounted = useRef(false);
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    unmounted.current = false;

    const clearPing = () => {
      if (pingTimer.current) {
        clearInterval(pingTimer.current);
        pingTimer.current = null;
      }
    };
    const clearReconnect = () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (unmounted.current || reconnectTimer.current) return;
      const delay = Math.min(reconnectDelay.current, MAX_RECONNECT_DELAY_MS);
      reconnectDelay.current = Math.min(
        reconnectDelay.current * 2,
        MAX_RECONNECT_DELAY_MS
      );
      reconnectTimer.current = setTimeout(() => {
        reconnectTimer.current = null;
        connect();
      }, delay);
    };

    const connect = () => {
      const existing = socketRef.current;
      if (
        existing &&
        (existing.readyState === WebSocket.OPEN ||
          existing.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }
      clearPing();
      setStatus(WebSocketState.CONNECTING);
      setLoading(true);

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectDelay.current = 1000;
        setStatus(WebSocketState.OPEN);
        clearPing();
        socket.send('ping');
        // Heartbeat keeps the connection alive through proxies. (Previously ran
        // every 10s while the comment claimed 5m.)
        pingTimer.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send('ping');
        }, PING_INTERVAL_MS);
      };

      socket.onmessage = (msg) => {
        if (typeof msg.data !== 'string') return;
        if (msg.data === 'pong') return;
        try {
          const parsed = JSON.parse(msg.data);
          // Only accept a well-formed asset array; a bad frame must never take
          // down the whole app (it used to crash on `.map` of a non-array).
          if (Array.isArray(parsed)) {
            setAssets(parsed);
          }
        } catch {
          // ignore malformed frames
        }
        setLoading(false);
      };

      socket.onerror = () => {
        setLoading(false);
      };

      socket.onclose = () => {
        clearPing();
        setLoading(false);
        setStatus(WebSocketState.CLOSED);
        // The server dropping us changes no React state on its own, so drive
        // reconnection from the close event (with backoff) rather than a
        // non-reactive readyState dependency.
        scheduleReconnect();
      };
    };

    const wake = () => {
      if (document.visibilityState !== 'visible') return;
      const socket = socketRef.current;
      if (
        !socket ||
        socket.readyState === WebSocket.CLOSED ||
        socket.readyState === WebSocket.CLOSING
      ) {
        reconnectDelay.current = 1000;
        clearReconnect();
        connect();
      }
    };

    refreshRef.current = () => {
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        setLoading(true);
        socket.send('refresh');
      } else {
        reconnectDelay.current = 1000;
        clearReconnect();
        connect();
      }
    };

    connect();

    // Mobile tabs get suspended; reconnect on resume / network return.
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);

    return () => {
      unmounted.current = true;
      clearPing();
      clearReconnect();
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
      const socket = socketRef.current;
      socketRef.current = null;
      socket?.close();
    };
  }, [wsUrl]);

  const refresh = useCallback(() => refreshRef.current(), []);

  return (
    <Context.Provider value={{ assets, refresh, loading, status }}>
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
