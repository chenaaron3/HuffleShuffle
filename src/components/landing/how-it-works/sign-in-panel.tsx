'use client';

import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { ArrowUpRight, Lock, ShieldCheck, Wallet } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { formatCurrency } from '../landing-motion';

const SIGN_IN_EMAIL = 'player@huffle.shuffle';
const TYPE_END = 0.55;
const PRESS_END = 0.68;
const CONNECT_AT = 0.72;

type Phase = 'typing' | 'press' | 'connected';

function progressToState(progress: number): {
  typedEmail: string;
  phase: Phase;
  buttonPressed: boolean;
  balance: number;
} {
  if (progress < TYPE_END) {
    const chars = Math.floor((progress / TYPE_END) * SIGN_IN_EMAIL.length);
    return {
      typedEmail: SIGN_IN_EMAIL.slice(0, chars),
      phase: 'typing',
      buttonPressed: false,
      balance: 0,
    };
  }

  if (progress < CONNECT_AT) {
    return {
      typedEmail: SIGN_IN_EMAIL,
      phase: 'press',
      buttonPressed: progress < PRESS_END,
      balance: 0,
    };
  }

  const balanceProgress = (progress - CONNECT_AT) / (1 - CONNECT_AT);
  return {
    typedEmail: SIGN_IN_EMAIL,
    phase: 'connected',
    buttonPressed: false,
    balance: Math.round(Math.min(1, Math.max(0, balanceProgress)) * 250),
  };
}

export function SignInPanel({ reduceMotion }: { reduceMotion: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 75%', 'center center'],
  });
  const [typedEmail, setTypedEmail] = useState(reduceMotion ? SIGN_IN_EMAIL : '');
  const [phase, setPhase] = useState<Phase>(reduceMotion ? 'connected' : 'typing');
  const [balance, setBalance] = useState(reduceMotion ? 250 : 0);
  const [buttonPressed, setButtonPressed] = useState(false);
  const connected = phase === 'connected';

  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    if (reduceMotion) return;
    const next = progressToState(progress);
    setTypedEmail(next.typedEmail);
    setPhase(next.phase);
    setButtonPressed(next.buttonPressed);
    setBalance(next.balance);
  });

  useEffect(() => {
    if (reduceMotion) {
      setTypedEmail(SIGN_IN_EMAIL);
      setPhase('connected');
      setBalance(250);
      setButtonPressed(false);
      return;
    }
    const next = progressToState(scrollYProgress.get());
    setTypedEmail(next.typedEmail);
    setPhase(next.phase);
    setButtonPressed(next.buttonPressed);
    setBalance(next.balance);
  }, [reduceMotion, scrollYProgress]);

  return (
    <div
      className="w-full rounded-[24px] border border-white/10 bg-landing-panel p-5 shadow-[0_24px_65px_rgba(0,0,0,0.36)] sm:p-7"
      ref={ref}
    >
      <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-landing-gold/10 text-landing-gold-bright">
            <Wallet aria-hidden="true" className="size-[18px]" />
          </span>
          <div>
            <div className="text-sm font-semibold text-white">HuffleShuffle wallet</div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500">One-time setup</div>
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-[0.16em] text-slate-600">step 1 of 4</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 sm:items-stretch">
        <div className="flex flex-col gap-3">
          <label className="block text-[10px] uppercase tracking-[0.18em] text-slate-500">
            Email address
            <div className="mt-2 flex h-12 items-center rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm normal-case tracking-normal text-slate-200">
              <span>{typedEmail}</span>
              {phase === 'typing' && !reduceMotion && (
                <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-landing-gold-bright" />
              )}
            </div>
          </label>
          <motion.div animate={{ scale: buttonPressed ? 0.96 : 1 }} transition={{ duration: 0.15 }}>
            <Button
              className={`h-12 w-full rounded-xl text-sm font-semibold transition-colors ${
                connected
                  ? 'bg-emerald-300/15 text-emerald-200 hover:bg-emerald-300/20'
                  : 'bg-landing-gold text-landing-ink hover:bg-landing-gold-bright'
              }`}
            >
              {connected ? (
                <>
                  Wallet connected <span className="text-xs">✓</span>
                </>
              ) : (
                <>
                  Connect wallet <ArrowUpRight aria-hidden="true" className="size-4" />
                </>
              )}
            </Button>
          </motion.div>
        </div>

        <div
          className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border p-4 transition-colors duration-500 ${
            connected ? 'border-landing-gold/20 bg-landing-gold/[0.07]' : 'border-white/10 bg-white/[0.03]'
          }`}
        >
          <div className="text-[10px] uppercase tracking-[0.18em] text-landing-gold">Ready balance</div>

          {!connected && !reduceMotion ? (
            <div className="flex flex-1 items-center justify-center">
              <span className="grid size-12 place-items-center rounded-full border border-white/10 bg-black/25 text-slate-400">
                <Lock aria-hidden="true" className="size-5" />
              </span>
            </div>
          ) : (
            <div className="flex flex-1 flex-col justify-center gap-3">
              <div className="font-display text-4xl text-[#f8e6af]">{formatCurrency(balance)}</div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck aria-hidden="true" className="size-[15px] text-emerald-300" />
                encrypted and yours
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
