import { Track } from 'livekit-client';
import { CardImage } from '~/components/ui/card-img';

import { ParticipantTile, useTracks, VideoTrack } from '@livekit/components-react';

interface DealerCameraProps {
    communityCards: string[];
    potTotal: number;
}

export function DealerCamera({ communityCards, potTotal }: DealerCameraProps) {
    const tracks = useTracks([Track.Source.Camera]);
    const dealerRef = tracks.find((t) => t.participant.identity === 'dealer-camera');

    if (!dealerRef) {
        return (
            <div className="relative w-full overflow-hidden rounded-lg bg-black aspect-video">
                <div className="flex h-full items-center justify-center text-zinc-400">
                    Waiting for dealer camera...
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full overflow-hidden rounded-lg bg-black aspect-video">
            {/* Main Dealer Video */}
            <ParticipantTile trackRef={dealerRef}>
                <VideoTrack trackRef={dealerRef} />
            </ParticipantTile>

            {/* Community Cards Overlay - Top Left */}
            {communityCards.length > 0 && (
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                    <div className="flex gap-2">
                        {communityCards.map((card: string) => (
                            <div key={card} className="relative">
                                <CardImage code={card} size={60} />
                                <div className="absolute inset-0 rounded-lg shadow-lg ring-2 ring-white/20" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Pot Total Overlay - Top Right */}
            <div className="absolute top-4 right-4 rounded-lg bg-black/70 px-3 py-2 backdrop-blur-sm">
                <div className="text-sm font-semibold text-white">
                    Pot: ${potTotal.toFixed(2)}
                </div>
            </div>

            {/* Subtle gradient overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10 pointer-events-none" />
        </div>
    );
}
