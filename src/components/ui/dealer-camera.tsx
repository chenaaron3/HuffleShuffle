import { Track } from 'livekit-client';
import { CardImage } from '~/components/ui/card-img';

import { ParticipantTile, useTracks, VideoTrack } from '@livekit/components-react';

interface DealerCameraProps {
    communityCards: string[];
    potTotal: number;
    gameStatus?: string;
    activePlayerName?: string;
}

export function DealerCamera({ communityCards, potTotal, gameStatus, activePlayerName }: DealerCameraProps) {
    const tracks = useTracks([Track.Source.Camera]);
    const dealerRef = tracks.find((t) => t.participant.identity === 'dealer-camera');

    return (
        <div className="relative w-full overflow-hidden border border-white/10 rounded-lg bg-black aspect-video">
            {/* Main Dealer Video */}
            {dealerRef ? (
                <ParticipantTile trackRef={dealerRef}>
                    <VideoTrack trackRef={dealerRef} />
                </ParticipantTile>
            ) : (
                <div className="flex h-full items-center justify-center text-zinc-400">
                    Waiting for dealer camera...
                </div>
            )}

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

            {/* Pot Total Overlay - Center Top */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
                <div className="bg-white/95 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg border border-gray-200/50">
                    <div className="text-center">
                        <div className="text-lg font-bold text-gray-900">
                            ${potTotal.toFixed(2)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Game Status Overlay - Top Right */}
            {gameStatus && activePlayerName && (
                <div className="absolute top-4 right-4 rounded-lg bg-sky-500/90 px-4 py-2 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-sky-200" />
                        <span className="text-sm font-semibold text-white">
                            {activePlayerName}'s turn to act
                        </span>
                    </div>
                </div>
            )}

            {/* Subtle gradient overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10 pointer-events-none" />
        </div>
    );
}
