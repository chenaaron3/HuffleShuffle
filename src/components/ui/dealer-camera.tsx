import { AnimatePresence, motion } from 'framer-motion';
import { Track } from 'livekit-client';
import { CardImage } from '~/components/ui/card-img';

import { ParticipantTile, useTracks, VideoTrack } from '@livekit/components-react';

interface DealerCameraProps {
    communityCards: string[];
    potTotal: number;
    gameStatus?: string;
    activePlayerName?: string;
    winningCards?: string[]; // Cards that make up the winning hand
}

export function DealerCamera({ communityCards, potTotal, gameStatus, activePlayerName, winningCards }: DealerCameraProps) {
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
            <div className="absolute top-4 left-4 flex flex-col gap-2">
                <div className="flex gap-2">
                    <AnimatePresence mode="popLayout">
                        {communityCards.map((card: string, index: number) => {
                            // Check if this community card is part of the winning hand
                            const normalizedCard = card.toUpperCase();
                            const isWinningCard = gameStatus === 'SHOWDOWN' &&
                                Array.isArray(winningCards) &&
                                winningCards.some(wc => wc.toUpperCase() === normalizedCard);

                            return (
                                <motion.div
                                    key={`community-card-${card}`} // More stable key for community cards
                                    className="relative"
                                    initial={{ opacity: 0, y: 30, scale: 0.8 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -30, scale: 0.8 }}
                                    transition={{
                                        duration: 0.5,
                                        delay: index * 0.15,
                                        ease: "easeOut"
                                    }}
                                >
                                    <CardImage
                                        code={card}
                                        size={60}
                                        highlighted={isWinningCard}
                                    />
                                    <div className={`absolute inset-0 rounded-lg shadow-lg ring-2 ${isWinningCard
                                        ? 'ring-yellow-400/75 shadow-yellow-400/50'
                                        : 'ring-white/20'
                                        }`} />
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>

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
