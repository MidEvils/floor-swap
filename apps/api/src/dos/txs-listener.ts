import { DurableObject } from 'cloudflare:workers';
import {
  CORE_PROGRAM_ADDRESS,
  getRpc,
  getSubscriptionsRpc,
  MIDEVILS_COLLECTION,
} from '@midevils/shared';
import { findPoolPda } from '@midevils/sdk';
import { checkAndSetAlarm, WebSocketServer } from '.';
import { address, Base58EncodedBytes } from 'gill';

export class TxsListener extends DurableObject<Env> {
  private _abortController: AbortController;
  private _subscriptionsRpc: ReturnType<typeof getSubscriptionsRpc>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this._subscriptionsRpc = getSubscriptionsRpc(env.WS_URL);
    this._abortController = new AbortController();
  }

  checkConnected() {
    if (!this._abortController.signal.aborted) {
      return;
    }

    this.listenToTxs();
  }

  async listenToTxs() {
    console.log('updating listener');
    this._abortController.abort();
    this._abortController = new AbortController();

    const poolAddress = (
      await findPoolPda({
        authority: address(this.env.AUTHORITY_ADDRESS),
        collection: MIDEVILS_COLLECTION,
      })
    )[0];

    const subscription = await this._subscriptionsRpc
      .programNotifications(CORE_PROGRAM_ADDRESS, {
        commitment: 'confirmed',
        filters: [
          {
            memcmp: {
              bytes: MIDEVILS_COLLECTION as unknown as Base58EncodedBytes,
              encoding: 'base58',
              offset: 1n + 32n + 1n,
            },
          },
        ],
        encoding: 'base64',
      })
      .subscribe({ abortSignal: this._abortController.signal });

    try {
      for await (const msg of subscription) {
        if (msg.value.account) {
          await WebSocketServer.getInstance(this.env).changeDetected(msg.value);
        }
      }
    } catch {
      this.listenToTxs();
    }
  }

  async alarm() {
    console.log('ALARM');
    if (this._abortController.signal.aborted) {
      this.listenToTxs();
    }
    await checkAndSetAlarm(this.ctx, 5000);
  }

  static getInstance(env: Env) {
    return env.TXS_LISTENER.get(env.TXS_LISTENER.idFromName('singleton'));
  }
}
