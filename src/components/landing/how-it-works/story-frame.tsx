'use client';

import { motion } from 'framer-motion';
import { type ReactNode } from 'react';
import { type JourneyStep } from '../landing-data';
import { revealEase } from '../landing-motion';

export function StoryFrame({
  step,
  children,
  focused,
  reduceMotion,
}: {
  step: JourneyStep;
  children: ReactNode;
  focused: boolean;
  reduceMotion: boolean;
}) {
  return (
    <motion.div
      animate={{ opacity: focused ? 1 : 0.38 }}
      aria-labelledby={`story-${step.key}-title`}
      className="scroll-mt-20 lg:scroll-mt-8"
      data-journey-step={step.id}
      id={`story-${step.key}`}
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
        <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:gap-5">
          <div className="min-w-0">
            <div className="mb-3 text-[10px] uppercase tracking-[0.25em] text-landing-gold">
              0{step.id} / {step.eyebrow}
            </div>
            <h3
              className="font-display text-2xl tracking-[-0.04em] text-[#f8e6af] sm:text-3xl"
              id={`story-${step.key}-title`}
            >
              {step.frameTitle}
            </h3>
          </div>
          <span
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] ${step.badgeClass}`}
          >
            {step.badge}
          </span>
        </div>
        {children}
        <p className="mt-6 text-center text-xs uppercase tracking-[0.18em] text-slate-500">{step.footer}</p>
      </div>
    </motion.div>
  );
}
