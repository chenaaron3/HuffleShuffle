import { Track } from 'livekit-client';
import { CardImage } from '~/components/ui/card-img';

import { ParticipantTile, TrackToggle, useTracks, VideoTrack } from '@livekit/components-react';

import type { SeatWithPlayer } from "~/server/api/routers/table";

interface SeatSectionProps {
    seats: SeatWithPlayer[];
    highlightedSeatId: string | null;
    smallBlindIdx: number;
    bigBlindIdx: number;
    myUserId?: string | null;
    side: 'left' | 'right';
}

export function SeatSection({
    seats,
    highlightedSeatId,
    smallBlindIdx,
    bigBlindIdx,
    myUserId,
    side
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
        <div className={`flex flex-col gap-2 ${side === 'left' ? 'pr-2' : 'pl-2'}`}>
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
                        myUserId={myUserId}
                        side={side}
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
    myUserId,
    side,
}: {
    seat: SeatWithPlayer | null;
    index: number;
    seatNumber: number;
    small: boolean;
    big: boolean;
    active?: boolean;
    myUserId?: string | null;
    side: 'left' | 'right';
}) {
    const trackRefs = useTracks([Track.Source.Camera]);
    const videoTrackRef = seat ? trackRefs.find(
        (t) => t.participant.identity === seat.player?.id && t.source === Track.Source.Camera
    ) : null;
    const isSelf = !!myUserId && seat?.player?.id === myUserId;

    // Empty seat placeholder
    if (!seat) {
        return (
            <div className="relative flex h-[22vh] flex-col rounded-lg border border-dashed border-zinc-600/50 bg-zinc-900/20 p-2">
                {/* Empty Video Feed - Match Occupied Seat Dimensions */}
                <div className="relative h-full aspect-[4/3] overflow-hidden rounded-md bg-zinc-800/50 border border-zinc-600/30 mb-2">
                    <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                        Empty Seat
                    </div>
                </div>

                {/* Empty Player Info and Cards Row */}
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <div className="rounded-full bg-zinc-600/20 px-2 py-1 text-xs font-medium text-zinc-500 border border-zinc-500/30 w-fit">
                            Seat {seatNumber}
                        </div>
                    </div>

                    {/* Empty Cards Area */}
                    <div className="flex gap-1">
                        <div className="h-8 w-6 rounded border border-zinc-600/30 bg-zinc-800/30"></div>
                        <div className="h-8 w-6 rounded border border-zinc-600/30 bg-zinc-800/30"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="relative flex h-[22vh] flex-col rounded-lg border bg-zinc-900/50 p-2"
            style={{
                borderColor: active ? "rgb(234 179 8 / 0.5)" : "rgb(255 255 255 / 0.1)",
            }}
        >
            {/* Video Feed - Scaled Down with Aspect Ratio */}
            <div className="group relative h-full aspect-[4/3] overflow-hidden rounded-md bg-black mb-2">
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
                    <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                        No Video
                    </div>
                )}

                {/* Big/Small Blind Overlay */}
                {small && (
                    <div className="absolute top-2 left-2 rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white">
                        S
                    </div>
                )}
                {big && (
                    <div className="absolute top-2 left-2 rounded bg-red-500 px-2 py-1 text-xs font-semibold text-white">
                        B
                    </div>
                )}
            </div>

            {/* Player Info and Cards Row */}
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex gap-2">
                        <div className="rounded-full bg-green-600/20 px-2 py-1 text-xs font-medium text-green-400 border border-green-500/30">
                            ${seat.buyIn} total
                        </div>
                    </div>
                </div>

                {/* Cards - Right Side */}
                {Array.isArray(seat.cards) && seat.cards.length > 0 && (
                    <div className="flex gap-1 shrink-0">
                        {seat.cards.map((c: string) => (
                            <CardImage key={c} code={c} size={28} />
                        ))}
                    </div>
                )}
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

            {/* Player Name - Top Right */}
            <div className="absolute top-2 right-2 rounded-lg bg-black/70 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
                {seat.player?.name ?? "Player"}
            </div>
        </div>
    );
}
