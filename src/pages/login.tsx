import Head from 'next/head';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';
import { CometCard } from '~/components/effects/comet-card';
import { GoogleSignInButton } from '~/components/auth/google-sign-in-button';
import { redirectIfAuthenticated } from '~/server/auth/guards';

import type { GetServerSideProps } from 'next';

type LoginPageProps = {
  callbackUrl: string;
};

export default function LoginPage({ callbackUrl }: LoginPageProps) {
  return (
    <>
      <Head>
        <title>Sign in - HuffleShuffle</title>
      </Head>
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#0b0f14] via-[#0a0d12] to-black text-white">
        {/* Full-page decorative assets (same placement as home) */}
        <img
          src="/shuffle1.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 z-0 h-[520px] w-auto opacity-80 sm:h-[680px] md:h-[760px]"
        />
        <img
          src="/shuffle2.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-16 z-0 h-[520px] w-auto opacity-80 sm:h-[680px] md:h-[760px]"
        />

        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,215,0,0.12),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(255,215,0,0.08),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,rgba(212,175,55,0.05)_0%,rgba(0,0,0,0)_35%,rgba(212,175,55,0.03)_70%,transparent_100%)]" />

        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12 sm:px-6">
          <div className="flex w-full max-w-4xl flex-col items-center gap-10 md:max-w-none md:flex-row md:items-center md:justify-center md:gap-24 lg:gap-32">
            {/* Sign in */}
            <section className="w-full max-w-sm shrink-0 md:max-w-md">
              <Card className="gap-0 rounded-3xl border-white/10 bg-zinc-900/60 py-0 shadow-[0_0_60px_rgba(212,175,55,0.08)] backdrop-blur-sm">
                <CardHeader className="px-8 pt-8 sm:px-10 sm:pt-10">
                  <CardTitle className="text-3xl font-bold tracking-tight sm:text-4xl">Sign in</CardTitle>
                  <CardDescription className="text-zinc-400 sm:text-base">
                    Browse live tables, take a seat, and play Texas Hold&apos;em with a real dealer.
                  </CardDescription>
                </CardHeader>
                <CardFooter className="w-full px-8 pb-8 pt-4">
                  <GoogleSignInButton callbackUrl={callbackUrl} className="w-full rounded-full py-3.5" />
                </CardFooter>
              </Card>
            </section>

            {/* Playing cards */}
            <section className="relative shrink-0">
              <div className="relative flex items-center justify-center">
                <CometCard rotateDepth={50} translateDepth={50} className="-mr-14 sm:-mr-10">
                  <img
                    src="/AceHeart.png"
                    alt="Ace of Hearts"
                    className="h-[220px] w-auto rotate-[-12deg] rounded-xl shadow-[0_24px_70px_rgba(212,175,55,0.18)] sm:h-[260px] lg:h-[300px]"
                  />
                </CometCard>
                <CometCard rotateDepth={50} translateDepth={50} className="-ml-20 z-10 sm:-ml-16">
                  <img
                    src="/AceSpade.png"
                    alt="Ace of Spades"
                    className="h-[240px] w-auto rotate-[10deg] rounded-xl shadow-[0_24px_70px_rgba(212,175,55,0.18)] sm:h-[280px] lg:h-[320px]"
                  />
                </CometCard>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<LoginPageProps> = async (context) => {
  const redirect = await redirectIfAuthenticated(context);
  if ('redirect' in redirect) return redirect;

  const rawCallback =
    typeof context.query.callbackUrl === 'string' ? context.query.callbackUrl : '/lobby';
  const callbackUrl = rawCallback.startsWith('/') ? rawCallback : '/lobby';

  return { props: { callbackUrl } };
};
