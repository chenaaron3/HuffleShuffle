import { useEffect, useRef } from "react";
import {
  useCommunityCards,
  useOriginalSeats,
} from "~/hooks/use-table-selectors";

interface UseDealerCardSoundProps {
  isDealer: boolean;
}

export function useDealerCardSound({ isDealer }: UseDealerCardSoundProps) {
  const communityCards = useCommunityCards();
  const originalSeats = useOriginalSeats();

  // Track previous values to detect changes
  const prevCommunityCardCountRef = useRef<number | null>(null);
  const prevTotalPlayerCardsRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  // Initialize audio element
  useEffect(() => {
    if (isDealer) {
      audioRef.current = new Audio("/audio/deal_card.wav");
      audioRef.current.preload = "auto";
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isDealer]);

  useEffect(() => {
    // Only run for dealers
    if (!isDealer) {
      // Reset initialization when not dealer
      isInitializedRef.current = false;
      prevCommunityCardCountRef.current = null;
      prevTotalPlayerCardsRef.current = null;
      return;
    }

    // Calculate current values
    const currentCommunityCardCount = communityCards.length;
    const currentTotalPlayerCards = originalSeats.reduce(
      (sum, seat) => sum + (seat.cards?.length ?? 0),
      0,
    );

    // Initialize on first render (don't play sound)
    if (!isInitializedRef.current) {
      prevCommunityCardCountRef.current = currentCommunityCardCount;
      prevTotalPlayerCardsRef.current = currentTotalPlayerCards;
      isInitializedRef.current = true;
      return;
    }

    // Check if community cards increased
    const communityCardsIncreased =
      prevCommunityCardCountRef.current !== null &&
      currentCommunityCardCount > prevCommunityCardCountRef.current;

    // Check if total player cards increased
    const playerCardsIncreased =
      prevTotalPlayerCardsRef.current !== null &&
      currentTotalPlayerCards > prevTotalPlayerCardsRef.current;

    // Play sound if either increased
    if ((communityCardsIncreased || playerCardsIncreased) && audioRef.current) {
      // Reset audio to beginning and play
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((error) => {
        console.error("Error playing card deal sound:", error);
      });
    }

    // Update previous values
    prevCommunityCardCountRef.current = currentCommunityCardCount;
    prevTotalPlayerCardsRef.current = currentTotalPlayerCards;
  }, [isDealer, communityCards, originalSeats]);
}
