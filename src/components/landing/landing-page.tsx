'use client';

import { motion, useReducedMotion } from 'framer-motion';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useDealerButtonJourney } from '~/hooks/use-dealer-button-journey';
import { FinalCtaSection } from './final-cta-section';
import { HeroSection } from './hero-section';
import { shuffle1Image, shuffle2Image } from './landing-data';
import { LandingHeader } from './landing-header';
import { SiteFooter } from './site-footer';

const FeaturesSection = dynamic(
  () => import('./features-section').then((mod) => mod.FeaturesSection),
  { ssr: false },
);
const DemoSection = dynamic(() => import('./demo-section').then((mod) => mod.DemoSection), {
  ssr: false,
});
const HowItWorksSection = dynamic(
  () => import('./how-it-works/how-it-works-section').then((mod) => mod.HowItWorksSection),
  { ssr: false },
);

export function LandingPage() {
  const { data: session } = useSession();
  const reduceMotion = useReducedMotion() ?? false;
  const pageRef = useRef<HTMLElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const dealerChipStartRef = useRef<HTMLSpanElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const { x, y, rotate, opacity, routeProgress, pathD } = useDealerButtonJourney(
    pageRef,
    pathRef,
    dealerChipStartRef,
    slotRef,
  );
  const visibleRouteProgress = reduceMotion ? 1 : routeProgress;

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const next = document.getElementById('__next');
    const previous = {
      html: root.style.backgroundColor,
      body: body.style.backgroundColor,
      next: next?.style.backgroundColor ?? '',
    };
    root.style.backgroundColor = '#080b11';
    body.style.backgroundColor = '#080b11';
    if (next) next.style.backgroundColor = '#080b11';
    return () => {
      root.style.backgroundColor = previous.html;
      body.style.backgroundColor = previous.body;
      if (next) next.style.backgroundColor = previous.next;
    };
  }, []);

  return (
    <>
      <Head>
        <title>HuffleShuffle</title>
        <meta name="description" content="Play online poker with a live dealer" />
      </Head>
      <main
        className="relative min-h-dvh overflow-x-clip bg-landing-midnight font-sans text-white [background-attachment:fixed]"
        id="hero"
        ref={pageRef}
      >
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_64%_8%,rgba(244,201,93,0.12),transparent_27%),radial-gradient(circle_at_8%_72%,rgba(58,74,101,0.16),transparent_31%),linear-gradient(180deg,#0d131d_0%,#080b11_38%,#06080c_100%)]" />
        <div className="pointer-events-none absolute inset-0 z-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />
        <Image
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 z-0 h-[520px] w-auto opacity-80 sm:h-[680px] md:h-[760px]"
          height={611}
          priority
          sizes="(min-width: 768px) 480px, 320px"
          src={shuffle1Image}
          width={480}
        />
        <Image
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-16 z-0 h-[520px] w-auto opacity-80 sm:h-[680px] md:h-[760px]"
          height={640}
          loading="lazy"
          sizes="(min-width: 768px) 400px, 280px"
          src={shuffle2Image}
          width={400}
        />

        <LandingHeader />
        <div className="relative z-[30]">
          <HeroSection
            dealerChipStartRef={dealerChipStartRef}
            reduceMotion={reduceMotion}
            session={session}
          />
          <FeaturesSection reduceMotion={reduceMotion} />
          <DemoSection reduceMotion={reduceMotion} />
          <HowItWorksSection reduceMotion={reduceMotion} />
        </div>

        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-[20] h-full w-full"
          preserveAspectRatio="none"
          viewBox="0 0 100 1000"
        >
          <path d={pathD} fill="none" ref={pathRef} stroke="transparent" strokeWidth="2.5" />
          <motion.path
            d={pathD}
            fill="none"
            opacity="0.28"
            pathLength={1}
            stroke="#f4c95d"
            strokeLinecap="round"
            strokeWidth="2.5"
            style={{ pathLength: visibleRouteProgress }}
          />
          <motion.path
            d={pathD}
            fill="none"
            opacity="0.6"
            pathLength={1}
            stroke="#ffe39a"
            strokeLinecap="round"
            strokeWidth="0.45"
            style={{ pathLength: visibleRouteProgress }}
          />
        </svg>

        <motion.div
          aria-hidden="true"
          className="landing-dealer-token pointer-events-none absolute left-0 top-0 z-[22]"
          style={{ x, y, rotate, opacity: reduceMotion ? 0.95 : opacity }}
        />

        <FinalCtaSection session={session} slotRef={slotRef} />
        <div className="relative z-[30]">
          <SiteFooter />
        </div>
      </main>
    </>
  );
}
