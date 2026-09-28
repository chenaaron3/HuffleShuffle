import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Track } from 'livekit-client';
import { CardImage } from '~/components/table/cards/card-img';
import {
    useCommunityCards,
    useDealerId,
    useGameState,
    useIsDealerAtTable,
    useWinningCards,
} from '~/hooks/use-table-selectors';

import { ParticipantTile, useTracks, VideoTrack } from '@livekit/components-react';

import { ActionButtons } from '~/components/table/betting/action-buttons';
import { PotAndBlindsDisplay } from '~/components/table/pot/pot-blinds-display';
import { SidePotDetails } from '~/components/table/pot/side-pot-details';

export function DealerFeed({
    children,
    compact = false,
}: {
    children?: ReactNode;
    compact?: boolean;
}) {
    const communityCards = useCommunityCards();
    const gameStatus = useGameState();
    const winningCards = useWinningCards();
    const dealerUserId = useDealerId();
    const isDealer = useIsDealerAtTable();

    const trackRefs = useTracks([Track.Source.Camera]);
    const dealerRef = dealerUserId
        ? trackRefs.find(
            (t) => t.participant.identity === dealerUserId && t.source === Track.Source.Camera,
        )
        : null;

    return (
        <div className="relative w-full h-full lg:h-auto lg:aspect-video overflow-hidden bg-black lg:border lg:border-white/10 lg:rounded-lg">
            {dealerRef ? (
                <ParticipantTile trackRef={dealerRef}>
                    <VideoTrack trackRef={dealerRef} />
                </ParticipantTile>
            ) : (
                <div className="flex h-full items-center justify-center text-zinc-400">
                    Waiting for dealer camera...
                </div>
            )}

            {communityCards.length > 0 && (
                <div className={compact
                    ? 'absolute top-1.5 left-1.5 z-30 flex items-center gap-0.5'
                    : 'absolute top-2 left-2 z-30 flex items-center gap-1 sm:top-4 sm:left-4'
                }>
                    <AnimatePresence mode="popLayout">
                        {communityCards.map((card: string, index: number) => {
                            const normalizedCard = card.toUpperCase();
                            const isWinningCard = gameStatus === 'SHOWDOWN' &&
                                Array.isArray(winningCards) &&
                                winningCards.some(wc => wc.toUpperCase() === normalizedCard);

                            return (
                                <motion.div
                                    key={`community-card-${card}`}
                                    className="relative"
                                    initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -20, scale: 0.8 }}
                                    transition={{
                                        duration: 0.4,
                                        delay: index * 0.1,
                                        ease: "easeOut"
                                    }}
                                >
                                    <CardImage
                                        code={card}
                                        size={compact ? 40 : 65}
                                        highlighted={isWinningCard}
                                    />
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            <div id="pot-display" className={compact
                ? 'absolute inset-0 z-40 flex w-full transform flex-col items-end gap-1 p-1.5 pointer-events-none'
                : 'absolute inset-0 z-40 flex w-full transform flex-col items-end gap-2 p-4 pointer-events-none'
            }>
                <PotAndBlindsDisplay compact={compact} className="shrink-0" />
                <SidePotDetails className="pointer-events-auto" />
            </div>

            <AnimatePresence mode="wait">
                {isDealer && (
                    <div className={compact
                        ? 'absolute bottom-2 right-2 flex items-end justify-end'
                        : 'absolute bottom-4 right-4 flex items-end justify-end'
                    }>
                        <ActionButtons compact={compact} />
                    </div>
                )}
            </AnimatePresence>

            {children}

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10" />
        </div>
    );
}
