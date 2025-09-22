import { AnimatePresence, motion } from 'framer-motion';
import { Track } from 'livekit-client';
import { CardImage } from '~/components/ui/card-img';
import { CardSlot } from '~/components/ui/card-slot';

import { ParticipantTile, TrackToggle, useTracks, VideoTrack } from '@livekit/components-react';

import type { SeatWithPlayer } from "~/server/api/routers/table";

interface SeatSectionProps {
    seats: SeatWithPlayer[];
    highlightedSeatId: string | null;
    smallBlindIdx: number;
    bigBlindIdx: number;
    myUserId?: string | null;
    side: 'left' | 'right';
    gameState?: string;
}

export function SeatSection({
    seats,
    highlightedSeatId,
    smallBlindIdx,
    bigBlindIdx,
    myUserId,
    side,
    gameState
}: SeatSectionProps) {
    // Create array of 4 seats with proper numbering
    let displaySeats: (any | null)[] = [];

    if (side === 'left') {
        // Left side: seats 1-4 from bottom to top
        // seats[0] = seat 1 (bottom), seats[1] = seat 2, seats[2] = seat 3, seats[3] = seat 4 (top)
        displaySeats = Array.from({ length: 4 }, (_, index) => {
            return seats[3 - index] || null; // Reverse the order: 3,2,1,0
        });
    } else {
        // Right side: seats 5-8 from top to bottom
        // seats[4] = seat 5, seats[5] = seat 6, seats[6] = seat 7, seats[7] = seat 8
        displaySeats = Array.from({ length: 4 }, (_, index) => {
            return seats[index + 4] || null;
        });
    }

    return (
        <div className={`flex flex-col gap-2 relative z-50 ${side === 'left' ? 'pr-2' : 'pl-2'}`}>
            {displaySeats.map((seat, index) => {
                // Calculate the actual seat number for display (1-based)
                const seatNumber = side === 'left' ? (4 - index) : (index + 5);
                // Calculate the actual seat index for blind checking
                const actualSeatIndex = side === 'left' ? (3 - index) : (index + 4);

                return (
                    <SeatCard
                        key={seat?.id || `empty-${side}-${index}`}
                        seat={seat}
                        index={index} // Use the display index directly
                        seatNumber={seatNumber} // Pass the actual seat number
                        small={actualSeatIndex === smallBlindIdx}
                        big={actualSeatIndex === bigBlindIdx}
                        active={!!highlightedSeatId && seat?.id === highlightedSeatId}
                        isWinner={gameState === 'SHOWDOWN' && (seat?.winAmount ?? 0) > 0}
                        myUserId={myUserId}
                        side={side}
                        gameState={gameState}
                    />
                );
            })}
        </div>
    );
}

