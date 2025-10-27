export * from './ws-server';
export * from './txs-listener';

export async function checkAndSetAlarm(
  ctx: DurableObjectState,
  delayMs: number
) {
  const currentAlarm = await ctx.storage.getAlarm();
  if (currentAlarm == null || currentAlarm < Date.now()) {
    await ctx.storage.setAlarm(Date.now() + delayMs);
  }
}
