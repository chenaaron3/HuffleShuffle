import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { z } from 'zod';
import { api } from '~/utils/api';

type WaitlistFormProps = {
  className?: string;
};

const formVariants = {
  exit: {
    opacity: 0,
    transition: { duration: 0.2, staggerChildren: 0.05, staggerDirection: -1 },
  },
};

const fieldVariants = {
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.98,
    transition: { duration: 0.18 },
  },
};

const revealVariants = {
  hidden: { opacity: 0, height: 0, marginTop: 0 },
  visible: {
    opacity: 1,
    height: 'auto',
    marginTop: 12,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
  },
  exit: {
    opacity: 0,
    height: 0,
    marginTop: 0,
    transition: { duration: 0.2 },
  },
};

const inputClassName =
  'w-full min-w-0 rounded-lg border border-white/10 bg-zinc-900/60 px-4 py-3 text-white placeholder:text-zinc-500 outline-none ring-0 focus:border-[#FFD700]/40';

const inputWithActionClassName = `${inputClassName} pr-14`;

const circleTransition = { type: 'spring' as const, stiffness: 420, damping: 28 };

function FieldActionCircle({
  solid,
  children,
}: {
  solid: boolean;
  children: ReactNode;
}) {
  return (
    <motion.div
      layout
      initial={false}
      animate={{
        backgroundColor: solid ? '#FFD700' : 'rgba(255, 215, 0, 0.05)',
        borderColor: solid ? '#F2C14E' : 'rgba(255, 215, 0, 0.5)',
        color: solid ? '#0a0a0a' : 'rgba(255, 215, 0, 0.9)',
        boxShadow: solid ? '0 0 18px rgba(255, 215, 0, 0.45)' : '0 0 0px rgba(255, 215, 0, 0)',
      }}
      transition={circleTransition}
      className="absolute right-1.5 top-1/2 size-9 -translate-y-1/2 overflow-hidden rounded-full border-2"
    >
      {children}
    </motion.div>
  );
}

function isValidEmail(value: string): boolean {
  return z.string().email().safeParse(value.trim()).success;
}

function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export function WaitlistForm({ className = '' }: WaitlistFormProps) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [showPhoneStep, setShowPhoneStep] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const emailValid = isValidEmail(email);
  const phoneValid = isValidPhone(phone);
  const canSubmit = emailValid && phoneValid;

  const joinMutation = api.waitlist.join.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setEmail('');
      setPhone('');
      setShowPhoneStep(false);
    },
  });

  const advanceToPhone = () => {
    if (!emailValid || showPhoneStep) return;
    setShowPhoneStep(true);
  };

  const submitWaitlist = () => {
    if (!canSubmit || joinMutation.isPending) return;
    joinMutation.mutate({ email: email.trim(), phone: phone.trim() });
  };

  return (
    <div className={`mx-auto w-full max-w-md ${className}`}>
      <AnimatePresence mode="wait" initial={false}>
        {!submitted ? (
          <motion.form
            key="waitlist-form"
            layout
            variants={formVariants}
            exit="exit"
            className="flex flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              if (joinMutation.isPending) return;

              if (!showPhoneStep) {
                advanceToPhone();
                return;
              }

              if (!canSubmit) return;
              submitWaitlist();
            }}
          >
            <motion.div layout variants={fieldVariants} className="relative">
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => {
                  const next = e.target.value;
                  setEmail(next);
                  if (!isValidEmail(next)) {
                    setPhone('');
                    setShowPhoneStep(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  advanceToPhone();
                }}
                disabled={joinMutation.isPending}
                className={inputWithActionClassName}
              />
              <FieldActionCircle solid={showPhoneStep || emailValid}>
                <AnimatePresence mode="wait" initial={false}>
                  {showPhoneStep ? (
                    <motion.div
                      key="email-check"
                      role="img"
                      aria-label="Email confirmed"
                      initial={{ scale: 0.4, rotate: -90, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      exit={{ scale: 0.4, rotate: 90, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 24 }}
                      className="flex size-full items-center justify-center"
                    >
                      <Check className="size-4" strokeWidth={3} />
                    </motion.div>
                  ) : (
                    <motion.button
                      key="email-arrow"
                      type="button"
                      aria-label="Continue to phone number"
                      disabled={!emailValid || joinMutation.isPending}
                      onClick={advanceToPhone}
                      initial={{ opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      whileHover={
                        emailValid && !joinMutation.isPending
                          ? { scale: 1.06 }
                          : undefined
                      }
                      whileTap={
                        emailValid && !joinMutation.isPending ? { scale: 0.94 } : undefined
                      }
                      className="flex size-full items-center justify-center disabled:cursor-not-allowed"
                    >
                      <ArrowRight className="size-4" strokeWidth={2.75} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </FieldActionCircle>
            </motion.div>

            <AnimatePresence initial={false}>
              {showPhoneStep && (
                <motion.div
                  key="phone-step"
                  variants={revealVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="flex flex-col gap-3 overflow-hidden"
                >
                  <motion.div layout variants={fieldVariants} className="relative">
                    <input
                      type="tel"
                      required
                      autoFocus
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="(555) 555-5555"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        submitWaitlist();
                      }}
                      disabled={joinMutation.isPending}
                      className={inputWithActionClassName}
                    />
                    <FieldActionCircle solid={phoneValid}>
                      <motion.button
                        type="submit"
                        aria-label="Join waitlist"
                        disabled={!phoneValid || joinMutation.isPending}
                        whileHover={
                          phoneValid && !joinMutation.isPending ? { scale: 1.06 } : undefined
                        }
                        whileTap={
                          phoneValid && !joinMutation.isPending ? { scale: 0.94 } : undefined
                        }
                        className="flex size-full items-center justify-center disabled:cursor-not-allowed"
                      >
                        <Check className="size-4" strokeWidth={phoneValid ? 3 : 2.75} />
                      </motion.button>
                    </FieldActionCircle>
                  </motion.div>
                  <motion.button
                    layout
                    variants={fieldVariants}
                    type="submit"
                    disabled={joinMutation.isPending || !canSubmit}
                    className="w-full rounded-lg bg-gradient-to-r from-[#FFD700] via-[#F2C14E] to-[#D4AF37] px-6 py-3 font-medium text-black shadow-[0_0_30px_rgba(212,175,55,0.25)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {joinMutation.isPending ? 'Joining…' : 'Join waitlist'}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.form>
        ) : (
          <motion.div
            key="waitlist-success"
            layout
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
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.28 }}
              className="flex flex-col gap-1"
            >
              <p className="text-sm font-medium">
                <span className="animate-gold-shimmer bg-gradient-to-r from-yellow-600 via-amber-200 to-yellow-600 bg-clip-text text-transparent">
                  You&apos;re on the list!
                </span>
              </p>
              <p className="text-sm text-zinc-400">
                We&apos;ll be in touch with updates and early access.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
