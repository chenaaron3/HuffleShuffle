'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { Play } from 'lucide-react';
import { useRef, useState } from 'react';
import { DemoBeams } from './demo-beams';
import { demoPoster, demoVideo } from './landing-data';
import { revealVariants } from './landing-motion';
import { SectionBand } from './section-band';

export function DemoSection({ reduceMotion }: { reduceMotion: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const pathLengthFirst = useTransform(scrollYProgress, [0.1, 0.75], [0.2, 1.15]);
  const pathLengthSecond = useTransform(scrollYProgress, [0.1, 0.75], [0.15, 1.15]);
  const pathLengthThird = useTransform(scrollYProgress, [0.1, 0.75], [0.1, 1.15]);
  const pathLengthFourth = useTransform(scrollYProgress, [0.1, 0.75], [0.05, 1.15]);
  const pathLengthFifth = useTransform(scrollYProgress, [0.1, 0.75], [0, 1.15]);

  const startPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    void video.play();
    setPlaying(true);
  };

  return (
    <section
      className="relative mx-auto max-w-7xl px-6 py-28 sm:px-8 lg:px-12"
      id="demo"
      ref={sectionRef}
    >
      <SectionBand tone="deep" />
      <motion.div
        className="relative z-10 mb-10 max-w-2xl"
        initial={reduceMotion ? false : 'hidden'}
        variants={{ visible: {}, hidden: {} }}
        viewport={{ amount: 0.35, once: true }}
        whileInView="visible"
      >
        <motion.p
          className="mb-3 text-xs uppercase tracking-[0.28em] text-landing-gold"
          variants={revealVariants}
        >
          See it in action
        </motion.p>
        <motion.h2
          className="font-display text-3xl tracking-[-0.04em] text-[#f8e6af] sm:text-5xl"
          variants={revealVariants}
        >
          A hand, start to finish.
        </motion.h2>
        <motion.p className="mt-4 max-w-xl text-base leading-7 text-slate-400" variants={revealVariants}>
          Watch a live dealer run the table — real cards, real pace, no RNG theatrics.
        </motion.p>
      </motion.div>

      <div className="relative z-10 flex justify-center py-10 sm:py-16">
        <DemoBeams
          pathLengths={[
            pathLengthFirst,
            pathLengthSecond,
            pathLengthThird,
            pathLengthFourth,
            pathLengthFifth,
          ]}
          reduceMotion={reduceMotion}
        />
        <motion.div
          className="relative z-10 mx-auto w-fit max-w-full overflow-hidden rounded-[28px] border border-white/10 bg-landing-panel shadow-[0_30px_100px_rgba(0,0,0,0.45)]"
          initial={reduceMotion ? false : 'hidden'}
          variants={revealVariants}
          viewport={{ amount: 0.2, once: true }}
          whileInView="visible"
        >
          <video
            className="block h-auto max-h-[min(70dvh,720px)] w-auto max-w-full bg-black"
            controls={playing}
            onEnded={() => setPlaying(false)}
            playsInline
            poster={demoPoster}
            preload="metadata"
            ref={videoRef}
            src={demoVideo}
          />
          {!playing && (
            <button
              aria-label="Play demo video"
              className="absolute inset-0 grid place-items-center bg-black/25 transition hover:bg-black/35 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-landing-gold-bright"
              onClick={startPlayback}
              type="button"
            >
              <span className="grid size-16 place-items-center rounded-full border border-landing-gold/40 bg-landing-ink/80 text-landing-gold-bright shadow-[0_0_40px_rgba(244,201,93,0.35)] backdrop-blur-sm sm:size-[4.5rem]">
                <Play aria-hidden="true" className="ml-1 size-7 fill-current sm:size-8" />
              </span>
            </button>
          )}
        </motion.div>
      </div>
    </section>
  );
}
