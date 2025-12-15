import { AnimatePresence, motion } from 'framer-motion';
import { Track } from 'livekit-client';
import { useSession } from 'next-auth/react';
import { CardImage } from '~/components/ui/card-img';
import {
    useActivePlayerName, useBettingActorSeatId, useBlinds, useCommunityCards, useCurrentUserSeatId,
    useDealerId, useGameState, useIsJoinable, useTableId, useTotalPot, useWinningCards
} from '~/hooks/use-table-selectors';

import { ParticipantTile, useTracks, VideoTrack } from '@livekit/components-react';

import { ActionButtons } from './action-buttons';
import { LeaveTableButton } from './leave-table-button';
import { PotAndBlindsDisplay } from './pot-blinds-display';
import { TurnIndicator } from './turn-indicator';
import { VerticalRaiseControls } from './vertical-raise-controls';

interface DealerCameraProps {
    // Hide player betting controls (e.g., for mobile where they're in betting tab)
    hidePlayerBettingControls?: boolean;
}

export function DealerCamera({
    hidePlayerBettingControls = false,
}: DealerCameraProps) {
    const { data: session } = useSession();
    const userId = session?.user?.id;
    const isDealerRole = session?.user?.role === 'dealer';

    // Get tableId from Zustand store
    const tableId = useTableId();
    if (!tableId) {
        return null; // Can't render without tableId
    }

    // Derive loading states
    const isLoading = false; // Loading is now handled within components

    // Get data from Zustand store using selectors
    const communityCards = useCommunityCards();
    const potTotal = useTotalPot();
    const gameStatus = useGameState();
    const activePlayerName = useActivePlayerName();
    const winningCards = useWinningCards();
    const dealerUserId = useDealerId();
    const blinds = useBlinds();
    const isJoinable = useIsJoinable();
    const currentUserSeatId = useCurrentUserSeatId(userId);
    const bettingActorSeatId = useBettingActorSeatId();
    const isDealer = isDealerRole;

    const trackRefs = useTracks([Track.Source.Camera]);
    const dealerRef = dealerUserId
        ? trackRefs.find(
            (t) => t.participant.identity === dealerUserId && t.source === Track.Source.Camera,
        )
        : null;

    // Check if it's the current user's turn
    const isPlayerTurn = gameStatus === 'BETTING' && currentUserSeatId === bettingActorSeatId;
    const isDealerTurn = ['DEAL_HOLE_CARDS', 'DEAL_FLOP', 'DEAL_TURN', 'DEAL_RIVER'].includes(gameStatus ?? '');

    return (
        <div className="relative w-full h-full lg:h-auto lg:aspect-video overflow-hidden border border-white/10 rounded-lg bg-black">
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
                <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-30 flex items-center gap-1">
                    <AnimatePresence mode="popLayout">
                        {communityCards.map((card: string, index: number) => {
                            // Check if this community card is part of the winning hand
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
                                        size={65}
                                        highlighted={isWinningCard}
                                    />
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            {/* Pot Total & Blinds Overlay - Center Top */}
            <div id="pot-display" className="absolute top-4 right-4 transform z-40">
                <PotAndBlindsDisplay
                    potTotal={potTotal}
                    blinds={blinds}
                />
            </div>

            {/* Turn Indicator - Bottom Left */}
            <div className="absolute bottom-4 left-4">
                <TurnIndicator
                    gameStatus={gameStatus}
                    isJoinable={isJoinable}
                    isDealer={isDealer ?? false}
                    isPlayerTurn={isPlayerTurn}
                    isDealerTurn={isDealerTurn}
                    activePlayerName={activePlayerName}
                />
            </div>

            {/* Action Buttons Overlay - Dealer only */}
            <AnimatePresence mode="wait">
                {isDealer && (
                    <div className="absolute flex bottom-4 right-4 justify-end items-end">
                        <ActionButtons
                            isJoinable={isJoinable ?? false}
                            state={gameStatus}
                            isLoading={isLoading ?? false}
                        />
                    </div>
                )}
            </AnimatePresence>

            {/* Leave Table Button - Bottom Left */}
            <LeaveTableButton />

            {/* Horizontal Raise Controls - Bottom Right */}
            <AnimatePresence mode="wait">
                {isPlayerTurn && (
                    <motion.div
                        key="controls"
                        layoutId="raise-controls"
                        className="absolute right-4 bottom-3"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                    >
                        <VerticalRaiseControls />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Subtle gradient overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10 pointer-events-none" />
        </div>
    );
}
