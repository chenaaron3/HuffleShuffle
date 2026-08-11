'use client';

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { journeySteps, type JourneyStepId } from '../landing-data';
import { revealEase } from '../landing-motion';

function MobileJourneyNav({ activeStep }: { activeStep: JourneyStepId }) {
  const reduceMotion = useReducedMotion() ?? false;
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.38, ease: revealEase };

  return (
    <LayoutGroup id="mobile-journey-nav">
      <nav aria-label="Journey steps" className="flex items-center justify-between gap-2 lg:hidden">
        {journeySteps.map((step) => {
          const active = activeStep === step.id;
          return (
            <a
              aria-current={active ? 'step' : undefined}
              aria-label={`${step.id}. ${step.title}`}
              className={`relative flex h-9 min-w-0 items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-landing-gold-bright ${
                active ? 'flex-1' : 'w-9 shrink-0'
              }`}
              href={`#story-${step.key}`}
              key={step.id}
            >
              {active && (
                <motion.span
                  className="absolute inset-0 rounded-full border border-landing-gold-bright bg-landing-gold shadow-[0_0_20px_rgba(244,201,93,0.22)]"
                  layoutId="mobile-journey-active-pill"
                  transition={transition}
                />
              )}
              <span
                className={`relative z-[1] flex h-9 w-full items-center overflow-hidden rounded-full ${
                  active ? 'text-landing-ink' : 'justify-center border border-white/15 bg-white/[0.04] text-slate-400'
                }`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center font-display text-xs font-bold ${
                    active ? 'text-landing-ink' : ''
                  }`}
                >
                  {step.id}
                </span>
                <AnimatePresence initial={false} mode="wait">
                  {active && (
                    <motion.span
                      animate={{ opacity: 1, x: 0 }}
                      className="truncate pr-3.5 text-xs font-semibold tracking-[0.02em]"
                      exit={{ opacity: 0, x: 8 }}
                      initial={{ opacity: 0, x: -8 }}
                      key={`label-${step.id}`}
                      transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: revealEase }}
                    >
                      {step.title}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            </a>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}

export function JourneyRail({ activeStep }: { activeStep: JourneyStepId }) {
  return (
    <aside
      aria-label="How it works steps"
      className="sticky top-0 z-20 -mx-6 border-b border-white/10 bg-landing-midnight/90 px-6 py-3 backdrop-blur-md sm:-mx-8 sm:px-8 lg:top-[max(2rem,calc(50vh-6.5rem))] lg:mx-0 lg:border-b-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none"
    >
      <MobileJourneyNav activeStep={activeStep} />

      {/* Desktop: vertical rail */}
      <div className="relative hidden pl-8 lg:block">
        <div className="absolute bottom-2 left-9 top-2 w-px bg-gradient-to-b from-landing-gold via-landing-gold/40 to-white/10" />
        <nav aria-label="Journey steps" className="space-y-7">
          {journeySteps.map((step) => (
            <a
              aria-current={activeStep === step.id ? 'step' : undefined}
              className={`group relative block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-landing-gold-bright ${activeStep === step.id ? 'text-[#fff1bd]' : 'text-slate-500'}`}
              href={`#story-${step.key}`}
              key={step.id}
            >
              <span
                className={`absolute -left-1 top-1/2 grid size-4 -translate-y-1/2 place-items-center rounded-full border text-[8px] font-bold ${
                  activeStep === step.id
                    ? 'border-landing-gold-bright bg-landing-gold text-landing-ink shadow-[0_0_0_5px_rgba(244,201,93,0.11),0_0_20px_rgba(244,201,93,0.2)]'
                    : 'border-white/25 bg-[#101721] text-slate-400'
                }`}
              >
                {step.id}
              </span>
              <div
                className={`pl-5 font-display text-lg font-semibold ${
                  activeStep === step.id ? 'opacity-100' : 'opacity-65 group-hover:opacity-100'
                }`}
              >
                {step.title}
              </div>
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}
