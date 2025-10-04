import * as React from 'react';
import { api } from '~/utils/api';
import { getPusherClient } from '~/utils/pusher-client';

import type { RouterOutputs } from "~/utils/api";

type EventRow = RouterOutputs["table"]["eventsDelta"]["events"][number];

export function useTableEvents(params: {
  tableId: string | undefined;
  activeGameId: string | null | undefined;
}) {
  const { tableId, activeGameId } = params;
  const utils = api.useUtils();

  const [events, setEvents] = React.useState<EventRow[]>([]);
  const [lastEventId, setLastEventId] = React.useState<number | null>(null);

  const fetchEvents = React.useCallback(
    async (after: number | null) => {
      if (!tableId) return;
      try {
        const res = await utils.table.eventsDelta.fetch({
          tableId,
          afterId: after,
        });
        const delta = res?.events ?? [];
        if (delta.length) {
          setEvents((prev) => [...prev, ...delta]);
          setLastEventId(delta[delta.length - 1]!.id as number);
        }
      } catch (e) {
        console.error("Failed to fetch event delta", e);
      }
    },
    [tableId, utils.table.eventsDelta],
  );

  // Pusher-triggered delta pulls
  React.useEffect(() => {
    if (!tableId) return;
    const pusher = getPusherClient();
    if (!pusher) return;
    const channel = pusher.subscribe(tableId);
    const handler = () => {
      void fetchEvents(lastEventId);
    };
    channel.bind("table-updated", handler);
    return () => {
      channel.unbind("table-updated", handler);
      pusher.unsubscribe(tableId);
    };
    // We intentionally exclude fetchEvents from deps to avoid re-subscribing each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, lastEventId]);

  return { events };
}
