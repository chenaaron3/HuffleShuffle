import { useEffect, useRef } from 'react';

import { useSoundEffects } from '~/components/providers/SoundProvider';

import type { gameEvents } from '~/server/db/schema';

type EventRow = typeof gameEvents.$inferSelect;

/**
 * Plays when new RAISE rows appear in the table event feed (not on initial history load).
 */
export function useRaiseEventSound(params: {
  tableId: string | undefined;
  events: EventRow[];
}) {
  const { tableId, events } = params;
  const { play } = useSoundEffects();
  const prevMaxEventIdRef = useRef<number | null>(null);

  useEffect(() => {
    prevMaxEventIdRef.current = null;
  }, [tableId]);

  useEffect(() => {
    if (!events.length) {
      return;
    }

    let maxId = events[0]!.id;
    for (let i = 1; i < events.length; i++) {
      maxId = Math.max(maxId, events[i]!.id);
    }

    if (prevMaxEventIdRef.current === null) {
      prevMaxEventIdRef.current = maxId;
      return;
    }

    const prevMax = prevMaxEventIdRef.current;
    for (const e of events) {
      const id = e.id;
      if (id > prevMax && e.type === 'RAISE') {
        play('playerRaise', { interrupt: false });
      }
    }
    prevMaxEventIdRef.current = maxId;
  }, [events, play]);
}
