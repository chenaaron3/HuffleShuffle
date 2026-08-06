import { useSession } from 'next-auth/react';
import {
    useBlindSeatNumbers, useCurrentUserSeatId, useGameState, useHighlightedSeatId,
    useIsDealerRole, useIsJoinable, usePaddedSeats, useTableId, useTurnStartTime,
} from '~/hooks/use-table-selectors';

import { SeatCard } from './seat-card';

import type { SeatWithPlayer } from '~/server/api/routers/table';

interface SeatSectionProps {
    side: 'left' | 'right';
}

export function SeatSection({ side }: SeatSectionProps) {
    const { data: session } = useSession();
    const userId = session?.user?.id;

    const allSeats = usePaddedSeats();
    const highlightedSeatId = useHighlightedSeatId();
    const { smallBlindIdx, bigBlindIdx, dealerButtonIdx } = useBlindSeatNumbers();
    const myUserId = userId ?? null;
    const gameState = useGameState();
    const isJoinable = useIsJoinable();
    const currentUserSeatId = useCurrentUserSeatId(userId);
    const canMoveSeat = Boolean(isJoinable && currentUserSeatId);
    const turnStartTime = useTurnStartTime();
    const tableId = useTableId();
    const isDealerRole = useIsDealerRole();
    const dealerCanControlAudio = isDealerRole;

    const seats = side === 'left' ? allSeats.slice(0, 4) : allSeats.slice(4, 8);

    let displaySeats: (SeatWithPlayer | null)[] = [];
    if (side === 'left') {
        displaySeats = [
            seats[3] ?? null,
            seats[2] ?? null,
            seats[1] ?? null,
            seats[0] ?? null,
        ];
    } else {
        displaySeats = [
            seats[0] ?? null,
            seats[1] ?? null,
            seats[2] ?? null,
            seats[3] ?? null,
        ];
    }

    return (
        <div className={`flex flex-col gap-2 relative z-50 ${side === 'left' ? 'pr-2' : 'pl-2'}`}>
            {displaySeats.map((seat, index) => {
                const seatNumber = side === 'left' ? (3 - index) : (index + 4);

                return (
                    <SeatCard
                        key={seat?.id || `empty-${side}-${seatNumber}`}
                        seat={seat}
                        index={index}
                        seatNumber={seatNumber}
                        small={seatNumber === smallBlindIdx}
                        big={seatNumber === bigBlindIdx}
                        button={seatNumber === dealerButtonIdx}
                        active={!!highlightedSeatId && seat?.id === highlightedSeatId}
                        isWinner={gameState === 'SHOWDOWN' && (seat?.winAmount ?? 0) > 0}
                        myUserId={myUserId}
                        side={side}
                        gameState={gameState}
                        canMoveSeat={canMoveSeat}
                        turnStartTime={turnStartTime}
                        tableId={tableId}
                        dealerCanControlAudio={dealerCanControlAudio}
                    />
                );
            })}
        </div>
    );
}
