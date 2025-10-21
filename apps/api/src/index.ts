import { WebSocketServer } from './dos';

export * from './dos';

declare global {
	interface Env {
		WEB_SOCKET_SERVER: DurableObjectNamespace<WebSocketServer>;
	}
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const stub = env.WEB_SOCKET_SERVER.getByName('foo');
		const greeting = await stub.getAssets();

		return new Response(JSON.stringify(greeting), { headers: { 'Content-Type': 'application/json' } });
	},
} satisfies ExportedHandler<Env>;
