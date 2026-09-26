import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { HandCamera } from '~/components/table/camera/hand-camera';
import { LeaveTableButton } from '~/components/table/leave-table-button';
import { SeatCard } from '~/components/table/seat';
import {
    useBlindSeatNumbers,
    useCurrentUserSeatId,
    useGameState,
    useHighlightedSeatId,
    useIsDealerRole,
    useOriginalSeats,
    useTableId,
    useTurnStartTime,
} from '~/hooks/use-table-selectors';

import {
    resolveDisplayedSeatId,
    shouldClearManualSeatSelection,
} from './seat-overlay-logic';

import type { SeatWithPlayer } from '~/server/api/table/types';

function gridColumnCount(seatCount: number) {
    if (seatCount <= 1) return 1;
    if (seatCount <= 4) return 2;
    if (seatCount <= 6) return 3;
    return 4;
}

function MobileOverlaySeat({ seat, fill = false }: { seat: SeatWithPlayer; fill?: boolean }) {
    const { data: session } = useSession();
    const userId = session?.user?.id;
    const highlightedSeatId = useHighlightedSeatId();
    const { smallBlindIdx, bigBlindIdx, dealerButtonIdx } = useBlindSeatNumbers();
    const gameState = useGameState();
    const turnStartTime = useTurnStartTime();
    const tableId = useTableId();
    const isDealerRole = useIsDealerRole();

    return (
        <SeatCard
            seat={seat}
            index={0}
            seatNumber={seat.seatNumber}
            small={seat.seatNumber === smallBlindIdx}
            big={seat.seatNumber === bigBlindIdx}
            button={seat.seatNumber === dealerButtonIdx}
            active={!!highlightedSeatId && seat.id === highlightedSeatId}
            isWinner={gameState === 'SHOWDOWN' && (seat.winAmount ?? 0) > 0}
            myUserId={userId ?? null}
            side="left"
            gameState={gameState}
            canMoveSeat={false}
            turnStartTime={turnStartTime}
            tableId={tableId}
            dealerCanControlAudio={isDealerRole}
            overlay
            fill={fill}
        />
    );
}

export function MobileSeatOverlay({ handRoomName }: { handRoomName: string | null }) {
    const { data: session } = useSession();
    const userId = session?.user?.id;
    const originalSeats = useOriginalSeats();
    const highlightedSeatId = useHighlightedSeatId();
    const mySeatId = useCurrentUserSeatId(userId);
    const tableId = useTableId();

    const occupiedSeats = useMemo(
        () => originalSeats
            .filter((seat) => !!seat.player)
            .sort((a, b) => a.seatNumber - b.seatNumber),
        [originalSeats],
    );
    const occupiedSeatIds = useMemo(
        () => occupiedSeats.map((seat) => seat.id),
        [occupiedSeats],
    );

    const [pickerOpen, setPickerOpen] = useState(false);
    const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
    const previousHighlightRef = useRef<string | null>(highlightedSeatId);

    useEffect(() => {
        const { clearSelection, nextPreviousHighlightedSeatId } =
            shouldClearManualSeatSelection({
                pickerOpen,
                previousHighlightedSeatId: previousHighlightRef.current,
                highlightedSeatId,
            });
        previousHighlightRef.current = nextPreviousHighlightedSeatId;
        if (clearSelection) {
            setSelectedSeatId(null);
        }
    }, [highlightedSeatId, pickerOpen]);

    const displayedSeatId = resolveDisplayedSeatId({
        selectedSeatId,
        highlightedSeatId,
        mySeatId,
        occupiedSeatIds,
    });
    const displayedSeat =
        occupiedSeats.find((seat) => seat.id === displayedSeatId) ?? null;

    const handleSelectSeat = (seatId: string) => {
        setSelectedSeatId(seatId);
        setPickerOpen(false);
    };

    return (
        <>
            {pickerOpen && (
                <div
                    className="absolute inset-0 z-[80] bg-black/80 p-3"
                    onClick={() => setPickerOpen(false)}
                    role="presentation"
                >
                    <div
                        className="grid h-full w-full gap-2"
                        style={{
                            gridTemplateColumns: `repeat(${gridColumnCount(occupiedSeats.length)}, minmax(0, 1fr))`,
                            gridAutoRows: '1fr',
                        }}
                    >
                        {occupiedSeats.map((seat) => (
                            <div
                                key={seat.id}
                                role="button"
                                tabIndex={0}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    handleSelectSeat(seat.id);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        handleSelectSeat(seat.id);
                                    }
                                }}
                                className={`h-full min-h-0 min-w-0 rounded-xl text-left ${
                                    seat.id === displayedSeatId
                                        ? 'ring-2 ring-white'
                                        : ''
                                }`}
                                aria-label={`View ${seat.player?.displayName ?? 'player'}`}
                            >
                                <MobileOverlaySeat seat={seat} fill />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div
                className="absolute z-50"
                style={{
                    bottom: 'max(0.75rem, env(safe-area-inset-bottom))',
                    left: 'max(0.75rem, env(safe-area-inset-left))',
                }}
            >
                <div className="absolute -top-9 left-0 z-50">
                    <LeaveTableButton compact />
                </div>

                {displayedSeat ? (
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setPickerOpen(true)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                setPickerOpen(true);
                            }
                        }}
                        className="rounded-xl text-left"
                        aria-label="Browse players"
                    >
                        <MobileOverlaySeat seat={displayedSeat} />
                    </div>
                ) : (
                    <div className="flex h-32 w-52 items-center justify-center rounded-xl border border-dashed border-zinc-500/50 bg-zinc-900/30 text-sm text-zinc-400">
                        No players
                    </div>
                )}
            </div>

            {mySeatId && (
                <div className="absolute bottom-3 left-1/2 z-[60] -translate-x-1/2">
                    <HandCamera compact tableId={tableId} roomName={handRoomName} />
                </div>
            )}
        </>
    );
}
