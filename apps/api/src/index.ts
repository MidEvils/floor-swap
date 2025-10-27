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
    const wsServer = WebSocketServer.getInstance(env);

    try {
      // Forward the request to the WebSocketServer
      const response = await wsServer.fetch(request);
      console.log('WebSocket router: Response status:', response.status);
      return response;
    } catch (error) {
      console.error('WebSocket router: Error:', error);
      return new Response('WebSocket connection failed', { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
