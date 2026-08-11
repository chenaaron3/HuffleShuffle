'use client';

import { animate, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { lobbyTables, type LobbyTable } from '../landing-data';
import { formatSeatCount } from '../landing-motion';

function LobbyCard({ table, duplicate = false }: { table: LobbyTable; duplicate?: boolean }) {
  return (
    <Button
      aria-hidden={duplicate}
      aria-label={`Join ${table.name}, ${formatSeatCount(table.seatsOpen, table.seatsTotal)} seats`}
      className={`block h-auto w-full rounded-xl border p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-landing-gold-bright ${
        table.featured
          ? 'border-landing-gold/55 bg-[#292818] hover:bg-[#302e1a]'
          : 'border-white/10 bg-white/[0.035] hover:bg-white/[0.07]'
      }`}
      tabIndex={duplicate ? -1 : 0}
      type="button"
      variant="ghost"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-white">{table.name}</span>
        <span
          className={`grid h-8 min-w-11 place-items-center rounded-full px-3 text-xs font-bold ${
            table.featured ? 'bg-[#ffd817] text-landing-ink' : 'border border-white/10 text-slate-400'
          }`}
        >
          {formatSeatCount(table.seatsOpen, table.seatsTotal)}
        </span>
      </div>
      <div
        className={`mt-2 text-[10px] uppercase tracking-[0.18em] ${table.featured ? 'text-landing-gold' : 'text-slate-500'}`}
      >
        {table.stakes} · {table.status}
      </div>
    </Button>
  );
}

export function LobbyPanel({ reduceMotion }: { reduceMotion: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  const [openSeats, setOpenSeats] = useState(reduceMotion ? 12 : 0);

  useEffect(() => {
    if (!isInView) return;
    if (reduceMotion) {
      setOpenSeats(12);
      return;
    }
    const controls = animate(0, 12, {
      duration: 0.9,
      onUpdate: (value) => setOpenSeats(Math.round(value)),
    });
    return () => controls.stop();
  }, [isInView, reduceMotion]);

  return (
    <div
      className="w-full overflow-hidden rounded-[24px] border border-white/10 bg-landing-panel p-6 shadow-[0_24px_65px_rgba(0,0,0,0.28)] sm:p-8"
      ref={ref}
    >
      <div className="grid items-center gap-8 md:grid-cols-[0.82fr_1.18fr]">
        <div className="flex min-h-[240px] flex-col justify-between">
          <div>
            <div className="mb-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-slate-500">
              <span className="size-1.5 rounded-full bg-landing-gold shadow-[0_0_14px_rgba(244,201,93,0.7)]" />
              Open tables
            </div>
            <h4 className="max-w-[220px] font-display text-2xl font-semibold leading-tight tracking-[-0.04em] text-white">
              Pick a room that feels like yours.
            </h4>
          </div>
          <div className="flex items-end gap-2">
            <span className="font-display text-5xl leading-none text-landing-gold-bright">{openSeats}</span>
            <span className="pb-1 text-xs text-slate-500">seats open now</span>
          </div>
        </div>
        <div className="landing-ticker-shell h-[260px] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_17%,black_84%,transparent)]">
          <div className="landing-ticker space-y-3">
            {[...lobbyTables, ...lobbyTables].map((table, index) => (
              <LobbyCard duplicate={index >= lobbyTables.length} key={`${table.id}-${index}`} table={table} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
