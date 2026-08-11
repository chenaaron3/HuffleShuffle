'use client';

import { motion, useInView } from 'framer-motion';
import Image from 'next/image';
import { useRef } from 'react';
import { mayaDealerImage } from '../landing-data';

export function LivePanel({ reduceMotion }: { reduceMotion: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <div
      className="grid w-full gap-4 rounded-[24px] border border-white/10 bg-landing-panel p-5 md:grid-cols-[0.95fr_1.05fr]"
      ref={ref}
    >
      <motion.div
        animate={isInView || reduceMotion ? { opacity: 1, scale: 1.02 } : { opacity: 0, scale: 1.08 }}
        className="relative min-h-[360px] overflow-hidden rounded-2xl border border-landing-gold/20 bg-[#111a1b]"
        initial={reduceMotion ? false : { opacity: 0, scale: 1.08 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      >
        <Image
          alt="Maya, a live poker dealer dealing cards at a green-felt table"
          className="absolute inset-0 h-full w-full object-cover object-center saturate-[0.88] contrast-[1.06]"
          fill
          loading="lazy"
          sizes="(min-width: 768px) 360px, 90vw"
          src={mayaDealerImage}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,11,17,0.08),rgba(8,11,17,0.18)_52%,rgba(8,11,17,0.92))]" />
        <div className="absolute left-4 right-4 top-4 flex items-center justify-between text-[10px] uppercase tracking-[0.18em]">
          <span className="text-slate-300">Dealer cam</span>
          <span className="flex items-center gap-2 text-emerald-200">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-300" />
            live
          </span>
        </div>
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-white">Maya</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-landing-gold-bright">your dealer</div>
          </div>
          <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-[10px] text-slate-300">
            Real table. Real deck.
          </span>
        </div>
      </motion.div>
      <div className="flex min-h-[360px] flex-col rounded-2xl border border-white/10 bg-white/[0.025] p-4">
        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Your hand</div>
            <div className="mt-1 text-sm font-semibold text-white">Golden Hour</div>
          </div>
          <span className="rounded-full border border-landing-gold/25 bg-landing-gold/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-landing-gold-bright">
            your turn
          </span>
        </div>
        <div className="relative flex flex-1 flex-col justify-center rounded-xl border border-landing-gold/15 bg-[radial-gradient(ellipse_at_center,#25462d_0%,#12261c_55%,#0b1410_100%)] p-4">
          <div className="mb-5 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-slate-500">
            <span>Hand 0482</span>
            <span className="text-emerald-300">streaming</span>
          </div>
          <div className="flex justify-center gap-2">
            {['A♥', 'K♠'].map((card, index) => (
              <motion.span
                animate={
                  isInView || reduceMotion
                    ? { opacity: 1, y: 0, rotate: index ? 3 : -3 }
                    : { opacity: 0, y: 16, rotate: index ? 6 : -6 }
                }
                className={`grid h-16 w-12 place-items-center rounded-lg border border-white/20 bg-[#f3eee1] text-center shadow-[0_10px_25px_rgba(0,0,0,0.28)] ${index ? 'text-slate-800' : 'text-[#b52b35]'}`}
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                key={card}
                transition={{ delay: index * 0.12, duration: 0.55, type: 'spring', stiffness: 250, damping: 20 }}
              >
                {card[0]}
                <span className="text-[18px]">{card[1]}</span>
              </motion.span>
            ))}
          </div>
          <div className="mt-6 flex justify-center gap-1.5">
            <span className="grid h-9 w-7 place-items-center rounded border border-white/20 bg-[#f3eee1] text-sm text-rose-500">
              7♦
            </span>
            <span className="grid h-9 w-7 place-items-center rounded border border-white/20 bg-[#f3eee1] text-sm text-slate-800">
              J♣
            </span>
            <span className="grid h-9 w-7 place-items-center rounded border border-white/20 bg-[#f3eee1] text-sm text-rose-500">
              2♥
            </span>
          </div>
          <div className="mt-auto flex items-center justify-between pt-5 text-[10px] uppercase tracking-[0.16em] text-slate-500">
            <span>Pot $420</span>
            <span className="text-landing-gold-bright">Call $2 ↗</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-500">
          <span className="size-2 rounded-full bg-landing-gold" />
          Dealer ready. Good luck.
        </div>
      </div>
    </div>
  );
}
