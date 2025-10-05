import { pusher } from '~/server/pusher';
import { DEVICE_CHANNEL, SIGNALS, TABLE_CHANNEL } from '~/utils/signal-constants';

import type { HandStartPayload } from "~/utils/signal-constants";

export async function startHandStream(
  serial: string,
  payload: HandStartPayload,
): Promise<void> {
  if (!pusher) return;
  try {
    await pusher.trigger(DEVICE_CHANNEL(serial), SIGNALS.HAND_START, payload);
  } catch (e) {
    console.error("startHandStream failed", e);
  }
}

export async function endHandStream(serial: string): Promise<void> {
  if (!pusher) return;
  try {
    await pusher.trigger(DEVICE_CHANNEL(serial), SIGNALS.HAND_STOP, {});
  } catch (e) {
    console.error("endHandStream failed", e);
  }
}

export async function startDealerStream(serial: string): Promise<void> {
  if (!pusher) return;
  try {
    await pusher.trigger(DEVICE_CHANNEL(serial), SIGNALS.DEALER_START, {});
  } catch (e) {
    console.error("startDealerStream failed", e);
  }
}

export async function endDealerStream(serial: string): Promise<void> {
  if (!pusher) return;
  try {
    await pusher.trigger(DEVICE_CHANNEL(serial), SIGNALS.DEALER_STOP, {});
  } catch (e) {
    console.error("endDealerStream failed", e);
  }
}

export async function updateTable(tableId: string): Promise<void> {
  if (!pusher) return;
  try {
    await pusher.trigger(TABLE_CHANNEL(tableId), SIGNALS.TABLE_UPDATED, {
      tableId,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("updateTable failed", e);
  }
}
