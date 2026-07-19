import { DurableObject } from 'cloudflare:workers';
import { Asset } from 'helius-sdk/types/das';
import { chunk, isEqual, orderBy } from 'lodash-es';
import { getRpc, MIDEVILS_COLLECTION } from '@midevils/shared';
import { findPoolPda } from '@midevils/sdk';
import {
  AccountInfoBase,
  AccountInfoWithBase64EncodedData,
  AccountInfoWithPubkey,
  Address,
  address,
  getBase64Encoder,
} from 'gill';
import { checkAndSetAlarm, TxsListener } from '.';
import { getAssetV1Decoder } from '@midevils/mpl-core';

const MAX_DELETES = 128;
const MAX_PUTS = 128;
// Serve connections/refreshes from the in-memory cache and only hit Helius when
// the cache is empty or older than this. The tx listener keeps it fresher than
// the TTL in practice; this is the ceiling on how stale a served list can be.
const CACHE_TTL_MS = 60_000;

export class WebSocketServer extends DurableObject<Env> {
  private _connectedClients: Map<WebSocket, { connectionId: string }>;
  private _rpc: ReturnType<typeof getRpc>;
  private _assets: Map<string, Asset> = new Map();
  private _txsListener: DurableObjectStub<TxsListener>;
  private staged: {
    toRemove: Asset[];
    toAdd: Asset[];
  } = {
    toRemove: [],
    toAdd: [],
  };
  pool: Address | null = null;
  private _lastFetch = 0;
  private _refreshing: Promise<void> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this._rpc = getRpc(env.RPC_URL);
    this._connectedClients = new Map();
    this._txsListener = TxsListener.getInstance(this.env);

    this.ctx.getWebSockets().forEach((ws) => {
      const attachment = ws.deserializeAttachment();
      if (attachment) {
        this._connectedClients.set(ws, { ...attachment });
      }
    });

    this._txsListener.listenToTxs();

    this.ctx.blockConcurrencyWhile(async () => {
      this._assets = (await this.ctx.storage.list()) || new Map();
      this.pool = (
        await findPoolPda({
          authority: address(this.env.AUTHORITY_ADDRESS),
          collection: MIDEVILS_COLLECTION,
        })
      )[0];
      if (!this._assets.size) {
        await this.getAssets();
      }
    });

    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong')
    );
  }

  async changeDetected(
    acc: AccountInfoWithPubkey<
      AccountInfoBase & AccountInfoWithBase64EncodedData
    >
  ) {
    const existing = this._assets.get(acc.pubkey);
    const data = getBase64Encoder().encode(acc.account.data[0]);
    const asset = getAssetV1Decoder().decode(data);

    if (asset.owner === this.pool && !existing) {
      await this.addAsset(acc.pubkey);
    } else if (existing) {
      this.staged.toRemove.push(existing);
    }

    while (this.staged.toAdd.length && this.staged.toRemove.length) {
      const toRemove = this.staged.toRemove.pop()!;
      const toAdd = this.staged.toAdd.pop()!;
      this._assets.delete(toRemove.id);
      this._assets.set(toAdd.id, toAdd);
      this.ctx.waitUntil(this._save());
      this._emit();
    }
  }

  async addAsset(address: Address) {
    try {
      const asset = await this._rpc.getAsset({ id: address }).send();
      this.staged.toAdd.push(asset);
    } catch (e) {
      // A transient getAsset failure must not propagate: this runs inside the
      // tx-listener's DO RPC call, and an unhandled throw there tears down and
      // resubscribes the whole Helius subscription, dropping this event.
      console.error('addAsset: getAsset failed', e);
    }
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

  // Force a fresh Helius fetch. Used on cold start and by the periodic alarm.
  async getAssets() {
    const assets = await this._rpc
      .searchAssets({
        ownerAddress: this.pool!,
        grouping: ['collection', MIDEVILS_COLLECTION],
      })
      .send();

    this._assets = new Map(assets.items.map((a) => [a.id, a]));
    this._lastFetch = Date.now();
    this.ctx.waitUntil(this._save());
    this._emit();
  }

  // Refresh from Helius only when the cache is empty or stale, and share one
  // in-flight fetch across concurrent callers (so N simultaneous reconnects
  // cost one searchAssets, not N).
  private ensureAssets(): Promise<void> {
    const fresh =
      this._assets.size > 0 && Date.now() - this._lastFetch < CACHE_TTL_MS;
    if (fresh) return Promise.resolve();
    if (this._refreshing) return this._refreshing;
    this._refreshing = this.getAssets().finally(() => {
      this._refreshing = null;
    });
    return this._refreshing;
  }

  private async _save() {
    const toSave: Array<[Asset['id'], Asset]> = [];
    const toDelete: Asset['id'][] = [];
    const fromStorage = await this.ctx.storage.list();

    for (const [id, order] of this._assets.entries()) {
      const existing = fromStorage.get(id);
      if (!existing || !isEqual(existing, order)) {
        toSave.push([id, order]);
      }
    }
    for (const [id] of fromStorage.entries()) {
      if (!this._assets.has(id)) {
        toDelete.push(id);
      }
    }

    await Promise.all([
      Promise.all(
        chunk(toSave, MAX_PUTS).map((items) =>
          this.ctx.storage.put(Object.fromEntries(items))
        )
      ),
      Promise.all(
        chunk(toDelete, MAX_DELETES).map((ids) => this.ctx.storage.delete(ids))
      ),
    ]);
  }

  private _emit(ws?: WebSocket) {
    const payload = JSON.stringify(this.list());
    if (ws) {
      this._safeSend(ws, payload);
      return;
    }
    for (const [client] of this._connectedClients.entries()) {
      this._safeSend(client, payload);
    }
  }

  // send() throws on a CLOSING/CLOSED socket; a dead client must not abort the
  // broadcast for everyone else, so drop it from the map instead.
  private _safeSend(ws: WebSocket, payload: string) {
    try {
      ws.send(payload);
    } catch {
      this._connectedClients.delete(ws);
    }
  }

  async webSocketClose(ws: WebSocket) {
    this._connectedClients.delete(ws);
  }

  async webSocketError(ws: WebSocket) {
    this._connectedClients.delete(ws);
  }

  list() {
    return orderBy(
      [...this._assets.values()],
      [(asset) => asset.content?.metadata.name, (asset) => asset.id],
      'asc'
    );
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    if (typeof message !== 'string') {
      console.error('Received non-string message');
      return;
    }

    if (message === 'refresh') {
      // Serve the cached list immediately; only re-fetch if stale (single-flight).
      this.ctx.waitUntil(this.ensureAssets());
      this._emit(ws);
    }

    this._txsListener.checkConnected();
  }

  async onConnected(ws: WebSocket) {
    this._txsListener.checkConnected();
    // Serve what we already have, then refresh in the background if stale.
    this._emit(ws);
    this.ctx.waitUntil(this.ensureAssets());
  }

  alarm() {
    this.ctx.waitUntil(this.getAssets());
    this.ctx.waitUntil(checkAndSetAlarm(this.ctx, 1000 * 60 * 10)); // 10 mins
  }

  static getInstance(env: Env) {
    return env.WEB_SOCKET_SERVER.get(
      env.WEB_SOCKET_SERVER.idFromName('singleton')
    );
  }
}
