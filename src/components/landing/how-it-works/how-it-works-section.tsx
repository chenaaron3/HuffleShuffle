'use client';

import { walletJourneySteps } from '../landing-data';
import { BuyInPanel } from './buy-in-panel';
import { JourneySection } from './journey-section';
import { LivePanel } from './live-panel';
import { LobbyPanel } from './lobby-panel';
import { SignInPanel } from './sign-in-panel';

/**
 * Wallet + buy-in version of "How it works". Not shown today (no real-money
 * play yet); see HowItWorksTodaySection. Kept for when wallets launch.
 */
export function HowItWorksSection({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <JourneySection
      heading={
        <>
          From first click
          <br />
          to <span className="text-landing-gold">play live.</span>
        </>
      }
      reduceMotion={reduceMotion}
      renderPanel={(step) => {
        switch (step.key) {
          case 'sign-in':
            return <SignInPanel reduceMotion={reduceMotion} />;
          case 'lobby':
            return <LobbyPanel reduceMotion={reduceMotion} />;
          case 'buy-in':
            return <BuyInPanel reduceMotion={reduceMotion} />;
          default:
            return <LivePanel reduceMotion={reduceMotion} />;
        }
      }}
      steps={walletJourneySteps}
    />
  );
}
