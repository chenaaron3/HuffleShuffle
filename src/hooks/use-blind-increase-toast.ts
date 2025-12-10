import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useLiveBlindState } from '~/hooks/use-live-blind-state';

/**
 * Hook that watches for blind increases and shows a toast notification.
 * Uses live blind state multiplier to detect increases (more frequent updates).
 * The multiplier doubles every stepSeconds interval.
 */
export function useBlindIncreaseToast() {
  const liveBlindState = useLiveBlindState();
  const previousMultiplierRef = useRef<number | null>(null);

  useEffect(() => {
    // Use live blind state multiplier (updates more frequently than server)
    const currentMultiplier = liveBlindState.multiplier;

    // Initialize ref on first load
    if (previousMultiplierRef.current === null) {
      previousMultiplierRef.current = currentMultiplier;
      return;
    }

    // Show toast when multiplier has increased
    if (currentMultiplier > previousMultiplierRef.current) {
      // Show toast notification with current display values
      toast.warning("Blinds Increased!", {
        // position: "top-center",
        duration: 3000,
      });
    }

    // Update ref
    previousMultiplierRef.current = currentMultiplier;
  }, [liveBlindState.multiplier]);
}
