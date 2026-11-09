export type JourneyStepId = string;
export type StoryStepKey = string;
export type LobbyStatus = 'live dealer' | 'warming up';

/** Everything a "How it works" story needs; the panel is rendered by the section. */
export interface JourneyStep {
  id: JourneyStepId;
  /** Used for anchors (#story-{key}) */
  key: StoryStepKey;
  /** Short label in the step rail */
  title: string;
  /** Headline inside the story frame */
  frameTitle: string;
  eyebrow: string;
  badge: string;
  badgeClass: string;
  footer: string;
}

export interface ValueProp {
  title: string;
  description: string;
  icon: 'dealer' | 'seat' | 'deck';
}

export interface LobbyTable {
  id: string;
  name: string;
  stakes: string;
  status: LobbyStatus;
  seatsOpen: number;
  seatsTotal: number;
  featured?: boolean;
}


export interface ChipValue {
  id: string;
  value: 25;
  /** Amount threshold at which this chip becomes visible */
  unlockAt: number;
  gridColumn: number;
  gridRow: number;
}

export const valueProps: ValueProp[] = [
  {
    title: 'Live Dealers',
    description: 'Professionally hosted streams — feel the casino vibe from home.',
    icon: 'dealer',
  },
  {
    title: 'Instant Seats',
    description: 'Jump into active tables with one click. No downloads.',
    icon: 'seat',
  },
  {
    title: 'Real Decks',
    description: 'Every card is dealt from a real deck by a live dealer on camera — no RNG, no scripts.',
    icon: 'deck',
  },
];

export const lobbyTables: LobbyTable[] = [
  {
    id: 'midnight-holdem',
    name: "Midnight Hold'em",
    stakes: '$1 / $2',
    status: 'live dealer',
    seatsOpen: 6,
    seatsTotal: 9,
    featured: true,
  },
  {
    id: 'high-roller-room',
    name: 'High Roller Room',
    stakes: '$5 / $10',
    status: 'warming up',
    seatsOpen: 3,
    seatsTotal: 9,
  },
  {
    id: 'after-hours',
    name: 'The After Hours',
    stakes: '$0.50 / $1',
    status: 'live dealer',
    seatsOpen: 8,
    seatsTotal: 9,
  },
];

const badge = {
  emerald: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200',
  gold: 'border-landing-gold/20 bg-landing-gold/[0.07] text-landing-gold-bright',
  muted: 'border-white/10 bg-white/[0.04] text-slate-400',
  rose: 'border-rose-300/20 bg-rose-300/10 text-rose-200',
};

/** Wallet + buy-in flow (for when real-money play launches). */
export const walletJourneySteps: JourneyStep[] = [
  {
    id: '1',
    key: 'sign-in',
    title: 'Sign in',
    frameTitle: 'Sign in, then keep your seat.',
    eyebrow: 'one-time setup',
    badge: 'secure wallet',
    badgeClass: badge.emerald,
    footer: 'Your wallet is ready before the first hand.',
  },
  {
    id: '2',
    key: 'lobby',
    title: 'Enter Lobby',
    frameTitle: 'Pick the energy you want.',
    eyebrow: 'find the room',
    badge: '12 tables live',
    badgeClass: badge.gold,
    footer: 'Every room has a dealer, a rhythm, and a seat with your name on it.',
  },
  {
    id: '3',
    key: 'buy-in',
    title: 'Buy-in',
    frameTitle: 'Buy-in without the busywork.',
    eyebrow: 'claim your seat',
    badge: 'instant seat',
    badgeClass: badge.muted,
    footer: 'No waiting room. No hidden steps. Just a clear buy-in and a live seat.',
  },
  {
    id: '4',
    key: 'play-live',
    title: 'Play Live',
    frameTitle: 'The room is live now.',
    eyebrow: 'the good part',
    badge: 'dealer on camera',
    badgeClass: badge.rose,
    footer: 'Chat, bet, and enjoy the show with live dealers.',
  },
];

/** How the app works today: sign in, reserve a seat, play. No real money. */
export const todayJourneySteps: JourneyStep[] = [
  {
    id: '1',
    key: 'sign-in',
    title: 'Sign in',
    frameTitle: 'One tap with Google.',
    eyebrow: 'no setup',
    badge: 'no downloads',
    badgeClass: badge.emerald,
    footer: 'No wallet. No deposit. Just your Google account.',
  },
  {
    id: '2',
    key: 'register',
    title: 'Reserve a seat',
    frameTitle: 'Grab a seat for Sunday.',
    eyebrow: 'save your spot',
    badge: '8 seats per game',
    badgeClass: badge.gold,
    footer: 'Full? Join standby and move up when a seat opens.',
  },
  {
    id: '3',
    key: 'play-live',
    title: 'Play live',
    frameTitle: 'Play with a real dealer.',
    eyebrow: 'the good part',
    badge: 'dealer on camera',
    badgeClass: badge.rose,
    footer: 'Real cards, real dealer, play chips only.',
  },
];

