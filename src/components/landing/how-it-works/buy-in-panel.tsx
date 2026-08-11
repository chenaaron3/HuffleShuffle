'use client';

import { motion, useMotionValueEvent, useScroll, useTransform } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { BUY_IN_MAX, chipStack, type ChipValue } from '../landing-data';

function PokerChip({ chip, visible }: { chip: ChipValue; visible: boolean }) {
  return (
    <motion.span
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 14, scale: visible ? 1 : 0.85 }}
      className="grid size-12 place-items-center rounded-full border-[3px] border-[#f4ca67] bg-[radial-gradient(circle_at_32%_24%,#fff0a6_0_12%,#f6c94e_44%,#b8761c_100%)] font-display text-[10px] font-bold text-landing-ink shadow-[0_7px_0_rgba(66,38,7,0.75),inset_0_2px_5px_rgba(255,246,199,0.56)]"
      initial={false}
      style={{ gridColumnStart: chip.gridColumn, gridRowStart: chip.gridRow }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {chip.value}
    </motion.span>
  );
}

export function BuyInPanel({ reduceMotion }: { reduceMotion: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 75%', 'center center'],
  });
  const amountMotion = useTransform(scrollYProgress, [0, 1], [0, BUY_IN_MAX]);
  const [amount, setAmount] = useState(reduceMotion ? BUY_IN_MAX : 0);

  useMotionValueEvent(amountMotion, 'change', (value) => {
    if (reduceMotion) return;
    setAmount(Math.round(value));
  });

  useEffect(() => {
    if (reduceMotion) setAmount(BUY_IN_MAX);
  }, [reduceMotion]);

  return (
    <div className="w-full rounded-[24px] bg-landing-panel/80 p-1 sm:p-2" ref={ref}>
      <div className="grid gap-4 md:grid-cols-[0.92fr_1.08fr] md:gap-6">
        <div className="rounded-2xl border border-white/10 bg-[#080d12] p-6">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-white">Midnight Hold’em</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-landing-gold">Seat 06</span>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Buy-in</div>
              <div className="mt-3 font-display text-4xl tracking-[-0.06em] text-white">${amount}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Balance</div>
              <div className="mt-3 text-lg font-semibold text-slate-400">$420.00</div>
            </div>
          </div>
          <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full origin-left rounded-full bg-[#ffd817] shadow-[0_0_16px_rgba(255,216,23,0.35)]"
              style={{ scaleX: amount / BUY_IN_MAX }}
            />
          </div>
          <Button className="mt-8 h-12 w-full rounded-xl bg-[#ffd817] text-sm font-bold text-landing-ink hover:bg-landing-gold-bright">
            Take the seat
          </Button>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#080d12] p-6">
          <div className="flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.18em] text-slate-500">
            <span>Build your stack</span>
            <span className="text-landing-gold">$1 / $2 blinds</span>
          </div>
          <div className="mt-7 grid h-[168px] grid-cols-3 grid-rows-3 items-end justify-items-center gap-2">
            {chipStack.map((chip) => (
              <PokerChip chip={chip} key={chip.id} visible={amount >= chip.unlockAt} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
