'use client';

import { motion, useInView } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';
import { type JourneyStepId, type StoryStep, type StoryStepKey } from '../landing-data';
import { revealEase } from '../landing-motion';

const storyBadgeClass: Record<StoryStepKey, string> = {
  'sign-in': 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200',
  lobby: 'border-landing-gold/20 bg-landing-gold/[0.07] text-landing-gold-bright',
  'buy-in': 'border-white/10 bg-white/[0.04] text-slate-400',
  'play-live': 'border-rose-300/20 bg-rose-300/10 text-rose-200',
};

const storyBadgeLabel: Record<StoryStepKey, string> = {
  'sign-in': 'secure wallet',
  lobby: '12 tables live',
  'buy-in': 'instant seat',
  'play-live': 'dealer on camera',
};

const storyEyebrow: Record<StoryStepKey, string> = {
  'sign-in': 'one-time setup',
  lobby: 'find the room',
  'buy-in': 'claim your seat',
  'play-live': 'the good part',
};

const storyFooter: Record<StoryStepKey, string> = {
  'sign-in': 'Your wallet is ready before the first hand.',
  lobby: 'Every room has a dealer, a rhythm, and a seat with your name on it.',
  'buy-in': 'No waiting room. No hidden steps. Just a clear buy-in and a live seat.',
  'play-live': 'Chat, bet, and enjoy the show with live dealers.',
};

export function StoryFrame({
  step,
  children,
  focused,
  reduceMotion,
  onActiveChange,
}: {
  step: StoryStep;
  children: ReactNode;
  focused: boolean;
  reduceMotion: boolean;
  onActiveChange: (step: JourneyStepId) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { amount: 0.25, margin: '-34% 0px -44% 0px' });

  useEffect(() => {
    if (isInView) onActiveChange(step.id);
  }, [isInView, onActiveChange, step.id]);

  return (
    <motion.div
      animate={{ opacity: focused ? 1 : 0.38 }}
      aria-labelledby={`story-${step.key}-title`}
      className="scroll-mt-8"
      id={`story-${step.key}`}
      ref={ref}
      role="region"
      transition={reduceMotion ? { duration: 0 } : { duration: 0.45, ease: revealEase }}
    >
      <div
        className={`story-frame w-full rounded-[30px] border p-6 text-white sm:p-8 ${
          focused
            ? 'border-landing-gold/45 bg-gradient-to-br from-[#161d28]/95 to-[#0a0e15]/95 shadow-[0_32px_120px_rgba(0,0,0,0.32),0_0_56px_rgba(244,201,93,0.07)]'
            : 'border-white/10 bg-gradient-to-br from-[#161d28]/95 to-[#0a0e15]/95 shadow-[0_26px_100px_rgba(0,0,0,0.22)]'
        }`}
      >
        <div className="mb-8 flex items-start justify-between gap-5">
          <div>
            <div className="mb-3 text-[10px] uppercase tracking-[0.25em] text-landing-gold">
              0{step.id} / {storyEyebrow[step.key]}
            </div>
            <h3 className="font-display text-3xl tracking-[-0.04em] text-[#f8e6af]" id={`story-${step.key}-title`}>
              {step.frameTitle}
            </h3>
          </div>
          <span
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] ${storyBadgeClass[step.key]}`}
          >
            {storyBadgeLabel[step.key]}
          </span>
        </div>
        {children}
        <p className="mt-6 text-center text-xs uppercase tracking-[0.18em] text-slate-500">{storyFooter[step.key]}</p>
      </div>
    </motion.div>
  );
}
