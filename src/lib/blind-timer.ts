/** Default interval between blind level increases (seconds). */
export const DEFAULT_BLIND_STEP_SECONDS = 600;

/** Maximum blind multiplier (2^16). Blinds double each step until this cap. */
export const MAX_BLIND_MULTIPLIER = 65536;

/** Multiplier for a given number of completed blind steps (1, 2, 4, … capped at MAX). */
export function computeBlindMultiplier(steps: number): number {
  if (steps <= 0) return 1;
  return Math.min(MAX_BLIND_MULTIPLIER, Math.max(1, 2 ** steps));
}

/** True when further steps would not increase the multiplier. */
export function isBlindMultiplierAtCap(steps: number): boolean {
  return steps > 0 && computeBlindMultiplier(steps) >= MAX_BLIND_MULTIPLIER;
}