/** Pyramid: left 1, middle 2, right 3 — all $25, unlock as buy-in climbs to $150 */
export const chipStack: ChipValue[] = [
  { id: 'chip-l1', value: 25, unlockAt: 25, gridColumn: 1, gridRow: 3 },
  { id: 'chip-m1', value: 25, unlockAt: 50, gridColumn: 2, gridRow: 3 },
  { id: 'chip-r1', value: 25, unlockAt: 75, gridColumn: 3, gridRow: 3 },
  { id: 'chip-m2', value: 25, unlockAt: 100, gridColumn: 2, gridRow: 2 },
  { id: 'chip-r2', value: 25, unlockAt: 125, gridColumn: 3, gridRow: 2 },
  { id: 'chip-r3', value: 25, unlockAt: 150, gridColumn: 3, gridRow: 1 },
];

export const BUY_IN_MAX = 150;

/** AI-generated (Higgsfield) from frames of Cris in the demo video. */
export const dealerImage = '/landing/optimized/cris-dealer.webp';

export const demoVideo = '/landing/optimized/demo.mp4';
export const demoPoster = '/landing/optimized/demo-poster.webp';

export const goldChipImage = '/landing/optimized/gold-chip.webp';

export const aceHeartImage = '/landing/optimized/ace-heart.webp';
export const aceSpadeImage = '/landing/optimized/ace-spade.webp';
export const shuffle1Image = '/landing/optimized/shuffle1.webp';
export const shuffle2Image = '/landing/optimized/shuffle2.webp';

/** 0 = farthest/slowest, 2 = nearest/fastest */
export type ChipParallaxLayer = 0 | 1 | 2;

export interface JourneyChipPlacement {
  id: string;
  top: string;
  left: string;
  size: number;
  rotate: number;
  opacity: number;
  layer: ChipParallaxLayer;
}

/** Decorative chips behind How it works — smaller/farther layers move slower */
export const journeyChipPlacements: JourneyChipPlacement[] = [
  // Far (layer 0)
  { id: 'chip-f1', top: '6%', left: '70%', size: 40, rotate: -18, opacity: 0.09, layer: 0 },
  { id: 'chip-f2', top: '16%', left: '8%', size: 34, rotate: 12, opacity: 0.08, layer: 0 },
  { id: 'chip-f3', top: '28%', left: '92%', size: 38, rotate: -6, opacity: 0.08, layer: 0 },
  { id: 'chip-f4', top: '40%', left: '18%', size: 32, rotate: 20, opacity: 0.07, layer: 0 },
  { id: 'chip-f5', top: '52%', left: '86%', size: 42, rotate: -14, opacity: 0.09, layer: 0 },
  { id: 'chip-f6', top: '64%', left: '4%', size: 36, rotate: 8, opacity: 0.08, layer: 0 },
  { id: 'chip-f7', top: '76%', left: '74%', size: 34, rotate: -22, opacity: 0.08, layer: 0 },
  { id: 'chip-f8', top: '90%', left: '28%', size: 40, rotate: 16, opacity: 0.09, layer: 0 },
  // Mid (layer 1)
  { id: 'chip-m1', top: '10%', left: '54%', size: 66, rotate: -22, opacity: 0.13, layer: 1 },
  { id: 'chip-m2', top: '24%', left: '78%', size: 58, rotate: 16, opacity: 0.12, layer: 1 },
  { id: 'chip-m3', top: '36%', left: '6%', size: 62, rotate: -10, opacity: 0.11, layer: 1 },
  { id: 'chip-m4', top: '48%', left: '66%', size: 72, rotate: 8, opacity: 0.13, layer: 1 },
  { id: 'chip-m5', top: '60%', left: '90%', size: 54, rotate: -28, opacity: 0.11, layer: 1 },
  { id: 'chip-m6', top: '72%', left: '40%', size: 68, rotate: 14, opacity: 0.12, layer: 1 },
  { id: 'chip-m7', top: '84%', left: '14%', size: 56, rotate: -8, opacity: 0.11, layer: 1 },
  { id: 'chip-m8', top: '94%', left: '82%', size: 64, rotate: 20, opacity: 0.12, layer: 1 },
  // Near (layer 2)
  { id: 'chip-n1', top: '12%', left: '38%', size: 96, rotate: 10, opacity: 0.17, layer: 2 },
  { id: 'chip-n2', top: '30%', left: '60%', size: 108, rotate: -16, opacity: 0.16, layer: 2 },
  { id: 'chip-n3', top: '46%', left: '24%', size: 90, rotate: 20, opacity: 0.15, layer: 2 },
  { id: 'chip-n4', top: '58%', left: '80%', size: 104, rotate: -12, opacity: 0.16, layer: 2 },
  { id: 'chip-n5', top: '74%', left: '50%', size: 92, rotate: 6, opacity: 0.15, layer: 2 },
  { id: 'chip-n6', top: '88%', left: '68%', size: 100, rotate: -20, opacity: 0.16, layer: 2 },
];
