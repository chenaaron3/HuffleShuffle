import type { pokerTables } from "~/server/db/schema";

export type TableRow = typeof pokerTables.$inferSelect;

export type BlindState = {
  multiplier: number;
  elapsedSeconds: number;
  stepSeconds: number;
  startedAt: Date | null;
  effectiveSmallBlind: number;
  effectiveBigBlind: number;
};

export const DEFAULT_BLIND_STEP_SECONDS = 600;
export const MAX_BLIND_MULTIPLIER = 64;

export function sanitizeStepSeconds(value: number | null | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_BLIND_STEP_SECONDS;
  }
  return value > 0 ? Math.floor(value) : DEFAULT_BLIND_STEP_SECONDS;
}

export function computeBlindState(
  table: TableRow | null,
  now: Date = new Date(),
): BlindState {
  if (!table) {
    return {
      multiplier: 1,
      elapsedSeconds: 0,
      stepSeconds: DEFAULT_BLIND_STEP_SECONDS,
      startedAt: null,
      effectiveSmallBlind: 0,
      effectiveBigBlind: 0,
    };
  }

  const stepSeconds = sanitizeStepSeconds(table.blindStepSeconds);
  const startedAt = table.blindTimerStartedAt;

  const elapsedSeconds =
    startedAt != null
      ? Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000))
      : 0;

  const steps = stepSeconds > 0 ? Math.floor(elapsedSeconds / stepSeconds) : 0;
  const multiplier = Math.min(MAX_BLIND_MULTIPLIER, Math.max(1, 2 ** steps));

  return {
    multiplier,
    elapsedSeconds,
    stepSeconds,
    startedAt,
    effectiveSmallBlind: table.smallBlind * multiplier,
    effectiveBigBlind: table.bigBlind * multiplier,
  };
}
