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
    const asset = await this._rpc.getAsset({ id: address }).send();
    this.staged.toAdd.push(asset);
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
    const assets = await this._rpc
      .searchAssets({
        ownerAddress: this.pool!,
        grouping: ['collection', MIDEVILS_COLLECTION],
      })
      .send();

    this._assets = new Map(assets.items.map((a) => [a.id, a]));
    this.ctx.waitUntil(this._save());
    this._emit();
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
    if (ws) {
      ws.send(JSON.stringify(this.list()));
    } else {
      for (const [ws] of this._connectedClients.entries()) {
        console.log('sending');
        ws.send(JSON.stringify(this.list()));
      }
    }
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
      await this.getAssets();
      this._emit(ws);
    }

    this._txsListener.checkConnected();
  }

  async onConnected(ws: WebSocket) {
    this._txsListener.checkConnected();
    await this.getAssets();
    this._emit(ws);
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
