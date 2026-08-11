'use client';

import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  goldChipImage,
  journeyChipPlacements,
  journeySteps,
  type ChipParallaxLayer,
  type JourneyChipPlacement,
  type JourneyStepId,
} from '../landing-data';
import { BuyInPanel } from './buy-in-panel';
import { JourneyRail } from './journey-rail';
import { LivePanel } from './live-panel';
import { LobbyPanel } from './lobby-panel';
import { SignInPanel } from './sign-in-panel';
import { SectionBand } from '../section-band';
import { StoryFrame } from './story-frame';

function ChipLayer({
  chips,
  y,
  reduceMotion,
}: {
  chips: JourneyChipPlacement[];
  y: MotionValue<number> | number;
  reduceMotion: boolean;
}) {
  if (chips.length === 0) return null;

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={reduceMotion ? undefined : { y }}
    >
      {chips.map((chip) => (
        <Image
          key={chip.id}
          alt=""
          className="absolute select-none"
          height={chip.size}
          loading="lazy"
          src={goldChipImage}
          style={{
            top: chip.top,
            left: chip.left,
            opacity: chip.opacity,
            transform: `rotate(${chip.rotate}deg)`,
          }}
          unoptimized
          width={chip.size}
        />
      ))}
    </motion.div>
  );
}

function chipsForLayer(layer: ChipParallaxLayer) {
  return journeyChipPlacements.filter((chip) => chip.layer === layer);
}

function useActiveJourneyStep(containerRef: RefObject<HTMLElement | null>) {
  const [activeStep, setActiveStep] = useState<JourneyStepId>('1');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frame = 0;

    const updateActiveStep = () => {
      frame = 0;
      const nodes = container.querySelectorAll<HTMLElement>('[data-journey-step]');
      if (nodes.length === 0) return;

      // Focus line sits below the sticky mobile nav / near upper-middle on desktop.
      const focusY = window.innerWidth < 1024 ? window.innerHeight * 0.28 : window.innerHeight * 0.42;

      let bestId: JourneyStepId = '1';
      let bestDistance = Number.POSITIVE_INFINITY;

      nodes.forEach((node) => {
        const id = node.dataset.journeyStep as JourneyStepId | undefined;
        if (!id) return;
        const rect = node.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const distance = Math.abs(center - focusY);
        // Prefer the card that currently covers the focus line; otherwise nearest center.
        const coversFocus = rect.top <= focusY && rect.bottom >= focusY;
        const score = coversFocus ? distance * 0.25 : distance;
        if (score < bestDistance) {
          bestDistance = score;
          bestId = id;
        }
      });

      setActiveStep((prev) => (prev === bestId ? prev : bestId));
    };

    const onScrollOrResize = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateActiveStep);
    };

    updateActiveStep();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [containerRef]);

  return activeStep;
}

export function HowItWorksSection({ reduceMotion }: { reduceMotion: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const activeStep = useActiveJourneyStep(sectionRef);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  // Farther = smaller travel; nearer = larger travel. UI stays between mid and near.
  const farY = useTransform(scrollYProgress, [0, 1], [36, -36]);
  const midY = useTransform(scrollYProgress, [0, 1], [90, -90]);
  const nearY = useTransform(scrollYProgress, [0, 1], [160, -160]);
  const storiesY = useTransform(scrollYProgress, [0, 1], [48, -48]);

  return (
    <section
      className="relative mx-auto max-w-7xl px-6 py-14 sm:px-8 sm:py-28 lg:px-12"
      id="journey"
      ref={sectionRef}
    >
      <SectionBand tone="lift" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden sm:block">
        <ChipLayer chips={chipsForLayer(0)} reduceMotion={reduceMotion} y={farY} />
        <ChipLayer chips={chipsForLayer(1)} reduceMotion={reduceMotion} y={midY} />
        <ChipLayer chips={chipsForLayer(2)} reduceMotion={reduceMotion} y={nearY} />
      </div>

      <div className="relative z-10">
        <div className="mb-8 max-w-2xl sm:mb-12">
          <p className="mb-3 text-xs uppercase tracking-[0.28em] text-landing-gold">How it works</p>
          <h2 className="font-display text-4xl leading-tight tracking-[-0.05em] text-[#f8e6af] sm:text-6xl">
            From first click
            <br />
            to <span className="text-landing-gold">play live.</span>
          </h2>
        </div>
        <div className="grid items-start gap-5 lg:grid-cols-[0.34fr_1fr] lg:gap-16">
          {/* Outside transformed parents so sticky positioning works */}
          <JourneyRail activeStep={activeStep} />
          <motion.div
            className="space-y-10 sm:space-y-16"
            style={reduceMotion ? undefined : { y: storiesY }}
          >
            {journeySteps.map((step) => (
              <StoryFrame
                key={step.id}
                focused={activeStep === step.id}
                reduceMotion={reduceMotion}
                step={step}
              >
                {step.key === 'sign-in' ? (
                  <SignInPanel reduceMotion={reduceMotion} />
                ) : step.key === 'lobby' ? (
                  <LobbyPanel reduceMotion={reduceMotion} />
                ) : step.key === 'buy-in' ? (
                  <BuyInPanel reduceMotion={reduceMotion} />
                ) : (
                  <LivePanel reduceMotion={reduceMotion} />
                )}
              </StoryFrame>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
