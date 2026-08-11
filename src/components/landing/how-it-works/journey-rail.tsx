import { journeySteps, type JourneyStepId } from '../landing-data';

export function JourneyRail({ activeStep }: { activeStep: JourneyStepId }) {
  return (
    <aside
      aria-label="How it works steps"
      className="self-start lg:sticky lg:top-[max(2rem,calc(50vh-6.5rem))]"
    >
      <div className="relative pl-8">
        <div className="absolute bottom-2 left-9 top-2 w-px bg-gradient-to-b from-landing-gold via-landing-gold/40 to-white/10" />
        <nav aria-label="Journey steps" className="space-y-7">
          {journeySteps.map((step) => (
            <a
              aria-current={activeStep === step.id ? 'step' : undefined}
              className={`group relative block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-landing-gold-bright ${activeStep === step.id ? 'text-[#fff1bd]' : 'text-slate-500'}`}
              href={`#story-${step.key}`}
              key={step.id}
            >
              <span
                className={`absolute -left-1 top-1/2 grid size-4 -translate-y-1/2 place-items-center rounded-full border text-[8px] font-bold ${
                  activeStep === step.id
                    ? 'border-landing-gold-bright bg-landing-gold text-landing-ink shadow-[0_0_0_5px_rgba(244,201,93,0.11),0_0_20px_rgba(244,201,93,0.2)]'
                    : 'border-white/25 bg-[#101721] text-slate-400'
                }`}
              >
                {step.id}
              </span>
              <div
                className={`pl-5 font-display text-lg font-semibold ${
                  activeStep === step.id ? 'opacity-100' : 'opacity-65 group-hover:opacity-100'
                }`}
              >
                {step.title}
              </div>
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}
