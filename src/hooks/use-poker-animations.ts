import { useContext, useEffect, useRef } from 'react';
import { AnimationContext } from '~/components/ui/chip-animations';
import {
    getPotPosition, getSeatChipPosition, getSeatPosition, waitForElementPosition
} from '~/utils/dom-positions';

import type { SeatWithPlayer } from "~/server/api/routers/table";

interface UsePokerAnimationsProps {
  seats: SeatWithPlayer[];
  potTotal: number;
  gameState?: string;
  previousSeats?: SeatWithPlayer[];
  previousPotTotal?: number;
  previousGameState?: string;
}

export function usePokerAnimations({
  seats,
  potTotal,
  gameState,
  previousSeats,
  previousPotTotal,
  previousGameState,
}: UsePokerAnimationsProps) {
  const animationContext = useContext(AnimationContext);
  const previousSeatsRef = useRef<SeatWithPlayer[]>([]);
  const previousPotTotalRef = useRef<number>(0);
  const previousGameStateRef = useRef<string>("");

  // Initialize previous values on first render
  useEffect(() => {
    if (previousSeatsRef.current.length === 0) {
      previousSeatsRef.current = seats;
      previousPotTotalRef.current = potTotal;
      previousGameStateRef.current = gameState || "";
    }
  }, [seats, potTotal, gameState]);

  useEffect(() => {
    if (!animationContext) return;

    console.log("usePokerAnimations: Game state changed", {
      gameState,
      previousGameState: previousGameStateRef.current,
      potTotal,
      previousPotTotal: previousPotTotalRef.current,
      seatsCount: seats.length,
    });

    // Detect bet increases
    seats.forEach((currentSeat, index) => {
      const previousSeat = previousSeatsRef.current[index];

      if (currentSeat && previousSeat) {
        const currentBet = currentSeat.currentBet || 0;
        const previousBet = previousSeat.currentBet || 0;

        // If bet increased, trigger pulsing chip animation
        if (currentBet > previousBet) {
          console.log("usePokerAnimations: Bet increase detected", {
            seatId: currentSeat.id,
            previousBet,
            currentBet,
            increase: currentBet - previousBet,
          });

          // Add a small delay to make the animation more visible
          setTimeout(() => {
            animationContext.triggerPulsingChip(currentBet - previousBet);
          }, 100);
        }
      }
    });

    // Detect any pot increases
    if (potTotal > previousPotTotalRef.current) {
      const potIncrease = potTotal - previousPotTotalRef.current;

      console.log("usePokerAnimations: Pot increase detected", {
        potIncrease,
        previousPot: previousPotTotalRef.current,
        currentPot: potTotal,
        previousState: previousGameStateRef.current,
        currentState: gameState,
      });

      // Trigger pot splash effect
      animationContext.triggerPotSplash();
    }

    // Detect pot increases (when betting round ends) - more lenient condition
    if (potTotal > previousPotTotalRef.current) {
      const potIncrease = potTotal - previousPotTotalRef.current;

      console.log("usePokerAnimations: Pot increase detected", {
        potIncrease,
        previousPot: previousPotTotalRef.current,
        currentPot: potTotal,
        previousState: previousGameStateRef.current,
        currentState: gameState,
      });

      // Trigger pot splash effect
      animationContext.triggerPotSplash();

      // Trigger chip streams from all seats with bets to pot
      seats.forEach(async (seat) => {
        if (seat && seat.currentBet && seat.currentBet > 0) {
          console.log("usePokerAnimations: Triggering chip stream for seat", {
            seatId: seat.id,
            bet: seat.currentBet,
          });

          // Get exact DOM positions - start from the bet chip, not the seat center
          const fromPosition = await waitForElementPosition(
            `seat-${seat.id}-chip`,
          );
          const toPosition = await waitForElementPosition("pot-display");

          console.log("usePokerAnimations: DOM position lookup results", {
            seatId: seat.id,
            fromPosition,
            toPosition,
            chipElementExists:
              document.getElementById(`seat-${seat.id}-chip`) !== null,
            potElementExists: document.getElementById("pot-display") !== null,
          });

          if (fromPosition && toPosition) {
            console.log("usePokerAnimations: Using exact DOM positions", {
              fromPosition,
              toPosition,
            });

            animationContext.triggerChipStream(
              fromPosition,
              toPosition,
              seat.currentBet,
            );
          } else {
            console.warn(
              "usePokerAnimations: Could not get DOM positions, using fallback",
            );
            // Fallback to approximate positions
            const seatIndex = seats.indexOf(seat);
            const screenWidth =
              typeof window !== "undefined" ? window.innerWidth : 1200;

            const fallbackFromPosition = {
              x: seatIndex < 4 ? 100 : screenWidth - 100,
              y: 300 + (seatIndex % 4) * 120,
            };
            const fallbackToPosition = {
              x: screenWidth - 150,
              y: 100,
            };

            console.log("usePokerAnimations: Using fallback positions", {
              fallbackFromPosition,
              fallbackToPosition,
            });

            animationContext.triggerChipStream(
              fallbackFromPosition,
              fallbackToPosition,
              seat.currentBet,
            );
          }
        }
      });
    }

    // Detect winner distribution (showdown state)
    if (
      gameState === "SHOWDOWN" &&
      previousGameStateRef.current !== "SHOWDOWN"
    ) {
      // Trigger chip streams from pot to winners
      seats.forEach(async (seat) => {
        if (seat && seat.winAmount && seat.winAmount > 0) {
          console.log("usePokerAnimations: Triggering winner chip stream", {
            seatId: seat.id,
            winAmount: seat.winAmount,
          });

          // Get exact DOM positions - from pot to seat center (where balance is displayed)
          const fromPosition = await waitForElementPosition("pot-display");
          const toPosition = await waitForElementPosition(`seat-${seat.id}`);

          if (fromPosition && toPosition) {
            console.log(
              "usePokerAnimations: Using exact DOM positions for winner",
              {
                fromPosition,
                toPosition,
              },
            );

            animationContext.triggerChipStream(
              fromPosition,
              toPosition,
              seat.winAmount,
            );
          } else {
            console.warn(
              "usePokerAnimations: Could not get DOM positions for winner, using fallback",
            );
            // Fallback to approximate positions
            const seatIndex = seats.indexOf(seat);
            const screenWidth =
              typeof window !== "undefined" ? window.innerWidth : 1200;

            const fallbackFromPosition = {
              x: screenWidth - 150,
              y: 100,
            };
            const fallbackToPosition = {
              x: seatIndex < 4 ? 100 : screenWidth - 100,
              y: 300 + (seatIndex % 4) * 120,
            };

            animationContext.triggerChipStream(
              fallbackFromPosition,
              fallbackToPosition,
              seat.winAmount,
            );
          }
        }
      });
    }

    // Update previous values
    previousSeatsRef.current = seats;
    previousPotTotalRef.current = potTotal;
    previousGameStateRef.current = gameState || "";
  }, [seats, potTotal, gameState, animationContext]);

  return {
    triggerChipStream: animationContext?.triggerChipStream,
    triggerPotSplash: animationContext?.triggerPotSplash,
    triggerPulsingChip: animationContext?.triggerPulsingChip,
  };
}
