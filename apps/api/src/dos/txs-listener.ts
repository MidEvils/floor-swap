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

const MAX_RECONNECT_DELAY_MS = 60_000;

export class TxsListener extends DurableObject<Env> {
  private _abortController: AbortController;
  private _subscriptionsRpc: ReturnType<typeof getSubscriptionsRpc>;
  private _active = false;
  private _reconnectDelay = 1000;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this._subscriptionsRpc = getSubscriptionsRpc(env.WS_URL);
    this._abortController = new AbortController();
  }

  // Real health signal. The old code tested this._abortController.signal.aborted,
  // which is never true in any real failure (subscribe throw, iterator error, DO
  // eviction), so the listener could die permanently while every checkConnected
  // no-op'd. `_active` is true only while the subscribe loop is live.
  checkConnected() {
    if (this._active) {
      return;
    }
    this.listenToTxs();
  }

  async listenToTxs() {
    if (this._active) {
      return;
    }
    this._active = true;
    this._abortController.abort();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    // Unused by the collection memcmp filter below, but derived once for clarity.
    void (
      await findPoolPda({
        authority: address(this.env.AUTHORITY_ADDRESS),
        collection: MIDEVILS_COLLECTION,
      })
    )[0];

    try {
      while (!signal.aborted) {
        try {
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
            .subscribe({ abortSignal: signal });

          // Reset backoff once we have a live subscription.
          this._reconnectDelay = 1000;

          for await (const msg of subscription) {
            if (msg.value.account) {
              await WebSocketServer.getInstance(this.env).changeDetected(
                msg.value
              );
            }
          }
        } catch (e) {
          if (signal.aborted) {
            break;
          }
          // Exponential backoff with jitter: a rate-limited / exhausted Helius
          // key must not spin in a tight resubscribe loop burning credits.
          const delay =
            Math.min(this._reconnectDelay, MAX_RECONNECT_DELAY_MS) +
            Math.floor(Math.random() * 500);
          this._reconnectDelay = Math.min(
            this._reconnectDelay * 2,
            MAX_RECONNECT_DELAY_MS
          );
          console.error('txs listener error, reconnecting', e);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    } finally {
      this._active = false;
    }
  }

  async alarm() {
    this.checkConnected();
    await checkAndSetAlarm(this.ctx, 5000);
  }

  static getInstance(env: Env) {
    return env.TXS_LISTENER.get(env.TXS_LISTENER.idFromName('singleton'));
  }
}
