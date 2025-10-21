import { DurableObject } from 'cloudflare:workers';
import { createHelius, HeliusClient } from 'helius-sdk';

export class TxsListener extends DurableObject<Env> {
	private _abortController: AbortController | null = null;
	private _client: HeliusClient;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this._client = createHelius({ apiKey: this.env.HELIUS_API_KEY, network: 'mainnet' });
	}

	async listenToTxs() {
		this._client.ws.logsNotifications({ mentions: FLOOR_SWAP });
	}
}
