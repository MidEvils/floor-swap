import { TxsListener, WebSocketServer } from './dos';

export * from './dos';

declare global {
  interface Env {
    WEB_SOCKET_SERVER: DurableObjectNamespace<WebSocketServer>;
    TXS_LISTENER: DurableObjectNamespace<TxsListener>;
  }
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    // Only real WebSocket upgrades should reach the durable object. Plain GETs
    // (crawlers, uptime monitors) would otherwise each open a socket and burn a
    // Helius searchAssets call.
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const wsServer = WebSocketServer.getInstance(env);

    try {
      // Forward the request to the WebSocketServer
      return await wsServer.fetch(request);
    } catch (error) {
      console.error('WebSocket router: Error:', error);
      return new Response('WebSocket connection failed', { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
