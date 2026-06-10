/** Default interval between blind level increases (seconds). */
export const DEFAULT_BLIND_STEP_SECONDS = 600;

/** Maximum blind multiplier. Blinds stop increasing once this is reached. */
export const MAX_BLIND_MULTIPLIER = 100000;

/**
 * Blind progression using chip-friendly "preferred numbers" that grow
 * ~×1.47 per level (×10 every 6 levels) instead of doubling.
 *
 * First decade omits 1.5 so multipliers stay integers for any base blinds.
 */
const FIRST_DECADE_MULTIPLIERS = [1, 2, 3, 4, 5];
const DECADE_MULTIPLIERS = [10, 15, 20, 30, 40, 50];

/**
 * Multiplier for a given number of completed blind steps.
 * Sequence: 1, 2, 3, 4, 5, 10, 15, 20, 30, 40, 50, 100, 150, …
 * (capped at MAX_BLIND_MULTIPLIER).
 */
export function computeBlindMultiplier(steps: number): number {
  if (steps <= 0) return 1;
  if (steps < FIRST_DECADE_MULTIPLIERS.length) {
    return FIRST_DECADE_MULTIPLIERS[steps]!;
  }
  const i = steps - FIRST_DECADE_MULTIPLIERS.length;
  const multiplier =
    DECADE_MULTIPLIERS[i % DECADE_MULTIPLIERS.length]! *
    10 ** Math.floor(i / DECADE_MULTIPLIERS.length);
  return Math.min(MAX_BLIND_MULTIPLIER, multiplier);
}

/** True when further steps would not increase the multiplier. */
export function isBlindMultiplierAtCap(steps: number): boolean {
  return steps > 0 && computeBlindMultiplier(steps) >= MAX_BLIND_MULTIPLIER;
}
