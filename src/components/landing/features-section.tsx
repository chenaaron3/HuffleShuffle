'use client';

import { motion } from 'framer-motion';
import { Armchair, Layers3, Video } from 'lucide-react';
import { GlowingEffect } from '~/components/effects/glowing-effect';
import { valueProps, type ValueProp } from './landing-data';
import { cardRevealVariants } from './landing-motion';
import { SectionBand } from './section-band';

const valuePropIcons: Record<ValueProp['icon'], typeof Video> = {
  dealer: Video,
  seat: Armchair,
  deck: Layers3,
};

function ValuePropCard({
  valueProp,
  index,
  reduceMotion,
}: {
  valueProp: ValueProp;
  index: number;
  reduceMotion: boolean;
}) {
  const Icon = valuePropIcons[valueProp.icon];

  return (
    <motion.div
      className="h-full"
      initial={reduceMotion ? false : 'hidden'}
      transition={{ delay: index * 0.07 }}
      variants={cardRevealVariants}
      viewport={{ amount: 0.25, once: true }}
      whileHover={reduceMotion ? undefined : { y: -4 }}
      whileInView="visible"
    >
      <article className="value-card group relative flex h-full flex-col rounded-[20px] border border-white/10 bg-landing-surface/80 p-5 text-white shadow-[0_16px_50px_rgba(0,0,0,0.18)] hover:border-landing-gold/45">
        <GlowingEffect blur={4} className="rounded-[20px]" disabled={false} proximity={60} spread={20} variant="golden" />
        <div className="mb-6 flex items-center justify-between">
          <span className="grid size-8 place-items-center rounded-full border border-landing-gold/35 bg-landing-gold/10 font-display text-xs text-landing-gold-bright">
            {String(index + 1).padStart(2, '0')}
          </span>
          <Icon aria-hidden="true" className="size-4 text-landing-gold/70" />
        </div>
        <h3 className="font-display text-xl text-[#f8e6af]">{valueProp.title}</h3>
        <p className="mt-2 max-w-[280px] flex-1 text-sm leading-5 text-slate-400">{valueProp.description}</p>
        <span className="absolute bottom-5 right-5 size-1.5 rounded-full bg-landing-gold shadow-[0_0_14px_rgba(244,201,93,0.7)]" />
      </article>
    </motion.div>
  );
}

export function FeaturesSection({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <section className="relative mx-auto max-w-7xl px-6 py-28 sm:px-8 lg:px-12" id="value-props">
      <SectionBand tone="lift" />
      <div className="relative z-10 mb-8">
        <p className="mb-3 text-xs uppercase tracking-[0.28em] text-landing-gold">The table, simplified</p>
        <h2 className="font-display text-3xl tracking-[-0.04em] text-[#f8e6af] sm:text-5xl">
          Everything you need to sit down.
        </h2>
      </div>
      <div className="relative z-10 grid gap-3 md:grid-cols-3">
        {valueProps.map((valueProp, index) => (
          <ValuePropCard key={valueProp.title} index={index} reduceMotion={reduceMotion} valueProp={valueProp} />
        ))}
      </div>
    </section>
  );
}
