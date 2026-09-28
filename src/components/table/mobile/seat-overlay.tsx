import { motion, useReducedMotion } from 'framer-motion';
import { Maximize2, Minimize2, Pin } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { HandCamera } from '~/components/table/camera/hand-camera';
import { LeaveTableButton } from '~/components/table/leave-table-button';
import { MobileSeatMediaControls } from '~/components/table/mobile/seat-media-controls';
import { SeatCard } from '~/components/table/seat';
import {
    OVERLAY_TILE_HEIGHT_PX,
    OVERLAY_TILE_SIZE_CLASS,
    OVERLAY_TILE_WIDTH_PX,
} from '~/components/table/seat/seat-size-classes';
import { cn } from '~/lib/utils';
import {
    useBlindSeatNumbers,
    useCurrentUserSeatId,
    useGameState,
    useHighlightedSeatId,
    useIsDealerAtTable,
    useOriginalSeats,
    useTableId,
    useTurnStartTime,
} from '~/hooks/use-table-selectors';

import {
    playerGridColumnCount,
    resolveDisplayedSeatId,
    resolveShowdownWinnerSeatId,
    shouldClearManualSeatSelection,
    shouldReleasePin,
} from './seat-overlay-logic';

import type { SeatWithPlayer } from '~/server/api/table/types';

function MobileOverlaySeat({ seat, fill = false }: { seat: SeatWithPlayer; fill?: boolean }) {
    const { data: session } = useSession();
    const userId = session?.user?.id;
    const highlightedSeatId = useHighlightedSeatId();
    const { smallBlindIdx, bigBlindIdx, dealerButtonIdx } = useBlindSeatNumbers();
    const gameState = useGameState();
    const turnStartTime = useTurnStartTime();
    const tableId = useTableId();
    const isDealerAtTable = useIsDealerAtTable();

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
            dealerCanControlAudio={isDealerAtTable}
            overlay
            fill={fill}
        />
    );
}

export function MobileSeatOverlay({ handRoomName }: { handRoomName: string | null }) {
    const { data: session } = useSession();
    const userId = session?.user?.id;
    const originalSeats = useOriginalSeats();
    const gameState = useGameState();
    const highlightedSeatId = useHighlightedSeatId();
    const mySeatId = useCurrentUserSeatId(userId);
    const tableId = useTableId();
    const reduceMotion = useReducedMotion();

    const isDealerAtTable = useIsDealerAtTable();

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
    const winnerSeatId = useMemo(
        () =>
            gameState === 'SHOWDOWN'
                ? resolveShowdownWinnerSeatId(occupiedSeats)
                : null,
        [gameState, occupiedSeats],
    );
    const overlayHighlightedSeatId = highlightedSeatId ?? winnerSeatId;

    const [pickerOpen, setPickerOpen] = useState(false);
    const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
    const [pinned, setPinned] = useState(false);
    const [handCameraExpanded, setHandCameraExpanded] = useState(true);
    const previousHighlightRef = useRef<string | null>(overlayHighlightedSeatId);

    useEffect(() => {
        const { clearSelection, nextPreviousHighlightedSeatId } =
            shouldClearManualSeatSelection({
                pickerOpen,
                pinned,
                previousHighlightedSeatId: previousHighlightRef.current,
                highlightedSeatId: overlayHighlightedSeatId,
            });
        previousHighlightRef.current = nextPreviousHighlightedSeatId;
        if (clearSelection) {
            setSelectedSeatId(null);
        }
    }, [overlayHighlightedSeatId, pickerOpen, pinned]);

    useEffect(() => {
        if (shouldReleasePin({ pinned, selectedSeatId, occupiedSeatIds })) {
            setPinned(false);
            setSelectedSeatId(null);
        }
    }, [occupiedSeatIds, pinned, selectedSeatId]);

    const displayedSeatId = resolveDisplayedSeatId({
        selectedSeatId,
        highlightedSeatId: overlayHighlightedSeatId,
        mySeatId,
        occupiedSeatIds,
    });
    const displayedSeat =
        occupiedSeats.find((seat) => seat.id === displayedSeatId) ?? null;

    const handleSelectSeat = (seatId: string) => {
        setSelectedSeatId(seatId);
        setPickerOpen(false);
    };

    const handleTogglePin = () => {
        if (pinned) {
            setPinned(false);
            setSelectedSeatId(null);
            return;
        }
        if (!displayedSeatId) return;
        setPinned(true);
        setSelectedSeatId(displayedSeatId);
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
                            gridTemplateColumns: `repeat(${playerGridColumnCount(occupiedSeats.length)}, minmax(0, 1fr))`,
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
                    bottom: 'max(0.5rem, env(safe-area-inset-bottom))',
                    left: 'max(0.5rem, env(safe-area-inset-left))',
                }}
            >
                <div className="flex flex-col items-start gap-1">
                    {mySeatId && (
                        <motion.div
                            role="button"
                            tabIndex={0}
                            onClick={() => setHandCameraExpanded((expanded) => !expanded)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    setHandCameraExpanded((expanded) => !expanded);
                                }
                            }}
                            className="relative shrink-0 cursor-pointer overflow-hidden rounded-xl"
                            aria-label={handCameraExpanded ? 'Shrink hand camera' : 'Expand hand camera'}
                            initial={false}
                            animate={{
                                width: handCameraExpanded ? OVERLAY_TILE_WIDTH_PX : OVERLAY_TILE_WIDTH_PX / 2,
                                height: handCameraExpanded ? OVERLAY_TILE_HEIGHT_PX : OVERLAY_TILE_HEIGHT_PX / 2,
                            }}
                            transition={
                                reduceMotion
                                    ? { duration: 0 }
                                    : { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }
                            }
                        >
                            <HandCamera
                                compact
                                size={handCameraExpanded ? 'full' : 'half'}
                                tableId={tableId}
                                roomName={handRoomName}
                            />
                            <span
                                className="pointer-events-none absolute bottom-1 right-1 flex h-[18px] w-[18px] items-center justify-center rounded bg-black/65 text-white"
                                aria-hidden="true"
                            >
                                {handCameraExpanded ? (
                                    <Minimize2 className="h-3 w-3" />
                                ) : (
                                    <Maximize2 className="h-3 w-3" />
                                )}
                            </span>
                        </motion.div>
                    )}

                    <div className="flex items-end gap-1">
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
                            <div className={`flex ${OVERLAY_TILE_SIZE_CLASS} items-center justify-center rounded-xl border border-dashed border-zinc-500/50 bg-zinc-900/30 text-xs text-zinc-400`}>
                                No players
                            </div>
                        )}

                        <div className="flex flex-col items-center justify-end gap-0.5">
                            <LeaveTableButton compact />
                            {displayedSeat && (
                                <>
                                    <MobileSeatMediaControls
                                        seat={displayedSeat}
                                        tableId={tableId}
                                        myUserId={userId}
                                        dealerCanControlAudio={isDealerAtTable}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleTogglePin}
                                        aria-pressed={pinned}
                                        aria-label={pinned ? 'Unpin player video' : 'Pin player video'}
                                        title={pinned ? 'Unpin player video' : 'Pin player video'}
                                        className={cn(
                                            'flex h-6 w-6 items-center justify-center rounded-md transition',
                                            pinned
                                                ? 'bg-white text-black'
                                                : 'bg-white/90 text-black hover:bg-white',
                                        )}
                                    >
                                        <Pin
                                            className="h-3.5 w-3.5"
                                            fill={pinned ? 'currentColor' : 'none'}
                                            aria-hidden="true"
                                        />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
