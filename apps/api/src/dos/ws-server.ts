import { DurableObject } from 'cloudflare:workers';
import { type HeliusClient, createHelius } from 'helius-sdk';
import { orderBy } from 'lodash-es';

export type Asset = Awaited<ReturnType<HeliusClient['getAsset']>>;

export class WebSocketServer extends DurableObject<Env> {
	private _connectedClients: Map<WebSocket, { connectionId: string }>;
	private _client: HeliusClient;
	private assets: Map<string, Asset> = new Map();

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this._client = createHelius({ apiKey: this.env.HELIUS_API_KEY, network: 'mainnet' });
		this._connectedClients = new Map();
		this.ctx.getWebSockets().forEach((ws) => {
			const attachment = ws.deserializeAttachment();
			if (attachment) {
				this._connectedClients.set(ws, { ...attachment });
			}
		});

		this.ctx.blockConcurrencyWhile(async () => {
			this.assets = (await this.ctx.storage.get('assets')) || new Map();
		});

		this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
	}

	async handleWebSocketUpgrade(): Promise<Response> {
		const connectionId = crypto.randomUUID();

		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);
		this.ctx.acceptWebSocket(server);

		// This is necessary to restore the state of the connection when the Durable Object wakes up.
		server.serializeAttachment({
			connectionId,
		});

		this._connectedClients.set(server, {
			connectionId,
		});

		this.onConnected(server);

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	async fetch(request: Request) {
		const res = await this.handleWebSocketUpgrade();
		return res;
	}

	async getAssets() {
		const assets = await this._client.searchAssets({
			ownerAddress: 'JCapwSzWyHkjuVrT5ZTyKwBHzV9oYrTNhZguAMc9PiEc',
			grouping: ['collection', 'w44WvLKRdLGye2ghhDJBxcmnWpBo31A1tCBko2G6DgW'],
		});

		this.assets = new Map(assets.items.map((a) => [a.id, a]));
		this._save();
		return this.list();
	}

	private _save() {
		this.ctx.waitUntil(this.ctx.storage.put('assets', this.assets));
	}

	private _emit(ws?: WebSocket) {
		if (ws) {
			ws.send(JSON.stringify(this.list()));
		} else {
			for (const [ws] of this._connectedClients.entries()) {
				ws.send(JSON.stringify(this.list()));
			}
		}
	}

	list() {
		return orderBy([...this.assets.values()], [(asset) => asset.content?.metadata.name, (asset) => asset.id], 'asc');
	}

	onConnected(ws: WebSocket) {
		this._emit(ws);
	}
}
