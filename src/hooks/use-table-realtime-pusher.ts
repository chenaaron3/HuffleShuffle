"use client";

import * as React from "react";
import { getPusherClient } from "~/utils/pusher-client";
import { SIGNALS } from "~/utils/signal-constants";

/**
 * Single debounce timer per table (module scope). If two Pusher handlers are bound to the same
 * channel (e.g. duplicate bind during dev/HMR), each effect closure had its own `debounceTimer`,
 * so clearing one did not cancel the other — both fired and caused duplicate `table.get` calls.
 */
const tableRealtimeRefetchTimers = new Map<
  string,
  ReturnType<typeof setTimeout>
>();
const TABLE_REALTIME_DEBOUNCE_MS = 400;

export interface UseTableRealtimePusherParams {
  tableId: string | undefined;
  refetch: () => void | Promise<unknown>;
  refreshEventFeed: () => void;
}

/**
 * Subscribes to Pusher `TABLE_UPDATED` for the table channel, debounces refetch + event-feed
 * refresh with a module-level timer per `tableId` so duplicate bindings still coalesce.
 */
export function useTableRealtimePusher({
  tableId,
  refetch,
  refreshEventFeed,
}: UseTableRealtimePusherParams) {
  const refetchRef = React.useRef(refetch);
  const refreshEventFeedRef = React.useRef(refreshEventFeed);
  refetchRef.current = refetch;
  refreshEventFeedRef.current = refreshEventFeed;

  React.useEffect(() => {
    if (!tableId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channel = pusher.subscribe(tableId);

    const onTableUpdated = () => {
      const existing = tableRealtimeRefetchTimers.get(tableId);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        tableRealtimeRefetchTimers.delete(tableId);
        void refetchRef.current();
        refreshEventFeedRef.current();
      }, TABLE_REALTIME_DEBOUNCE_MS);
      tableRealtimeRefetchTimers.set(tableId, t);
    };

    channel.bind(SIGNALS.TABLE_UPDATED, onTableUpdated);

    return () => {
      const pending = tableRealtimeRefetchTimers.get(tableId);
      if (pending) clearTimeout(pending);
      tableRealtimeRefetchTimers.delete(tableId);
      channel.unbind(SIGNALS.TABLE_UPDATED, onTableUpdated);
      pusher.unsubscribe(tableId);
    };
  }, [tableId]);
}
