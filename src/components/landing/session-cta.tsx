'use client';

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { signIn, signOut, type useSession } from 'next-auth/react';
import { Button } from '~/components/ui/button';

const primaryClass =
  'h-12 rounded-xl bg-landing-gold px-6 text-sm font-semibold text-landing-ink shadow-[0_0_30px_rgba(244,201,93,0.25)] hover:bg-landing-gold-bright';

export function SessionCta({ session }: { session: ReturnType<typeof useSession>['data'] }) {
  if (session) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild className={primaryClass}>
          <Link href="/lobby">
            Enter Lobby
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
        <Button
          className="h-12 rounded-xl border-white/10 bg-transparent px-5 text-sm text-white hover:bg-white/10"
          onClick={() => void signOut()}
          variant="outline"
        >
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2.5">
      <Button
        className="h-14 rounded-2xl bg-landing-gold px-8 text-base font-semibold text-landing-ink shadow-[0_0_40px_rgba(244,201,93,0.35)] transition hover:-translate-y-0.5 hover:bg-landing-gold-bright hover:shadow-[0_0_56px_rgba(244,201,93,0.45)]"
        onClick={() => void signIn('google', { callbackUrl: '/lobby' })}
      >
        Reserve your seat
        <ArrowUpRight aria-hidden="true" className="size-5" />
      </Button>
      <p className="pl-1 text-xs text-white/45">Games every Sunday</p>
    </div>
  );
}
