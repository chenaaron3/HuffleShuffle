'use client';

import { CircleDashed } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { type RefObject } from 'react';
import { SessionCta } from './session-cta';

export function FinalCtaSection({
  session,
  slotRef,
}: {
  session: ReturnType<typeof useSession>['data'];
  slotRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <section className="relative mx-auto mb-10 max-w-7xl px-6 sm:mb-16 sm:px-8 lg:px-12" id="final-cta">
      <div className="relative">
        {/* Panel chrome under the route (z-15) so the line + chip pass over it */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[15] rounded-[32px] border border-landing-gold/25 bg-[linear-gradient(125deg,#1c160a_0%,#111821_58%,#0c1118_100%)] shadow-[0_30px_120px_rgba(0,0,0,0.35),0_0_80px_rgba(244,201,93,0.08)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 z-[15] hidden size-80 rounded-full bg-landing-gold/10 blur-3xl sm:block"
        />

        <div className="relative z-[30] grid items-center gap-10 px-6 py-14 text-white sm:gap-12 sm:px-16 sm:py-20 lg:grid-cols-[1fr_250px]">
          <div>
            <p className="mb-4 text-xs uppercase tracking-[0.28em] text-landing-gold">Your seat is waiting</p>
            <h2 className="font-display text-4xl leading-[0.98] tracking-[-0.06em] text-[#f8e6af] sm:text-7xl">
              Ready to take
              <br />
              a seat?
            </h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-400">
              {session
                ? 'Pick a table and play with real people and real dealers in minutes. The next hand starts when you do.'
                : 'Join the waitlist for updates and early access when tables open up.'}
            </p>
            <div className="mt-8">
              <SessionCta session={session} />
            </div>
          </div>
          <div
            className="relative mx-auto grid size-[190px] place-items-center rounded-[28px] border border-dashed border-landing-gold/55 bg-transparent"
            ref={slotRef}
          >
            <div className="absolute -top-3 left-5 z-[1] rounded-full border border-landing-gold/25 bg-[#1b150a] px-3 py-1 text-[9px] uppercase tracking-[0.18em] text-landing-gold">
              on the button
            </div>
            <div className="pointer-events-none text-center opacity-35">
              <CircleDashed aria-hidden="true" className="mx-auto size-[34px] text-landing-gold/30" />
              <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-slate-600">dealer button</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
