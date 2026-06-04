import { useEffect, useMemo, useState } from 'react';
import {
  computeBlindMultiplier,
  isBlindMultiplierAtCap,
} from '~/lib/blind-timer';
import { useTableSnapshot } from '~/hooks/use-table-selectors';

/**
 * Hook that calculates live blind state with client-side interpolation.
 * This provides tighter feedback by calculating blind increases locally
 * before the server snapshot updates.
 */
export function useLiveBlindState() {
  const snapshot = useTableSnapshot();
  const [tick, setTick] = useState(0);
  const blinds = snapshot?.blinds;

  const isWallClockRunning = Boolean(blinds?.startedAt);
  const isPaused = blinds?.isPaused ?? false;
  const elapsedSeconds = blinds?.elapsedSeconds ?? 0;
  const stepSeconds = blinds?.stepSeconds ?? 0;

  // Sync local tick with timer status
  useEffect(() => {
    if (!isWallClockRunning) {
      setTick(0);
      return;
    }
    // Reset tick if we get a fresh update from server to avoid double counting
    setTick(0);

    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isWallClockRunning, elapsedSeconds]);

  // Extract primitive values from blinds to avoid unnecessary recalculations
  const multiplier = blinds?.multiplier ?? 1;
  const effectiveSmallBlind = blinds?.effectiveSmallBlind ?? 0;
  const effectiveBigBlind = blinds?.effectiveBigBlind ?? 0;

  const liveState = useMemo(() => {
    if (!blinds || stepSeconds <= 0) {
      return {
        multiplier,
        effectiveSmallBlind,
        effectiveBigBlind,
        secondsUntilNextIncrease: stepSeconds,
        progressPercent: 0,
        isAtMaxMultiplier: false,
      };
    }

    const liveElapsedSeconds = isWallClockRunning
      ? elapsedSeconds + tick
      : elapsedSeconds;
    const steps = Math.floor(liveElapsedSeconds / stepSeconds);
    const atMaxMultiplier = isBlindMultiplierAtCap(steps);

    const remainder = liveElapsedSeconds % stepSeconds;
    const secondsUntilNextIncrease = atMaxMultiplier
      ? 0
      : remainder === 0
        ? stepSeconds
        : stepSeconds - remainder;

    // Calculate progress (0 to 100); full bar when capped
    const progressPercent = atMaxMultiplier
      ? 100
      : ((stepSeconds - secondsUntilNextIncrease) / stepSeconds) * 100;

    // Calculate local blind increase
    // If we have passed the step threshold locally before server update
    let currentMultiplier = multiplier;
    let displaySmallBlind = effectiveSmallBlind;
    let displayBigBlind = effectiveBigBlind;

    if (steps > 0 && multiplier > 0) {
      // Derive base blinds (current / current_multiplier)
      // Note: The 'blinds' prop has the state from the last server snapshot.
      // So effectiveSmallBlind is base * multiplier
      const baseSmall = effectiveSmallBlind / multiplier;
      const baseBig = effectiveBigBlind / multiplier;

      currentMultiplier = computeBlindMultiplier(steps);

      displaySmallBlind = Math.round(baseSmall * currentMultiplier);
      displayBigBlind = Math.round(baseBig * currentMultiplier);
    }

    return {
      multiplier: currentMultiplier,
      effectiveSmallBlind: displaySmallBlind,
      effectiveBigBlind: displayBigBlind,
      secondsUntilNextIncrease: isWallClockRunning || isPaused
        ? secondsUntilNextIncrease
        : stepSeconds,
      progressPercent:
        isWallClockRunning || isPaused ? progressPercent : 0,
      isAtMaxMultiplier: atMaxMultiplier,
    };
  }, [
    blinds,
    multiplier,
    effectiveSmallBlind,
    effectiveBigBlind,
    stepSeconds,
    elapsedSeconds,
    tick,
    isWallClockRunning,
    isPaused,
  ]);

  return { ...liveState, isPaused };
}
