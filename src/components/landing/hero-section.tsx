'use client';

import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { type RefObject } from 'react';
import { CometCard } from '~/components/effects/comet-card';
import { HeroParticles } from './hero-particles';
import {
  heroContainerVariants,
  heroItemVariants,
  heroMetaItemVariants,
  heroMetaVariants,
  revealEase,
} from './landing-motion';
import { SessionCta } from './session-cta';

function HeroCardStage({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div className="hero-card-stage relative mx-auto flex h-[min(560px,62dvh)] w-full max-w-[560px] items-center justify-center [perspective:1400px]">
      {/* Inner frame leaves room so rotated cards aren't clipped */}
      <div className="relative h-[88%] w-[88%]">
        <motion.div
          animate={{ opacity: 1, y: 0, rotate: -11, scale: 1 }}
          className="absolute left-[6%] top-[2%] aspect-[2/3] h-[88%]"
          initial={reduceMotion ? false : { opacity: 0, y: 72, rotate: -28, scale: 0.88 }}
          transition={{ delay: 0.28, duration: 0.95, ease: revealEase }}
        >
          <CometCard
            className="h-full w-full overflow-hidden rounded-[22px] shadow-[0_32px_48px_rgba(244,201,93,0.2)]"
            rotateDepth={24}
            translateDepth={18}
          >
            <img
              alt="Gold Ace of Hearts card"
              className="h-full w-full object-cover object-center"
              src="/AceHeart.png"
            />
          </CometCard>
        </motion.div>
        <motion.div
          animate={{ opacity: 1, y: 0, rotate: 10, scale: 1 }}
          className="absolute right-[4%] top-[12%] z-[2] aspect-[2/3] h-[88%]"
          initial={reduceMotion ? false : { opacity: 0, y: 88, rotate: 26, scale: 0.88 }}
          transition={{ delay: 0.44, duration: 0.95, ease: revealEase }}
        >
          <CometCard
            className="h-full w-full overflow-hidden rounded-[22px] shadow-[0_32px_54px_rgba(244,201,93,0.24)]"
            rotateDepth={24}
            translateDepth={18}
          >
            <img
              alt="Gold Ace of Spades card"
              className="h-full w-full object-cover object-center"
              src="/AceSpade.png"
            />
          </CometCard>
        </motion.div>
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[10%] bottom-0 h-24 rounded-full bg-landing-gold/10 blur-3xl"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.7 }}
          transition={{ delay: 0.7, duration: 0.9, ease: revealEase }}
        />
      </div>
    </div>
  );
}

export function HeroSection({
  session,
  reduceMotion,
  dealerChipStartRef,
}: {
  session: ReturnType<typeof useSession>['data'];
  reduceMotion: boolean;
  dealerChipStartRef: RefObject<HTMLSpanElement | null>;
}) {
  return (
    <section className="relative mx-auto grid h-dvh max-h-dvh max-w-7xl items-center gap-8 px-6 pt-20 pb-8 sm:px-8 lg:grid-cols-[1fr_0.92fr] lg:gap-10 lg:px-12 lg:pb-10">
      <motion.div
        animate={reduceMotion ? undefined : { opacity: 1 }}
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-1/2 z-0 h-full w-screen -translate-x-1/2"
        initial={reduceMotion ? false : { opacity: 0 }}
        transition={{ delay: 0.55, duration: 1.1, ease: revealEase }}
      >
        <HeroParticles reduceMotion={reduceMotion} />
      </motion.div>
      <motion.div
        animate="visible"
        className="relative z-10 max-w-2xl"
        initial={reduceMotion ? false : 'hidden'}
        variants={heroContainerVariants}
      >
        <motion.div
          className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-landing-gold"
          variants={heroItemVariants}
        >
          <motion.span
            animate={reduceMotion ? undefined : { scaleX: 1 }}
            className="h-px w-9 origin-left bg-landing-gold"
            initial={reduceMotion ? false : { scaleX: 0 }}
            transition={{ delay: 0.2, duration: 0.55, ease: revealEase }}
          />
          Live tables, real people
        </motion.div>
        <motion.h1
          className="max-w-2xl font-display text-5xl font-semibold leading-[0.97] tracking-[-0.06em] text-[#f8e6af] sm:text-6xl lg:text-7xl xl:text-8xl"
          variants={heroItemVariants}
        >
          Live-
          <span className="inline-flex items-center">
            Dealer
            <span
              aria-hidden="true"
              className="ml-2.5 inline-block size-12 shrink-0 align-middle sm:ml-3"
              ref={dealerChipStartRef}
            />
          </span>
          <br />
          <span className="text-landing-gold">Online Poker</span>
        </motion.h1>
        <motion.p
          className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:mt-6 sm:text-lg sm:leading-8"
          variants={heroItemVariants}
        >
          Join a table and play Texas Hold’em streamed live with a live dealer. Simple, fast, and social — from the first
          shuffle to the final river.
        </motion.p>
        <motion.div className="mt-7 sm:mt-8" variants={heroItemVariants}>
          <SessionCta session={session} />
        </motion.div>
        <motion.div
          className="mt-7 flex flex-wrap gap-x-8 gap-y-3 text-xs uppercase tracking-[0.18em] text-slate-500 sm:mt-8"
          variants={heroMetaVariants}
        >
          <motion.span variants={heroMetaItemVariants}>
            <strong className="mr-2 text-landing-gold-bright">01</strong>real decks
          </motion.span>
          <motion.span variants={heroMetaItemVariants}>
            <strong className="mr-2 text-landing-gold-bright">02</strong>live dealers
          </motion.span>
          <motion.span variants={heroMetaItemVariants}>
            <strong className="mr-2 text-landing-gold-bright">03</strong>instant seats
          </motion.span>
        </motion.div>
      </motion.div>
      <motion.div
        animate={reduceMotion ? undefined : { opacity: 1 }}
        className="relative z-10 hidden overflow-visible lg:block"
        initial={reduceMotion ? false : { opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <HeroCardStage reduceMotion={reduceMotion} />
      </motion.div>
    </section>
  );
}
