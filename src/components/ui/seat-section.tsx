import { Track } from 'livekit-client';
import { CardImage } from '~/components/ui/card-img';

import { ParticipantTile, useTracks, VideoTrack } from '@livekit/components-react';

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
    // Create array of 4 seats, filling empty slots with null
    const displaySeats = Array.from({ length: 4 }, (_, index) => {
        return seats[index] || null;
    });

    return (
        <div className={`flex flex-col gap-2 ${side === 'left' ? 'pr-2' : 'pl-2'}`}>
            {displaySeats.map((seat, index) => (
                <SeatCard
                    key={seat?.id || `empty-${side}-${index}`}
                    seat={seat}
                    index={index}
                    small={index === smallBlindIdx}
                    big={index === bigBlindIdx}
                    active={!!highlightedSeatId && seat?.id === highlightedSeatId}
                    myUserId={myUserId}
                />
            ))}
        </div>
    );
}

function SeatCard({
    seat,
    index,
    small,
    big,
    active,
    myUserId,
}: {
    seat: SeatWithPlayer | null;
    index: number;
    small: boolean;
    big: boolean;
    active?: boolean;
    myUserId?: string | null;
}) {
    const trackRefs = useTracks([Track.Source.Camera]);
    const videoTrackRef = seat ? trackRefs.find(
        (t) => t.participant.identity === seat.player?.id && t.source === Track.Source.Camera
    ) : null;
    const isSelf = !!myUserId && seat?.player?.id === myUserId;

    // Empty seat placeholder
    if (!seat) {
        return (
            <div className="relative flex w-full flex-col rounded-lg border border-dashed border-zinc-600/50 bg-zinc-900/20 p-2">
                {/* Empty Video Feed - Scaled Down with Aspect Ratio */}
                <div className="relative w-3/4 aspect-[4/3] overflow-hidden rounded-md bg-zinc-800/50 border border-zinc-600/30 mb-2">
                    <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                        Empty Seat
                    </div>
                </div>

                {/* Empty Player Info and Cards Row */}
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <div className="text-sm font-medium text-zinc-500">
                            Seat {index + 1}
                        </div>
                        <div className="text-xs text-zinc-600">
                            Available
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
            className="relative flex w-full flex-col rounded-lg border bg-zinc-900/50 p-2"
            style={{
                borderColor: active ? "rgb(234 179 8 / 0.5)" : "rgb(255 255 255 / 0.1)",
            }}
        >
            {/* Video Feed - Scaled Down with Aspect Ratio */}
            <div className="relative w-3/4 aspect-[4/3] overflow-hidden rounded-md bg-black mb-2">
                {videoTrackRef ? (
                    isSelf ? (
                        <>
                            <VideoTrack trackRef={videoTrackRef} />
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
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
                    <div className="truncate text-sm font-medium text-white">
                        {seat.player?.name ?? "Player"}
                    </div>
                    <div className="flex gap-4 text-xs text-zinc-400">
                        <span>Chips: {seat.buyIn}</span>
                        <span>Wager: {seat.currentBet}</span>
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

            {/* Active Indicator */}
            {active && (
                <div className="absolute -top-1 -right-1 rounded-full bg-yellow-500 px-2 py-1 text-xs font-semibold text-black">
                    Next
                </div>
            )}
        </div>
    );
}
