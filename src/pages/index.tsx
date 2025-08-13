import { signIn, signOut, useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import { CometCard } from '~/components/ui/comet-card';
import { GlowingEffect } from '~/components/ui/glowing-effect';

export default function Home() {
  const { data: session } = useSession();
  return (
    <>
      <Head>
        <title>HuffleShuffle</title>
        <meta name="description" content="Play online poker with a live dealer" />
      </Head>
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#0b0f14] via-[#0a0d12] to-black text-white">
        {/* Decorative gold images */}
        <img
          src="/shuffle1.png"
          alt="gold chip arc"
          className="pointer-events-none absolute right-0 top-0 h-[520px] w-auto opacity-80 sm:h-[680px] md:h-[760px]"
        />
        <img
          src="/shuffle2.png"
          alt="gold club arc"
          className="pointer-events-none absolute -bottom-24 -left-16 h-[520px] w-auto opacity-80 sm:h-[680px] md:h-[760px]"
        />

        {/* Gold glow */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(255,215,0,0.12),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(255,215,0,0.08),transparent_55%)]" />
        {/* Subtle vertical gradient overlay for depth */}
        <div className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(180deg,rgba(212,175,55,0.05)_0%,rgba(0,0,0,0)_35%,rgba(212,175,55,0.03)_70%,transparent_100%)]" />

        <section className="relative mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-14 text-center">
          {/* Comet cards above the headline (interactive) */}
          <div className="relative flex items-center justify-center">
            <CometCard rotateDepth={50} translateDepth={50} className="-mr-14 sm:-mr-10">
              <img
                src="/AceHeart.png"
                alt="Ace of Hearts"
                className="h-[280px] w-auto rotate-[-12deg] rounded-xl shadow-[0_24px_70px_rgba(212,175,55,0.18)]"
              />
            </CometCard>
            <CometCard rotateDepth={50} translateDepth={50} className="-ml-20 z-10">
              <img
                src="/AceSpade.png"
                alt="Ace of Spades"
                className="h-[300px] w-auto rotate-[10deg] rounded-xl shadow-[0_24px_70px_rgba(212,175,55,0.18)]"
              />
            </CometCard>
          </div>

          <h1 className="bg-gradient-to-r from-[#FFD700] via-[#F2C14E] to-[#D4AF37] bg-clip-text text-6xl font-extrabold tracking-tight text-transparent md:text-7xl">
            Live‑Dealer Online Poker
          </h1>
          <p className="max-w-2xl text-lg text-zinc-300">
            Join a table and play Texas Hold’em streamed live with a live dealer. Simple, fast, and social.
          </p>
          <div className="flex gap-4">
            {session ? (
              <>
                <Link href="/lobby" className="rounded-md bg-gradient-to-r from-[#FFD700] via-[#F2C14E] to-[#D4AF37] px-6 py-3 font-medium text-black shadow-[0_0_30px_rgba(212,175,55,0.25)] hover:brightness-95">
                  Enter Lobby
                </Link>
                <button onClick={() => void signOut()} className="rounded-md border border-white/10 px-6 py-3 text-white hover:bg-white/10">
                  Sign out
                </button>
              </>
            ) : (
              <button onClick={() => void signIn()} className="rounded-md bg-gradient-to-r from-[#FFD700] via-[#F2C14E] to-[#D4AF37] px-6 py-3 font-medium text-black shadow-[0_0_30px_rgba(212,175,55,0.25)] hover:brightness-95">
                Sign in to Play
              </button>
            )}
          </div>
        </section>

        {/* Value props */}
        <section className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-6 pb-20 md:grid-cols-3">
          {[
            { title: 'Live Dealers', desc: 'Professionally hosted streams — feel the casino vibe from home.' },
            { title: 'Instant Seats', desc: 'Jump into active tables with one click. No downloads.' },
            { title: 'Real Decks', desc: 'Every card is dealt from a real deck by a live dealer on camera — no RNG, no scripts.' },
          ].map((f) => (
            <div key={f.title} className="relative rounded-xl border border-white/10 bg-zinc-900/40 p-5 shadow-[0_0_40px_rgba(212,175,55,0.08)]">
              <GlowingEffect disabled={false} blur={4} proximity={60} spread={20} className="rounded-xl" />
              <div className="mb-2 inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#FFD700]"></span>
                <h3 className="text-lg font-semibold">{f.title}</h3>
              </div>
              <p className="text-sm text-zinc-400">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <h2 className="mb-6 text-center text-2xl font-semibold">How it works</h2>
          <ol className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {[
              { n: 1, t: 'Sign in', d: 'Create your account and wallet.' },
              { n: 2, t: 'Enter Lobby', d: 'Browse live tables and pick your stakes.' },
              { n: 3, t: 'Buy‑in', d: 'Join a seat and set your buy‑in instantly.' },
              { n: 4, t: 'Play Live', d: 'Chat, bet, and enjoy the show with live dealers.' },
            ].map((s) => (
              <li key={s.n} className="relative rounded-xl border border-white/10 bg-zinc-900/40 p-5">
                <GlowingEffect disabled={false} blur={3} proximity={50} spread={18} className="rounded-xl" />
                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-b from-[#FFD700] to-[#D4AF37] font-bold text-black">
                  {s.n}
                </div>
                <div className="text-sm font-medium">{s.t}</div>
                <p className="text-xs text-zinc-400">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA Band */}
        <section className="mx-auto mb-24 max-w-5xl rounded-2xl border border-yellow-500/10 bg-gradient-to-r from-[#1a1406] via-[#161107] to-[#120f07] px-6 py-8 text-center shadow-[0_0_60px_rgba(212,175,55,0.15)]">
          <h3 className="mb-3 text-xl font-semibold">Ready to take a seat?</h3>
          <p className="mx-auto mb-5 max-w-2xl text-sm text-zinc-400">Log in, pick a table, and play with real people and real dealers in minutes.</p>
          <Link href="/lobby" className="inline-block rounded-md bg-gradient-to-r from-[#FFD700] via-[#F2C14E] to-[#D4AF37] px-6 py-3 font-medium text-black hover:brightness-95">
            Go to Lobby
          </Link>
        </section>
      </main>
    </>
  );
}
