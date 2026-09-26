import { useSession } from "next-auth/react";
import * as React from "react";
import {
  useBlindSeatNumbers,
  useCurrentUserSeatId,
  useGameState,
  useHighlightedSeatId,
  useIsDealerRole,
  useIsJoinable,
  usePaddedSeats,
  useTableId,
  useTurnStartTime,
} from "~/hooks/use-table-selectors";

import { SeatCard } from "~/components/table/seat";

/**
 * Mobile seat section that renders all seats horizontally in a single row.
 * Designed for mobile landscape betting view.
 */
export function MobileSeatSection() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  // Get data from Zustand store using selectors
  const seats = usePaddedSeats();
  const highlightedSeatId = useHighlightedSeatId();
  const { smallBlindIdx, bigBlindIdx, dealerButtonIdx } = useBlindSeatNumbers();
  const myUserId = userId ?? null;
  const gameState = useGameState();
  const isJoinable = useIsJoinable();
  const currentUserSeatId = useCurrentUserSeatId(userId);
  const canMoveSeat = Boolean(isJoinable && currentUserSeatId);
  const turnStartTime = useTurnStartTime();
  const tableId = useTableId(); // Guaranteed to be string
  const isDealerRole = useIsDealerRole();
  const dealerCanControlAudio = isDealerRole;
  return (
    <div className="flex h-full flex-row items-center gap-2 overflow-visible">
      {seats.map((seat, index) => {
        const seatNumber = index;
        const isSmallBlind = seatNumber === smallBlindIdx;
        const isBigBlind = seatNumber === bigBlindIdx;
        const isDealerButton = seatNumber === dealerButtonIdx;
        const isActive = !!highlightedSeatId && seat?.id === highlightedSeatId;
        const isWinner = gameState === "SHOWDOWN" && (seat?.winAmount ?? 0) > 0;

        return (
          <div
            key={seat?.id || `empty-seat-${seatNumber}`}
            className="relative h-full flex-shrink-0 overflow-visible"
          >
            <SeatCard
              seat={seat}
              index={0} // Always 0 since we're rendering one seat per card
              seatNumber={seatNumber}
              small={isSmallBlind}
              big={isBigBlind}
              button={isDealerButton}
              active={isActive}
              isWinner={isWinner}
              myUserId={myUserId}
              side={index < 4 ? "left" : "right"} // For styling purposes
              gameState={gameState}
              canMoveSeat={canMoveSeat}
              turnStartTime={turnStartTime}
              tableId={tableId}
              dealerCanControlAudio={dealerCanControlAudio}
              fullHeight={true}
            />
          </div>
        );
      })}
    </div>
  );
}
