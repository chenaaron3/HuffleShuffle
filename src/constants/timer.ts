// Timer constants for poker game actions
export const PLAYER_ACTION_TIMEOUT_SECONDS = 25;
export const PLAYER_ACTION_TIMEOUT_MS = PLAYER_ACTION_TIMEOUT_SECONDS * 1000;

// Warning threshold for visual feedback (3 seconds remaining)
export const TIMER_WARNING_THRESHOLD_SECONDS = 3;
export const TIMER_WARNING_THRESHOLD_MS =
  TIMER_WARNING_THRESHOLD_SECONDS * 1000;

/** One-shot sound cue when the action clock enters the last ~5 seconds */
export const ACTION_TIMER_LOW_REMAINING_SECONDS = 5;
export const ACTION_TIMER_LOW_REMAINING_MS =
  ACTION_TIMER_LOW_REMAINING_SECONDS * 1000;
