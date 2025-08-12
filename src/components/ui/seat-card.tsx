import { Track } from 'livekit-client';
import { CardImage } from '~/components/ui/card-img';

import { ParticipantTile, TrackToggle, useTracks, VideoTrack } from '@livekit/components-react';

import type { SeatWithPlayer } from "~/server/api/routers/table";

export function SeatCard({
    seat,
    index,
    small,
    big,
    active,
    myUserId,
}: {
    seat: SeatWithPlayer;
    index: number;
    small: boolean;
    big: boolean;
    active?: boolean;
    myUserId?: string | null;
}) {
    const trackRefs = useTracks([Track.Source.Camera]);
    const videoTrackRef =
        trackRefs.find((t) => t.participant.identity === seat.player?.id && t.source === Track.Source.Camera);
    const isSelf = !!myUserId && seat.player?.id === myUserId;

    return (
        <div
            className="flex items-start justify-between gap-3 rounded-lg border bg-zinc-900/50 p-3"
            style={{
                borderColor: active ? "rgb(234 179 8 / 0.5)" : "rgb(255 255 255 / 0.1)",
            }}
        >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                            {seat.player?.name ?? "Player"}
                        </div>
                        <div className="text-xs text-zinc-400">Total Chips: {seat.buyIn} chips</div>
                        <div className="text-xs text-zinc-400">Current Bet: {seat.currentBet} chips</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {active && (
                            <span className="rounded bg-yellow-500/90 px-2 py-1 text-xs font-semibold text-black">
                                Next
                            </span>
                        )}
                        {small && (
                            <span className="rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white">S</span>
                        )}
                        {big && (
                            <span className="rounded bg-red-500 px-2 py-1 text-xs font-semibold text-white">B</span>
                        )}
                    </div>
                </div>

                {videoTrackRef && (
                    <div className="relative w-full max-w-sm overflow-hidden rounded-md bg-black aspect-video">
                        {isSelf ? (
                            <>
                                <VideoTrack trackRef={videoTrackRef} />
                                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                                <div className="pointer-events-auto absolute bottom-0 right-0 flex">
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
                        )}
                    </div>
                )}

                {Array.isArray(seat.cards) && seat.cards.length > 0 && (
                    <div className="mt-1 flex gap-3">
                        {seat.cards.map((c: string) => (
                            <CardImage key={c} code={c} size={110} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}


