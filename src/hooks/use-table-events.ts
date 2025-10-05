import * as React from 'react';
import { api } from '~/utils/api';

import type { gameEvents } from "~/server/db/schema";

type EventRow = typeof gameEvents.$inferSelect;

export function useTableEvents(params: { tableId: string | undefined }) {
  const { tableId } = params;
  const utils = api.useUtils();

  const [events, setEvents] = React.useState<EventRow[]>([]);
  const [lastEventId, setLastEventId] = React.useState<number | null>(null);
  const lastEventIdRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    lastEventIdRef.current = lastEventId;
  }, [lastEventId]);

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
          const ascending = [...delta].reverse();
          setEvents((prev) => [...prev, ...ascending]);
          setLastEventId(ascending[ascending.length - 1]!.id as number);
        }
      } catch (e) {
        console.error("Failed to fetch event delta", e);
      }
    },
    [tableId, utils.table.eventsDelta],
  );

  React.useEffect(() => {
    void fetchEvents(null);
  }, [tableId, fetchEvents]);

  const refreshEvents = React.useCallback(() => {
    fetchEvents(lastEventIdRef.current);
  }, [fetchEvents]);

  return { events, refreshEvents };
}
