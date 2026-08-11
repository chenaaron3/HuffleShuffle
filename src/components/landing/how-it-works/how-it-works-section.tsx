'use client';

import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import Image from 'next/image';
import { useRef, useState } from 'react';
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

export function HowItWorksSection({ reduceMotion }: { reduceMotion: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState<JourneyStepId>('1');

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  // Farther = smaller travel; nearer = larger travel. UI stays between mid and near.
  const farY = useTransform(scrollYProgress, [0, 1], [36, -36]);
  const midY = useTransform(scrollYProgress, [0, 1], [90, -90]);
  const nearY = useTransform(scrollYProgress, [0, 1], [160, -160]);
  const contentY = useTransform(scrollYProgress, [0, 1], [48, -48]);

  return (
    <section
      className="relative mx-auto max-w-7xl px-6 py-28 sm:px-8 lg:px-12"
      id="journey"
      ref={sectionRef}
    >
      <SectionBand tone="lift" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <ChipLayer chips={chipsForLayer(0)} reduceMotion={reduceMotion} y={farY} />
        <ChipLayer chips={chipsForLayer(1)} reduceMotion={reduceMotion} y={midY} />
        <ChipLayer chips={chipsForLayer(2)} reduceMotion={reduceMotion} y={nearY} />
      </div>

      <motion.div
        className="relative z-10"
        style={reduceMotion ? undefined : { y: contentY }}
      >
        <div className="mb-12 max-w-2xl">
          <p className="mb-3 text-xs uppercase tracking-[0.28em] text-landing-gold">How it works</p>
          <h2 className="font-display text-4xl leading-tight tracking-[-0.05em] text-[#f8e6af] sm:text-6xl">
            From first click
            <br />
            to <span className="text-landing-gold">play live.</span>
          </h2>
        </div>
        <div className="grid items-start gap-12 lg:grid-cols-[0.34fr_1fr] lg:gap-16">
          <JourneyRail activeStep={activeStep} />
          <div className="space-y-16">
            {journeySteps.map((step) => (
              <StoryFrame
                key={step.id}
                focused={activeStep === step.id}
                onActiveChange={setActiveStep}
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
          </div>
        </div>
      </motion.div>
    </section>
  );
}
