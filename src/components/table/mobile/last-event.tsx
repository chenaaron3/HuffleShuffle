import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { EventLine } from '~/components/table/feed/event-feed';
import { useGameEvents, useOriginalSeats } from '~/hooks/use-table-selectors';

import type { gameEvents } from '~/server/db/schema';

type EventRow = typeof gameEvents.$inferSelect;

const MAX_VISIBLE = 3;
const DISMISS_MS = 5000;

export function MobileLastEvent() {
    const events = useGameEvents();
    const seats = useOriginalSeats();
    const reduceMotion = useReducedMotion();
    const [visible, setVisible] = useState<EventRow[]>([]);
    const visibleRef = useRef<EventRow[]>([]);
    const seenIdsRef = useRef(new Set<number>());
    const timersRef = useRef(new Map<number, number>());
    const primedRef = useRef(false);

    useEffect(() => {
        visibleRef.current = visible;
    }, [visible]);

    useEffect(() => {
        return () => {
            for (const timer of timersRef.current.values()) window.clearTimeout(timer);
            timersRef.current.clear();
        };
    }, []);

    useEffect(() => {
        if (events.length === 0) {
            primedRef.current = false;
            seenIdsRef.current.clear();
            for (const timer of timersRef.current.values()) window.clearTimeout(timer);
            timersRef.current.clear();
            visibleRef.current = [];
            setVisible([]);
            return;
        }

        if (!primedRef.current) {
            for (const ev of events) seenIdsRef.current.add(ev.id as number);
            primedRef.current = true;
            return;
        }

        const incoming = events.filter((ev) => !seenIdsRef.current.has(ev.id as number));
        if (incoming.length === 0) return;

        for (const ev of incoming) seenIdsRef.current.add(ev.id as number);

        const next = [...visibleRef.current, ...incoming].slice(-MAX_VISIBLE);
        const keep = new Set(next.map((ev) => ev.id as number));

        for (const ev of visibleRef.current) {
            if (keep.has(ev.id as number)) continue;
            const timer = timersRef.current.get(ev.id as number);
            if (timer) window.clearTimeout(timer);
            timersRef.current.delete(ev.id as number);
        }

        for (const ev of incoming) {
            const id = ev.id as number;
            if (!keep.has(id) || timersRef.current.has(id)) continue;
            const timer = window.setTimeout(() => {
                visibleRef.current = visibleRef.current.filter((row) => row.id !== id);
                timersRef.current.delete(id);
                setVisible(visibleRef.current);
            }, DISMISS_MS);
            timersRef.current.set(id, timer);
        }

        visibleRef.current = next;
        setVisible(next);
    }, [events]);

    const transition = reduceMotion
        ? { duration: 0.15 }
        : { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };

    return (
        <ul
            className="flex flex-col-reverse items-end"
            aria-live="polite"
            aria-relevant="additions"
        >
            <AnimatePresence initial={false}>
                {visible.map((ev) => (
                    <motion.li
                        key={ev.id}
                        initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={transition}
                        className="overflow-hidden"
                    >
                        <div className="pt-1">
                            <div className="w-max max-w-[12.5rem] rounded-md border border-white/10 bg-black/70 px-1.5 py-0.5 text-[10px] leading-tight text-zinc-100">
                                <EventLine ev={ev} seats={seats} />
                            </div>
                        </div>
                    </motion.li>
                ))}
            </AnimatePresence>
        </ul>
    );
}
