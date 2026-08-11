function BrandMark() {
  return (
    <div
      aria-hidden="true"
      className="grid size-9 place-items-center rounded-full border border-landing-gold/60 bg-landing-gold/10 text-landing-gold-bright shadow-[0_0_22px_rgba(244,201,93,0.15)]"
    >
      <svg className="size-[18px]" fill="none" viewBox="0 0 24 24">
        <rect height="14" rx="2" stroke="currentColor" strokeWidth="1.6" width="10" x="3.5" y="5" />
        <rect
          height="14"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.6"
          transform="rotate(12 14 12)"
          width="10"
          x="9.5"
          y="4"
        />
      </svg>
    </div>
  );
}

export function LandingHeader() {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-40">
      <div className="pointer-events-auto mx-auto flex max-w-7xl items-center justify-between px-6 pt-6 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <div className="font-display text-sm font-semibold tracking-[0.18em] text-landing-gold-bright">
              HUFFLESHUFFLE
            </div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Live-dealer poker</div>
          </div>
        </div>

        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-7 text-xs uppercase tracking-[0.2em] text-slate-400 md:flex"
        >
          <a className="hover:text-landing-gold-bright" href="#value-props">
            Live tables
          </a>
          <span className="flex items-center gap-2">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-300" />
            Dealers online
          </span>
          <a
            className="rounded-full border border-white/10 px-4 py-2 text-slate-300 hover:border-landing-gold/50 hover:text-landing-gold-bright focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-landing-gold-bright"
            href="#journey"
          >
            How it works
          </a>
        </nav>
      </div>
    </header>
  );
}
