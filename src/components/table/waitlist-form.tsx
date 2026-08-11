'use client';

import { motion } from 'framer-motion';
import { Check, Mail, X } from 'lucide-react';
import { type FormEvent, type ReactNode, useId, useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { api } from '~/utils/api';

type WaitlistFormProps = {
  className?: string;
  variant?: 'button' | 'inline';
};

const inputClassName =
  'w-full min-w-0 rounded-lg border border-white/10 bg-zinc-900/60 px-4 py-3 text-white placeholder:text-zinc-500 outline-none ring-0 focus:border-[#FFD700]/40';

const joinButtonClassName =
  'rounded-lg bg-gradient-to-r from-[#FFD700] via-[#F2C14E] to-[#D4AF37] px-6 py-3 font-medium text-black shadow-[0_0_30px_rgba(212,175,55,0.25)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60';

function FieldLabel({
  htmlFor,
  children,
  optional = false,
}: {
  htmlFor: string;
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-sm font-medium text-zinc-200">
      {children}
      {optional && <span className="text-xs font-normal text-zinc-500">(optional)</span>}
    </label>
  );
}

export function WaitlistSuccessMessage() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="flex flex-col items-center gap-3 rounded-xl border border-[#FFD700]/20 bg-zinc-900/50 px-6 py-5 text-center shadow-[0_0_40px_rgba(212,175,55,0.12)]"
    >
      <motion.div
        initial={{ scale: 0, rotate: -18 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.08 }}
        className="rounded-full border border-amber-400/30 bg-amber-400/10 p-2.5 shadow-[0_0_24px_-6px_rgba(251,191,36,0.45)]"
      >
        <Check className="size-5 text-amber-300" strokeWidth={2.5} />
      </motion.div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">
          <span className="animate-gold-shimmer bg-gradient-to-r from-yellow-600 via-amber-200 to-yellow-600 bg-clip-text text-transparent">
            You&apos;re on the list!
          </span>
        </p>
        <p className="text-sm text-zinc-400">
          We&apos;ll be in touch with updates and early access.
        </p>
      </div>
    </motion.div>
  );
}

export function WaitlistForm({ className = '', variant = 'button' }: WaitlistFormProps) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const fieldId = useId();
  const inlineEmailId = useId();

  const resetOptionalFields = () => {
    setName('');
    setPhone('');
    setInstagram('');
  };

  const joinMutation = api.waitlist.join.useMutation({
    onSuccess: () => {
      resetOptionalFields();
      setEmail('');
      setOpen(false);
      setSubmitted(true);
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetOptionalFields();
      if (variant === 'button') setEmail('');
    }
  };

  const openModal = () => setOpen(true);

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    !joinMutation.isPending;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    joinMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      instagram: instagram.trim() || undefined,
    });
  };

  if (submitted) {
    return <WaitlistSuccessMessage />;
  }

  const dialog = (
    <DialogContent className="gap-0 border-[#FFD700]/10 bg-zinc-950 p-0 shadow-[0_0_60px_rgba(212,175,55,0.12)] data-[state=open]:slide-in-from-bottom-2">
      <DialogClose className="absolute right-4 top-4 rounded-md p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white">
        <X className="size-4" />
        <span className="sr-only">Close</span>
      </DialogClose>

      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="px-6 py-6"
        initial={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1], delay: 0.04 }}
      >
        <DialogHeader className="mb-5 pr-8 text-left">
          <DialogTitle className="text-xl font-semibold text-white">Join the waitlist</DialogTitle>
          <DialogDescription>
            Get early access when live tables open up.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={`${fieldId}-name`}>Name</FieldLabel>
            <input
              id={`${fieldId}-name`}
              type="text"
              required
              autoComplete="name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={joinMutation.isPending}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={`${fieldId}-email`}>Email</FieldLabel>
            <input
              id={`${fieldId}-email`}
              type="email"
              required
              autoComplete="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={joinMutation.isPending}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={`${fieldId}-phone`} optional>
              Phone number
            </FieldLabel>
            <input
              id={`${fieldId}-phone`}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="(555) 555-5555"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={joinMutation.isPending}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={`${fieldId}-instagram`} optional>
              Instagram
            </FieldLabel>
            <input
              id={`${fieldId}-instagram`}
              type="text"
              autoComplete="off"
              placeholder="@username"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              disabled={joinMutation.isPending}
              className={inputClassName}
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className={`mt-2 w-full ${joinButtonClassName}`}
          >
            {joinMutation.isPending ? 'Joining…' : 'Join waitlist'}
          </button>
        </form>
      </motion.div>
    </DialogContent>
  );

  if (variant === 'inline') {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <form
          aria-label="Join the HuffleShuffle waitlist"
          className={`flex min-w-0 flex-1 flex-col gap-2 sm:max-w-[365px] ${className}`}
          onSubmit={(e) => {
            e.preventDefault();
            openModal();
          }}
        >
          <label className="sr-only" htmlFor={inlineEmailId}>
            Email address
          </label>
          <div className="flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.045] p-1.5 pl-4 shadow-[0_12px_45px_rgba(0,0,0,0.22)] focus-within:border-landing-gold/70 focus-within:ring-2 focus-within:ring-landing-gold/15">
            <Mail aria-hidden="true" className="size-[17px] shrink-0 text-slate-500" />
            <input
              autoComplete="email"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-slate-600"
              id={inlineEmailId}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
            <button
              className="rounded-xl bg-landing-gold px-4 py-2.5 text-sm font-semibold text-landing-ink shadow-[0_0_28px_rgba(244,201,93,0.18)] hover:bg-landing-gold-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-landing-gold-bright"
              type="submit"
            >
              Join waitlist
            </button>
          </div>
          <p className="text-[11px] text-slate-500">No spam. Just a seat when tables open.</p>
        </form>
        {dialog}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <button
        type="button"
        onClick={openModal}
        className={`${joinButtonClassName} ${className}`}
      >
        Join waitlist
      </button>
      {dialog}
    </Dialog>
  );
}
