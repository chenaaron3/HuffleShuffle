import { useEffect, useRef } from 'react';

import { useSoundEffects } from '~/components/providers/SoundProvider';
import {
  ACTION_TIMER_LOW_REMAINING_MS,
  PLAYER_ACTION_TIMEOUT_MS,
} from '~/constants/timer';

function turnStartEpochMs(
  turnStartTime: Date | string | null | undefined,
): number | null {
  if (turnStartTime == null) return null;
  const ms =
    turnStartTime instanceof Date
      ? turnStartTime.getTime()
      : typeof turnStartTime === 'string'
        ? Date.parse(turnStartTime)
        : NaN;
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Plays once per action clock when remaining time first enters the last ~5 seconds.
 */
export function useActionTimerLowSound(params: {
  gameState: string | undefined;
  turnStartTime: Date | string | null | undefined;
}) {
  const { gameState, turnStartTime } = params;
  const { play } = useSoundEffects();
  const trackedTurnStartMs = useRef<number | null>(null);
  const lowSoundFired = useRef(false);

  useEffect(() => {
    if (gameState !== 'BETTING') {
      trackedTurnStartMs.current = null;
      lowSoundFired.current = false;
      return;
    }

    const startMs = turnStartEpochMs(turnStartTime);
    if (startMs == null) {
      trackedTurnStartMs.current = null;
      lowSoundFired.current = false;
      return;
    }

    if (trackedTurnStartMs.current !== startMs) {
      trackedTurnStartMs.current = startMs;
      lowSoundFired.current = false;
    }

    const tick = () => {
      const elapsed = Date.now() - startMs;
      const remaining = PLAYER_ACTION_TIMEOUT_MS - elapsed;
      if (
        !lowSoundFired.current &&
        remaining > 0 &&
        remaining <= ACTION_TIMER_LOW_REMAINING_MS
      ) {
        lowSoundFired.current = true;
        play('actionTimeLow', { interrupt: false });
      }
    };

    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [gameState, turnStartTime, play]);
}
