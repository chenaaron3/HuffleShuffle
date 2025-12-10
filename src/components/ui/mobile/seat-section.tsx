import * as React from 'react';

import { SeatCard } from '../seat-section';

import type { SeatWithPlayer } from '~/server/api/routers/table';

interface MobileSeatSectionProps {
    seats: (SeatWithPlayer | null)[];
    highlightedSeatId: string | null;
    smallBlindIdx: number;
    bigBlindIdx: number;
    dealerButtonIdx: number;
    myUserId: string | null;
    gameState?: string;
    canMoveSeat: boolean;
    movingSeatNumber: number | null;
    turnStartTime: Date | null;
    tableId: string;
    dealerCanControlAudio: boolean;
    onMoveSeat: (seatNumber: number) => Promise<void>;
}

/**
 * Mobile seat section that renders all seats horizontally in a single row.
 * Designed for mobile landscape betting view.
 */
export function MobileSeatSection({
    seats,
    highlightedSeatId,
    smallBlindIdx,
    bigBlindIdx,
    dealerButtonIdx,
    myUserId,
    gameState,
    canMoveSeat,
    movingSeatNumber,
    turnStartTime,
    tableId,
    dealerCanControlAudio,
    onMoveSeat,
}: MobileSeatSectionProps) {
    return (
        <div className="flex flex-row gap-2 items-center h-full overflow-visible">
            {seats.map((seat, index) => {
                const seatNumber = index;
                const isSmallBlind = seatNumber === smallBlindIdx;
                const isBigBlind = seatNumber === bigBlindIdx;
                const isDealerButton = seatNumber === dealerButtonIdx;
                const isActive = !!highlightedSeatId && seat?.id === highlightedSeatId;
                const isWinner = gameState === 'SHOWDOWN' && (seat?.winAmount ?? 0) > 0;

                return (
                    <div key={seat?.id || `empty-seat-${seatNumber}`} className="flex-shrink-0 h-full overflow-visible relative">
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
                            side={index < 4 ? 'left' : 'right'} // For styling purposes
                            gameState={gameState}
                            canMoveSeat={canMoveSeat}
                            onMoveSeat={onMoveSeat}
                            isMoving={movingSeatNumber === seatNumber}
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
