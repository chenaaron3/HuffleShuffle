import { AnimatePresence, motion } from 'framer-motion';
import { Track } from 'livekit-client';
import { CardSlot } from '~/components/ui/card-slot';
import { RollingNumber } from '~/components/ui/chip-animations';

import { ParticipantTile, TrackToggle, useTracks, VideoTrack } from '@livekit/components-react';

import type { SeatWithPlayer } from "~/server/api/routers/table";

interface SeatSectionProps {
    seats: (SeatWithPlayer | null)[];
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
    // Since seats array is now padded, array index matches seat number
    let displaySeats: (SeatWithPlayer | null)[] = [];

    if (side === 'left') {
        // Left side: seats 0-3 (seat numbers) from bottom to top
        // Display order: seat 3 (top), seat 2, seat 1, seat 0 (bottom)
        displaySeats = [
            seats[3] ?? null, // seat 3 (top)
            seats[2] ?? null, // seat 2
            seats[1] ?? null, // seat 1
            seats[0] ?? null, // seat 0 (bottom)
        ];
    } else {
        // Right side: seats 4-7 (seat numbers) from top to bottom
        // Display order: seat 4, seat 5, seat 6, seat 7
        displaySeats = [
            seats[4] ?? null, // seat 4
            seats[5] ?? null, // seat 5
            seats[6] ?? null, // seat 6
            seats[7] ?? null, // seat 7
        ];
    }

    return (
        <div className={`flex flex-col gap-2 relative z-50 ${side === 'left' ? 'pr-2' : 'pl-2'}`}>
            {displaySeats.map((seat, index) => {
                // Calculate the actual seat number (0-based) based on side and display position
                const seatNumber = side === 'left' ? (3 - index) : (index + 4);

                return (
                    <SeatCard
                        key={seat?.id || `empty-${side}-${index}`}
                        seat={seat}
                        index={index} // Use the display index directly
                        seatNumber={seatNumber} // Pass the actual seat number (0-based)
                        small={seatNumber === smallBlindIdx}
                        big={seatNumber === bigBlindIdx}
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
            <div
                className="relative flex h-[22vh] flex-col rounded-xl"
                style={{
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: 'rgba(113,113,122,0.5)',
                    padding: 12,
                    backgroundColor: 'rgba(24,24,27,0.3)',
                    backdropFilter: 'blur(8px)'
                }}
            >
                {/* Empty Video Feed - Match Occupied Seat Dimensions */}
                <div
                    className="relative h-full aspect-[4/3] overflow-hidden rounded-lg mb-3"
                    style={{ border: '1px solid rgba(113,113,122,0.4)', backgroundColor: 'rgba(39,39,42,0.6)' }}
                >
                    <div className="flex h-full items-center justify-center text-sm text-zinc-500 font-medium">
                        Empty Seat
                    </div>
                </div>

                {/* Empty Player Info and Cards Row */}
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <div
                            className="rounded-full bg-zinc-700/40 text-xs font-medium text-zinc-400 w-fit"
                            style={{ border: '1px solid rgba(82,82,91,0.5)', padding: '4px 12px' }}
                        >
                            Seat {seatNumber}
                        </div>
                    </div>

                    {/* Empty Cards Area */}
                    <div className="flex gap-1">
                        <CardSlot card={null} index={0} size={30} />
                        <CardSlot card={null} index={1} size={30} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            id={`seat-${seat.id}`}
            className={`relative flex h-[22vh] flex-col rounded-xl bg-zinc-900/60 backdrop-blur-sm ${isWinner ? 'shadow-2xl shadow-yellow-500/50' : ''}`}
            style={{
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: isWinner
                    ? 'rgb(251 191 36 / 0.8)'
                    : active
                        ? 'rgb(234 179 8 / 0.6)'
                        : 'rgb(113 113 122 / 0.3)',
                boxShadow: isWinner ? '0 0 20px rgba(251, 191, 36, 0.5), 0 0 40px rgba(251, 191, 36, 0.3)' : undefined,
            }}
        >
            {/* Video Feed - Scaled Down with Aspect Ratio */}
            <div className="group relative h-full aspect-[4/3] overflow-hidden rounded-xl bg-black mb-3 -z-10">
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
            <div className="flex items-center justify-between" style={{ padding: '0 8px 8px' }}>
                {/* Left Side - Total and Win Amount */}
                <div className="flex flex-col gap-1">
                    {/* Win amount centered above total */}
                    {gameState === 'SHOWDOWN' && (seat?.winAmount ?? 0) > 0 && (
                        <div
                            className="w-fit mx-auto translate-y-1/3 rounded-full text-xs font-medium text-center shadow-lg"
                            style={{
                                backgroundColor: '#00a5444d',
                                border: '1px solid #00c75880',
                                padding: '4px 12px',
                                color: '#86efac'
                            }}
                        >
                            <RollingNumber
                                value={seat.winAmount ?? 0}
                                prefix="+$"
                            />
                        </div>
                    )}
                    {/* Total */}
                    <div
                        className="rounded-full z-10 text-xs font-medium shadow-lg"
                        style={{
                            backgroundColor: '#00a5444d',
                            border: '1px solid #00c75880',
                            padding: '4px 12px',
                            color: '#86efac'
                        }}
                    >
                        <RollingNumber
                            value={seat.buyIn}
                            prefix="$"
                            suffix=" total"
                        />
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
                                size={30}
                                gameState={gameState}
                                winningCards={seat.winningCards ?? undefined}
                                seatId={seat.id}
                            />
                        );
                    })}
                </div>
            </div>

            <AnimatePresence>
                {/* Wager Chip - Edge Positioned */}
                {seat.currentBet > 0 && (
                    <motion.div
                        className={`absolute top-1/2 transform -translate-y-1/2 ${side === 'right'
                            ? 'left-0 -translate-x-1/2'
                            : 'right-0 translate-x-1/2'
                            }`}
                        initial={{ scale: 0, opacity: 0, rotate: -180 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        exit={{ scale: 0, opacity: 0, rotate: 180 }}
                        transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 20,
                            duration: 0.6
                        }}
                    >
                        <div className="relative">
                            {/* Chip shadow */}
                            <div className="absolute inset-0 bg-black/30 rounded-full blur-sm scale-95"></div>
                            {/* Main chip */}
                            <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 border-2 border-yellow-300 shadow-lg flex items-center justify-center">
                                {/* Inner ring */}
                                <div className="absolute inset-1 rounded-full border border-yellow-200/50"></div>
                                {/* Chip value */}
                                <RollingNumber
                                    value={seat.currentBet}
                                    className="relative text-sm font-bold text-yellow-900 drop-shadow-sm"
                                    prefix="$"
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                        <div className={`relative px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center justify-center ${isWinner
                            ? 'bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-black shadow-yellow-500/50'
                            : 'bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 text-white'
                            }`}
                            style={{
                                boxShadow: isWinner ? "0 0 15px rgba(251, 191, 36, 0.7), 0 0 30px rgba(251, 191, 36, 0.5)" : undefined,
                            }}>
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
