'use client';

import { Gift } from 'lucide-react';
import { todayJourneySteps } from '../landing-data';
import { GoogleSignInPanel } from './google-sign-in-panel';
import { JourneySection } from './journey-section';
import { LivePanel } from './live-panel';
import { RegisterPanel } from './register-panel';

/** How the app works today: sign in → reserve a seat → play live. No real money. */
export function HowItWorksTodaySection({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <JourneySection
      heading={
        <>
          Sign in. Reserve.
          <br />
          <span className="text-landing-gold">Play live.</span>
        </>
      }
      outro={<WhyFreeCard />}
      reduceMotion={reduceMotion}
      renderPanel={(step) => {
        switch (step.key) {
          case 'sign-in':
            return <GoogleSignInPanel reduceMotion={reduceMotion} />;
          case 'register':
            return <RegisterPanel reduceMotion={reduceMotion} />;
          default:
            return <LivePanel playChips reduceMotion={reduceMotion} />;
        }
      }}
      steps={todayJourneySteps}
    />
  );
}

function WhyFreeCard() {
  return (
    <aside
      aria-labelledby="why-free-title"
      className="rounded-[30px] border border-landing-gold/25 bg-[linear-gradient(125deg,#1c160a_0%,#111821_58%,#0c1118_100%)] p-6 text-white shadow-[0_26px_100px_rgba(0,0,0,0.22),0_0_56px_rgba(244,201,93,0.06)] sm:p-8"
    >
      <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-landing-gold">
        <Gift aria-hidden="true" className="size-3.5" />
        Free to play
      </div>
      <h3
        className="font-display text-2xl tracking-[-0.04em] text-[#f8e6af] sm:text-3xl"
        id="why-free-title"
      >
        Why is HuffleShuffle free?
      </h3>
      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
        We&apos;re currently testing and growing our live online poker platform. Our games are free to
        enter, with no deposits or buy-ins. Any prizes are funded by HuffleShuffle, not by player wagers.
        Join us, experience the platform, and help us build something different.
      </p>
    </aside>
  );
}
