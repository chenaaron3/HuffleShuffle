import React, { useEffect, useRef, useState } from 'react';
import { seats } from '~/server/db/schema';
import { getPotPosition, getSeatPosition } from '~/utils/dom-positions';

import type { SeatWithPlayer } from "~/server/api/routers/table";
interface UsePokerAnimationsProps {
  seats: SeatWithPlayer[];
  gameState: string;
}

interface ChipStream {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  amount: number;
}

export function usePokerAnimations({
  seats,
  gameState,
}: UsePokerAnimationsProps) {
  const previousSeatsRef = useRef<SeatWithPlayer[]>([]);
  const [chipStreams, setChipStreams] = useState<ChipStream[]>([]);

  // Function to trigger chip stream
  const triggerChipStream = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    amount: number,
  ) => {
    console.log("usePokerAnimations: triggerChipStream called with", {
      from,
      to,
      amount,
    });
    const id = Math.random().toString(36).substr(2, 9);
    setChipStreams((prev) => [...prev, { id, from, to, amount }]);
  };

  // Function to remove chip stream
  const removeChipStream = (id: string) => {
    setChipStreams((prev) => prev.filter((stream) => stream.id !== id));
  };

  // Check if game state has changed
  useEffect(() => {
    console.log("usePokerAnimations: Game state changed", {
      gameState,
      seatsCount: seats.length,
      previousSeatsCount: previousSeatsRef.current.length,
    });

    if (["DEAL_FLOP", "DEAL_TURN", "DEAL_RIVER"].includes(gameState)) {
      // Trigger chip streams from all seats with bets to pot
      // Use previous seats because current seats have bets reset to 0
      previousSeatsRef.current.forEach((previousSeat) => {
        if (
          previousSeat &&
          previousSeat.seatStatus === "active" &&
          previousSeat.currentBet > 0
        ) {
          console.log("usePokerAnimations: Triggering chip stream for seat", {
            seatId: previousSeat.id,
            bet: previousSeat.currentBet,
          });

          // Get exact DOM positions - start from the bet chip, not the seat center
          const fromPosition = getSeatPosition(previousSeat.id);
          const toPosition = getPotPosition();

          console.log("usePokerAnimations: DOM position lookup results", {
            seatId: previousSeat.id,
            fromPosition,
            toPosition,
          });

          console.log("usePokerAnimations: Using exact DOM positions", {
            fromPosition,
            toPosition,
          });

          triggerChipStream(fromPosition, toPosition, previousSeat.currentBet);
        }
      });
    }

    // Detect winner distribution (showdown state)
    if (gameState === "SHOWDOWN") {
      // Trigger chip streams from pot to winners
      seats.forEach((seat) => {
        if (seat && seat.winAmount && seat.winAmount > 0) {
          console.log("usePokerAnimations: Triggering winner chip stream", {
            seatId: seat.id,
            winAmount: seat.winAmount,
          });

          // Get exact DOM positions - from pot to seat center (where balance is displayed)
          const fromPosition = getPotPosition();
          const toPosition = getSeatPosition(seat.id);

          console.log(
            "usePokerAnimations: Using exact DOM positions for winner",
            {
              fromPosition,
              toPosition,
            },
          );

          triggerChipStream(fromPosition!, toPosition!, seat.winAmount);
        }
      });
    }

    // Update previous seats after processing the state change
    previousSeatsRef.current = seats;
  }, [seats, gameState]);

  // Return the animation functions and chip streams
  return {
    triggerChipStream,
    chipStreams,
    removeChipStream,
  };
}
