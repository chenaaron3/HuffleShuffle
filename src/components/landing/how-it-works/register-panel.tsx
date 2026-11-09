'use client';

import { motion, useInView } from 'framer-motion';
import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const SEATS = 8;
/** Other players already registered, in order. */
const OTHERS = [
  { initials: 'MK', color: 'bg-sky-400/80' },
  { initials: 'JL', color: 'bg-violet-400/80' },
  { initials: 'PR', color: 'bg-emerald-400/80' },
  { initials: 'DT', color: 'bg-rose-400/80' },
  { initials: 'SN', color: 'bg-orange-400/80' },
];

/** Mock of the lobby's tournament card: seats fill in, then you reserve one. */
export function RegisterPanel({ reduceMotion }: { reduceMotion: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const [filled, setFilled] = useState(reduceMotion ? OTHERS.length : 0);
  const [pressed, setPressed] = useState(false);
  const [reserved, setReserved] = useState(reduceMotion);

  useEffect(() => {
    if (reduceMotion) {
      setFilled(OTHERS.length);
      setReserved(true);
      return;
    }
    if (!isInView) return;
    const timers = OTHERS.map((_, i) => setTimeout(() => setFilled(i + 1), 150 + i * 140));
    const fillDone = 150 + OTHERS.length * 140;
    timers.push(setTimeout(() => setPressed(true), fillDone + 350));
    timers.push(
      setTimeout(() => {
        setPressed(false);
        setReserved(true);
      }, fillDone + 550),
    );
    return () => timers.forEach(clearTimeout);
  }, [isInView, reduceMotion]);

  const seatsTaken = filled + (reserved ? 1 : 0);

  return (
    <div
      className="w-full rounded-[24px] border border-white/10 bg-landing-panel p-5 shadow-[0_24px_65px_rgba(0,0,0,0.28)] sm:p-7"
      ref={ref}
    >
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-landing-gold">Sun · 3:00 PM EST</p>
            <p className="mt-1 font-display text-lg font-semibold leading-tight text-white">Sunday 3pm</p>
            <p className="text-sm text-zinc-400">Huffle Table</p>
          </div>
          <ul aria-label={`${seatsTaken} of ${SEATS} seats taken`} className="flex -space-x-2">
            {Array.from({ length: SEATS }, (_, i) => {
              const other = i < filled ? OTHERS[i] : undefined;
              const isYou = reserved && i === filled;
              return (
                <li key={i}>
                  {other ?? isYou ? (
                    <motion.span
                      animate={{ scale: 1, opacity: 1 }}
                      className={`grid size-7 place-items-center rounded-full text-[10px] font-semibold ring-2 ${
                        isYou
                          ? 'bg-landing-gold text-landing-ink ring-landing-gold'
                          : `${other?.color} text-white ring-zinc-950`
                      }`}
                      initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                    >
                      {isYou ? 'You' : other?.initials}
                    </motion.span>
                  ) : (
                    <span className="block size-7 rounded-full border border-dashed border-white/20 bg-zinc-900 ring-2 ring-zinc-950" />
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/5 pt-3">
          {reserved ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-landing-gold">
              <Check aria-hidden="true" className="size-4" /> Seat reserved
            </span>
          ) : (
            <span className="text-sm text-zinc-500">{SEATS - seatsTaken} seats left</span>
          )}
          {!reserved && (
            <motion.span
              animate={{ scale: pressed ? 0.94 : 1 }}
              className="rounded-lg bg-landing-gold px-3.5 py-1.5 text-sm font-semibold text-landing-ink"
              transition={{ duration: 0.15 }}
            >
              Reserve seat
            </motion.span>
          )}
        </div>
      </div>
    </div>
  );
}
