'use client';

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { WaitlistForm } from '~/components/table/waitlist-form';
import { Button } from '~/components/ui/button';

export function SessionCta({ session }: { session: ReturnType<typeof useSession>['data'] }) {
  if (session) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button
          asChild
          className="h-12 rounded-xl bg-landing-gold px-6 text-sm font-semibold text-landing-ink shadow-[0_0_30px_rgba(244,201,93,0.25)] hover:bg-landing-gold-bright"
        >
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

  return <WaitlistForm variant="inline" />;
}
