import * as React from 'react';
import { api } from '~/utils/api';

import type { gameEvents } from "~/server/db/schema";

type EventRow = typeof gameEvents.$inferSelect;

/** Max events kept in memory for the feed (newest by id). */
const MAX_EVENTS = 25;

export function useTableEvents(params: { tableId: string | undefined }) {
  const { tableId } = params;
  const utils = api.useUtils();
  const utilsRef = React.useRef(utils);
  utilsRef.current = utils;

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
        const res = await utilsRef.current.table.eventsDelta.fetch({
          tableId,
          afterId: after,
        });
        const delta = res?.events ?? [];
        if (delta.length) {
          const ascending = [...delta].reverse();
          setEvents((prev) => {
            const merged = new Map<number, EventRow>();
            for (const e of prev) merged.set(e.id as number, e);
            for (const e of ascending) merged.set(e.id as number, e);
            const next = Array.from(merged.values()).sort(
              (a, b) => (a.id as number) - (b.id as number),
            );
            return next.length <= MAX_EVENTS
              ? next
              : next.slice(-MAX_EVENTS);
          });
          const lastInBatch = ascending[ascending.length - 1]!.id as number;
          setLastEventId((prevLast) =>
            prevLast === null ? lastInBatch : Math.max(prevLast, lastInBatch),
          );
        }
      } catch (e) {
        console.error("Failed to fetch event delta", e);
      }
    },
    [tableId],
  );

  React.useEffect(() => {
    void fetchEvents(null);
  }, [tableId, fetchEvents]);

  const refreshEvents = React.useCallback(() => {
    fetchEvents(lastEventIdRef.current);
  }, [fetchEvents]);

  return { events, refreshEvents };
}
