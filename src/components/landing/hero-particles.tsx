'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const HeroParticlesCanvas = dynamic(
  () => import('./hero-particles-canvas').then((mod) => mod.HeroParticlesCanvas),
  { ssr: false },
);

export function HeroParticles({ reduceMotion }: { reduceMotion: boolean }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;

    let cancelled = false;
    const enable = () => {
      if (!cancelled) setReady(true);
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(enable, { timeout: 1200 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = setTimeout(enable, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [reduceMotion]);

  if (reduceMotion || !ready) return null;

  return <HeroParticlesCanvas />;
}