function SeatCard({
    seat,
    index,
    seatNumber,
    small,
    big,
    active,
    isWinner,
    myUserId,
    side,
    gameState,
}: {
    seat: SeatWithPlayer | null;
    index: number;
    seatNumber: number;
    small: boolean;
    big: boolean;
    active?: boolean;
    isWinner?: boolean;
    myUserId?: string | null;
    side: 'left' | 'right';
    gameState?: string;
}) {
    const trackRefs = useTracks([Track.Source.Camera]);
    const videoTrackRef = seat ? trackRefs.find(
        (t) => t.participant.identity === seat.player?.id && t.source === Track.Source.Camera
    ) : null;
    const isSelf = !!myUserId && seat?.player?.id === myUserId;

    // Empty seat placeholder
    if (!seat) {
        return (
            <div className="relative flex h-[22vh] flex-col rounded-xl border border-dashed border-zinc-700/50 bg-zinc-900/30 p-3 backdrop-blur-sm">
                {/* Empty Video Feed - Match Occupied Seat Dimensions */}
                <div className="relative h-full aspect-[4/3] overflow-hidden rounded-lg bg-zinc-800/60 border border-zinc-700/40 mb-3">
                    <div className="flex h-full items-center justify-center text-sm text-zinc-500 font-medium">
                        Empty Seat
                    </div>
                </div>

                {/* Empty Player Info and Cards Row */}
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <div className="rounded-full bg-zinc-700/40 px-3 py-1 text-xs font-medium text-zinc-400 border border-zinc-600/50 w-fit">
                            Seat {seatNumber}
                        </div>
                    </div>

                    {/* Empty Cards Area */}
                    <div className="flex gap-1">
                        <CardSlot card={null} index={0} size={28} />
                        <CardSlot card={null} index={1} size={28} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="relative flex h-[22vh] flex-col rounded-xl border bg-zinc-900/60 p-3 backdrop-blur-sm"
            style={{
                borderColor: active ? "rgb(234 179 8 / 0.6)" : "rgb(113 113 122 / 0.3)",
            }}
        >
            {/* Video Feed - Scaled Down with Aspect Ratio */}
            <div className="group relative h-full aspect-[4/3] overflow-hidden rounded-lg bg-black mb-3">
                {videoTrackRef ? (
                    isSelf ? (
                        <>
                            <VideoTrack trackRef={videoTrackRef} />
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                            <div className="pointer-events-auto absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <TrackToggle
                                    source={Track.Source.Camera}
                                    showIcon
                                    className="rounded-md bg-white/90 text-xs font-medium text-black hover:bg-white"
                                    aria-label="Toggle camera"
                                    title="Toggle camera"
                                />
                                <TrackToggle
                                    source={Track.Source.Microphone}
                                    showIcon
                                    className="rounded-md bg-white/90 text-xs font-medium text-black hover:bg-white"
                                    aria-label="Toggle microphone"
                                    title="Toggle microphone"
                                />
                            </div>
                        </>
                    ) : (
                        <ParticipantTile trackRef={videoTrackRef}>
                            <VideoTrack trackRef={videoTrackRef} />
                        </ParticipantTile>
                    )
                ) : (
                    <div className="flex h-full items-center justify-center text-sm text-zinc-500 font-medium">
                        No Video
                    </div>
                )}

                {/* Big/Small Blind Overlay */}
                {small && (
                    <div className="absolute top-2 left-2 rounded-lg bg-blue-600 px-2 py-1 text-xs font-semibold text-white shadow-lg border border-blue-500/50">
                        S
                    </div>
                )}
                {big && (
                    <div className="absolute top-2 left-2 rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white shadow-lg border border-red-500/50">
                        B
                    </div>
                )}
            </div>

            {/* Player Info and Cards Row */}
            <div className="flex items-end justify-between">
                {/* Left Side - Total and Win Amount */}
                <div className="flex flex-col gap-1">
                    {/* Win amount centered above total */}
                    {gameState === 'SHOWDOWN' && (seat?.winAmount ?? 0) > 0 && (
                        <div className="w-fit mx-auto translate-y-1/3 rounded-full bg-green-600/30 px-3 py-1 text-xs font-medium text-green-300 border border-green-500/50 text-center animate-pulse shadow-lg">
                            +${seat.winAmount}
                        </div>
                    )}
                    {/* Total */}
                    <div className="rounded-full z-10 bg-green-600/30 px-3 py-1 text-xs font-medium text-green-300 border border-green-500/50 shadow-lg">
                        ${seat.buyIn} total
                    </div>
                </div>

                {/* Right Side - Cards */}
                <div className="flex gap-1">
                    {/* Always show 2 card slots - either placeholders or actual cards */}
                    {Array.from({ length: 2 }, (_, index) => {
                        const card = Array.isArray(seat.cards) ? seat.cards[index] : null;

                        return (
                            <CardSlot
                                key={`seat-${seat.id}-card-slot-${index}`}
                                card={card}
                                index={index}
                                size={28}
                                gameState={gameState}
                                winningCards={seat.winningCards ?? undefined}
                                seatId={seat.id}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Wager Chip - Edge Positioned */}
            {seat.currentBet > 0 && (
                <div className={`absolute top-1/2 transform -translate-y-1/2 ${side === 'right'
                    ? 'left-0 -translate-x-1/2'
                    : 'right-0 translate-x-1/2'
                    }`}>
                    <div className="relative">
                        {/* Chip shadow */}
                        <div className="absolute inset-0 bg-black/30 rounded-full blur-sm scale-95"></div>
                        {/* Main chip */}
                        <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 border-2 border-yellow-300 shadow-lg flex items-center justify-center">
                            {/* Inner ring */}
                            <div className="absolute inset-1 rounded-full border border-yellow-200/50"></div>
                            {/* Chip value */}
                            <span className="relative text-sm font-bold text-yellow-900 drop-shadow-sm">
                                ${seat.currentBet}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Hand Type - Edge Positioned (same side as bet chip during showdown) */}
            {gameState === 'SHOWDOWN' && seat.handType && (
                <div className={`absolute top-1/2 transform -translate-y-1/2 ${side === 'right'
                    ? 'left-0 -translate-x-1/2'
                    : 'right-0 translate-x-1/2'
                    }`}>
                    <div className="relative">
                        {/* Banner shadow */}
                        <div className="absolute inset-0 bg-black/30 rounded-full blur-sm scale-95"></div>
                        {/* Main banner */}
                        <div className={`relative px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center justify-center  ${isWinner
                            ? 'bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-black'
                            : 'bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 text-white'
                            }`}>
                            {seat.handType}
                        </div>
                    </div>
                </div>
            )}

            {/* Player Name - Top Right */}
            <div className="absolute top-2 right-2 rounded-lg bg-black/80 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm border border-white/10">
                {seat.player?.name ?? "Player"}
            </div>
        </div>
    );
}
