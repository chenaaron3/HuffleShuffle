'use client';

import type { Engine, ISourceOptions } from '@tsparticles/engine';
import Particles, { ParticlesProvider, useParticlesProvider } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';

const particleOptions: ISourceOptions = {
  fullScreen: { enable: false },
  background: { color: { value: 'transparent' } },
  fpsLimit: 48,
  detectRetina: true,
  particles: {
    number: {
      value: 28,
      density: { enable: true, width: 900, height: 700 },
    },
    color: { value: ['#f4c95d', '#ffe39a', '#d4af37'] },
    shape: { type: 'circle' },
    opacity: {
      value: { min: 0.12, max: 0.42 },
      animation: { enable: true, speed: 0.4, sync: false },
    },
    size: {
      value: { min: 1, max: 2.6 },
    },
    move: {
      enable: true,
      speed: { min: 0.15, max: 0.55 },
      direction: 'none',
      random: true,
      straight: false,
      outModes: { default: 'out' },
    },
    links: { enable: false },
  },
  interactivity: {
    events: {
      onHover: { enable: false },
      onClick: { enable: false },
    },
  },
};

async function initParticles(engine: Engine) {
  await loadSlim(engine);
}

function HeroParticlesCanvas() {
  const { loaded } = useParticlesProvider();
  if (!loaded) return null;

  return (
    <Particles
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      id="landing-hero-particles"
      options={particleOptions}
    />
  );
}

export function HeroParticles({ reduceMotion }: { reduceMotion: boolean }) {
  if (reduceMotion) return null;

  return (
    <ParticlesProvider init={initParticles}>
      <HeroParticlesCanvas />
    </ParticlesProvider>
  );
}
