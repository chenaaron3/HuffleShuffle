import { cn } from '~/lib/utils';

const bandToneClass = {
  lift: 'bg-landing-midnight-soft',
  deep: 'bg-[#05070c]',
} as const;

/** Full-bleed section wash that fades into neighboring sections. */
export function SectionBand({ tone }: { tone: keyof typeof bandToneClass }) {
  return <div aria-hidden="true" className={cn('landing-section-band', bandToneClass[tone])} />;
}
