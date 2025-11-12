import { AnimatePresence, motion } from 'framer-motion';
import { Track } from 'livekit-client';
import { useEffect, useState } from 'react';
import { isDefaultClause } from 'typescript';
import { CardImage } from '~/components/ui/card-img';
import { RollingNumber } from '~/components/ui/chip-animations';

import { ParticipantTile, useTracks, VideoTrack } from '@livekit/components-react';

import { ActionButtons } from './action-buttons';
import { TurnIndicator } from './turn-indicator';
import { VerticalRaiseControls } from './vertical-raise-controls';

interface DealerCameraProps {
    communityCards: string[];
    potTotal: number;
    gameStatus?: string;
    activePlayerName?: string;
    winningCards?: string[]; // Cards that make up the winning hand
    dealerUserId?: string;
    // Action button props
    isDealer?: boolean;
    isJoinable?: boolean;
    currentUserSeatId?: string | null;
    bettingActorSeatId?: string | null;
    isLoading?: boolean;
    onAction?: (action: any, params?: any) => void;
    onDealCard?: (rank: string, suit: string) => void;
    onRandomCard?: () => void;
    currentBet?: number;
    playerBalance?: number;
    bigBlind?: number;
    maxBet?: number;
    // Leave table props
    onLeaveTable?: () => void;
    isLeaving?: boolean;
}

export function DealerCamera({
    communityCards,
    potTotal,
    gameStatus,
    activePlayerName,
    winningCards,
    dealerUserId,
    isDealer,
    isJoinable,
    currentUserSeatId,
    bettingActorSeatId,
    isLoading,
    onAction,
    onDealCard,
    onRandomCard,
    currentBet,
    playerBalance,
    bigBlind,
    maxBet,
    onLeaveTable,
    isLeaving
}: DealerCameraProps) {
    const trackRefs = useTracks([Track.Source.Camera]);
    const dealerRef = dealerUserId
        ? trackRefs.find(
            (t) => t.participant.identity === dealerUserId && t.source === Track.Source.Camera,
        )
        : null;

    // Check if it's the current user's turn
    const isPlayerTurn = gameStatus === 'BETTING' && currentUserSeatId === bettingActorSeatId;
    const isDealerTurn = ['DEAL_HOLE_CARDS', 'DEAL_FLOP', 'DEAL_TURN', 'DEAL_RIVER'].includes(gameStatus ?? '');
    // State for raise amount
    const [raiseAmount, setRaiseAmount] = useState<number>(bigBlind ?? 10);

    // Update raise amount when big blind or max bet changes
    useEffect(() => {
        if (bigBlind && maxBet !== undefined) {
            setRaiseAmount(maxBet + bigBlind);
        }
    }, [bigBlind, maxBet]);

    // Handle raise action
    const handleRaise = () => {
        onAction?.('RAISE', { amount: raiseAmount });
    };

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
                                        size={75}
                                        highlighted={isWinningCard}
                                    />
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>

            {/* Pot Total Overlay - Center Top */}
            <div id="pot-display" className="absolute top-4 right-4 transform z-40">
                <div
                    className="backdrop-blur-sm rounded-xl shadow-2xl bg-zinc-900/95 border border-zinc-500/50 px-6 py-3"
                >
                    <div className="text-center">
                        <RollingNumber
                            value={potTotal}
                            className="text-xl font-bold text-zinc-100"
                            prefix="$"
                        />
                        <div className="text-xs text-zinc-400 font-medium">
                            Pot Total
                        </div>
                    </div>
                </div>
            </div>

            {/* Turn Indicator - Bottom Center */}
            <TurnIndicator
                gameStatus={gameStatus}
                isJoinable={isJoinable}
                isDealer={isDealer ?? false}
                isPlayerTurn={isPlayerTurn}
                isDealerTurn={isDealerTurn}
                activePlayerName={activePlayerName}
            />

            {/* Action Buttons Overlay - Center when it's the user's turn or dealer's turn */}
            <AnimatePresence mode="wait">
                {((isPlayerTurn || isDealer) && onAction) && (
                    <div
                        className={`absolute flex ${isDealer
                            ? 'bottom-4 right-4 justify-end items-end'
                            : 'inset-0 items-center justify-center'
                            }`}
                    >
                        <ActionButtons
                            isDealer={isDealer ?? false}
                            isJoinable={isJoinable ?? false}
                            state={gameStatus}
                            isLoading={isLoading ?? false}
                            onAction={onAction ?? (() => { })}
                            onDealCard={onDealCard}
                            onRandomCard={onRandomCard}
                            raiseAmount={raiseAmount}
                            onRaise={isPlayerTurn ? handleRaise : undefined}
                            maxBet={maxBet}
                        />
                    </div>
                )}
            </AnimatePresence>

            {/* Leave Table Button - Bottom Left */}
            {isJoinable && onLeaveTable && (
                <div className="absolute bottom-4 left-4">
                    <button
                        onClick={onLeaveTable}
                        disabled={isLeaving}
                        className="transition-all duration-200 hover:scale-105 shadow-lg bg-red-600/90 text-white font-semibold px-4 py-2 rounded-lg border border-red-500/50 backdrop-blur"
                    >
                        {isLeaving ? 'Leaving...' : 'Leave Table'}
                    </button>
                </div>
            )}

            {/* Horizontal Raise Controls - Bottom Right */}
            <AnimatePresence>
                {isPlayerTurn && onAction && (
                    <div className="absolute right-4 bottom-3">
                        <VerticalRaiseControls
                            isLoading={isLoading ?? false}
                            potTotal={potTotal}
                            playerBalance={playerBalance ?? 1000}
                            currentBet={currentBet ?? 0}
                            bigBlind={bigBlind ?? 20}
                            minRaise={(maxBet ?? 0) + (bigBlind ?? 0)}
                            raiseAmount={raiseAmount}
                            onRaiseAmountChange={setRaiseAmount}
                        />
                    </div>
                )}
            </AnimatePresence>

            {/* Subtle gradient overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10 pointer-events-none" />
        </div>
    );
}
