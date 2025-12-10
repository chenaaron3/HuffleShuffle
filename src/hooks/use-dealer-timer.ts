import { useEffect, useRef } from 'react';
import { PLAYER_ACTION_TIMEOUT_MS } from '~/constants/timer';
import { api } from '~/utils/api';

interface UseDealerTimerProps {
  tableId: string;
  gameState?: string;
  assignedSeatId?: string | null;
  turnStartTime?: Date | null;
  isDealer: boolean;
}

export function useDealerTimer({
  tableId,
  gameState,
  assignedSeatId,
  turnStartTime,
  isDealer,
}: UseDealerTimerProps) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutMutation = api.table.timeout.useMutation();

  useEffect(() => {
    console.log("Dealer timer effect triggered", {
      isDealer,
      gameState,
      assignedSeatId,
      turnStartTime,
      tableId,
    });

    // Clear any existing timeout
    if (timeoutRef.current) {
      console.log("Dealer timer: Clearing existing timeout");
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Only set up timer for dealers during betting
    if (!isDealer) {
      console.log("Dealer timer: Not a dealer, skipping");
      return;
    }

    if (gameState !== "BETTING") {
      console.log("Dealer timer: Not in BETTING state, skipping", {
        gameState,
      });
      return;
    }

    if (!assignedSeatId) {
      console.log("Dealer timer: No assigned seat ID, skipping");
      return;
    }

    if (!turnStartTime) {
      console.log("Dealer timer: No turn start time, skipping", {
        gameState,
        assignedSeatId,
        turnStartTime,
      });
      return;
    }

    // Calculate when the timeout should occur
    const turnStartTimeMs = turnStartTime.getTime();
    const timeoutTime = turnStartTimeMs + PLAYER_ACTION_TIMEOUT_MS;
    const now = Date.now();
    const delay = Math.max(0, timeoutTime - now);

    console.log("Dealer timer: Setting timeout", {
      assignedSeatId,
      turnStartTime,
      now: new Date(now),
      timeoutTime: new Date(timeoutTime),
      delay: delay / 1000 + "s",
    });

    // Don't set up timeout if delay is 0 or negative (timeout already passed)
    if (delay <= 0) {
      console.log("Dealer timer: Delay is 0 or negative, not setting timeout", {
        delay,
      });
      return;
    }

    // Set up the timeout
    timeoutRef.current = setTimeout(() => {
      console.log("Dealer timer: Timeout reached, calling API", {
        tableId,
        seatId: assignedSeatId,
      });

      // Call the timeout API
      timeoutMutation.mutate(
        {
          tableId,
          seatId: assignedSeatId,
        },
        {
          onSuccess: (data) => {
            console.log("Timeout API call succeeded", data);
          },
          onError: (error) => {
            console.error("Timeout API call failed:", error);
          },
        },
      );
    }, delay);

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        console.log("Dealer timer: Cleanup - clearing timeout");
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [
    tableId,
    gameState,
    assignedSeatId,
    turnStartTime,
    isDealer,
    // timeoutMutation,
  ]);

  // Log when dependencies change
  useEffect(() => {
    console.log("Dealer timer dependencies changed", {
      tableId,
      gameState,
      assignedSeatId,
      turnStartTime,
      isDealer,
    });
  }, [tableId, gameState, assignedSeatId, turnStartTime, isDealer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
}
