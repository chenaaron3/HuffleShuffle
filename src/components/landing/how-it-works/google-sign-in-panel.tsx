'use client';

import { motion, useInView } from 'framer-motion';
import { Check, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Phase = 'idle' | 'press' | 'signed-in';

/** Mock "Continue with Google" → signed-in profile, played once when scrolled into view. */
export function GoogleSignInPanel({ reduceMotion }: { reduceMotion: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const [phase, setPhase] = useState<Phase>(reduceMotion ? 'signed-in' : 'idle');
  const signedIn = phase === 'signed-in';

  useEffect(() => {
    if (reduceMotion) {
      setPhase('signed-in');
      return;
    }
    if (!isInView) return;
    const press = setTimeout(() => setPhase('press'), 500);
    const done = setTimeout(() => setPhase('signed-in'), 850);
    return () => {
      clearTimeout(press);
      clearTimeout(done);
    };
  }, [isInView, reduceMotion]);

  return (
    <div
      className="grid w-full gap-4 rounded-[24px] border border-white/10 bg-landing-panel p-5 shadow-[0_24px_65px_rgba(0,0,0,0.36)] sm:grid-cols-2 sm:p-7"
      ref={ref}
    >
      <div className="flex flex-col justify-center gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Welcome to</div>
          <div className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em] text-white">HuffleShuffle</div>
        </div>
        <motion.button
          animate={{ scale: phase === 'press' ? 0.96 : 1 }}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white text-sm font-medium text-zinc-900 shadow-sm"
          tabIndex={-1}
          transition={{ duration: 0.15 }}
          type="button"
        >
          <GoogleMark />
          Continue with Google
        </motion.button>
      </div>

      <div
        className={`flex min-h-[150px] flex-col justify-center rounded-2xl border p-4 transition-colors duration-500 ${
          signedIn ? 'border-emerald-300/20 bg-emerald-300/[0.06]' : 'border-white/10 bg-white/[0.03]'
        }`}
      >
        {signedIn ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            transition={{ duration: 0.35 }}
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-landing-gold font-display text-lg font-semibold text-landing-ink">
              A
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">Alex Rivera</div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-200">
                <Check aria-hidden="true" className="size-3.5" /> Signed in
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="flex items-center gap-3 text-slate-500">
            <span className="grid size-12 shrink-0 place-items-center rounded-full border border-dashed border-white/15">
              <UserRound aria-hidden="true" className="size-5" />
            </span>
            <span className="text-sm">Not signed in</span>
          </div>
        )}
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" height="18" viewBox="0 0 18 18" width="18">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
