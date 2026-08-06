import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { api } from '~/utils/api';

type WaitlistFormProps = {
  className?: string;
  /** `compact` for inline hero; `stacked` on narrow viewports handled via CSS */
  layout?: 'inline' | 'stacked';
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

export function WaitlistForm({ className = '', layout = 'inline' }: WaitlistFormProps) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const joinMutation = api.waitlist.join.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setEmail('');
    },
  });

  const formLayout =
    layout === 'inline'
      ? 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center'
      : 'flex flex-col gap-3';

  return (
    <div className={className}>
      <AnimatePresence mode="wait" initial={false}>
        {!submitted ? (
          <motion.form
            key="waitlist-form"
            layout
            variants={formVariants}
            exit="exit"
            className={formLayout}
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = email.trim();
              if (!trimmed || joinMutation.isPending) return;
              joinMutation.mutate({ email: trimmed });
            }}
          >
            <motion.input
              layout
              variants={fieldVariants}
              type="email"
              required
              autoComplete="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={joinMutation.isPending}
              className="w-full min-w-0 rounded-lg border border-white/10 bg-zinc-900/60 px-4 py-3 text-white placeholder:text-zinc-500 outline-none ring-0 focus:border-[#FFD700]/40 sm:max-w-sm"
            />
            <motion.button
              layout
              variants={fieldVariants}
              type="submit"
              disabled={joinMutation.isPending || !email.trim()}
              className="shrink-0 rounded-lg bg-gradient-to-r from-[#FFD700] via-[#F2C14E] to-[#D4AF37] px-6 py-3 font-medium text-black shadow-[0_0_30px_rgba(212,175,55,0.25)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {joinMutation.isPending ? 'Joining…' : 'Join waitlist'}
            </motion.button>
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
