import { AnimatePresence, motion } from 'framer-motion';
import { Track } from 'livekit-client';
import { useEffect, useState } from 'react';
import { isDefaultClause } from 'typescript';
import { CardImage } from '~/components/ui/card-img';
import { RollingNumber } from '~/components/ui/chip-animations';

import { ParticipantTile, useTracks, VideoTrack } from '@livekit/components-react';

import { ActionButtons } from './action-buttons';
import { VerticalRaiseControls } from './vertical-raise-controls';

interface DealerCameraProps {
    communityCards: string[];
    potTotal: number;
    gameStatus?: string;
    activePlayerName?: string;
    winningCards?: string[]; // Cards that make up the winning hand
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
    const tracks = useTracks([Track.Source.Camera]);
    const dealerRef = tracks.find((t) => t.participant.identity === 'dealer-camera');

    // Check if it's the current user's turn
    const isPlayerTurn = gameStatus === 'BETTING' && currentUserSeatId === bettingActorSeatId;

    // State for raise amount
    const [raiseAmount, setRaiseAmount] = useState<number>(bigBlind ?? 20);

    // Update raise amount when big blind or max bet changes
    useEffect(() => {
        if (bigBlind && maxBet !== undefined) {
            setRaiseAmount(Math.max(bigBlind, maxBet + bigBlind));
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
            <div id="pot-display" className="absolute top-4 right-4 transform z-40">
                <div className="bg-zinc-900/95 backdrop-blur-sm rounded-xl px-6 py-3 shadow-2xl border border-zinc-700/50">
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

            {/* Game Status Overlay - Top Right */}
            {/* {gameStatus && activePlayerName && !isPlayerTurn && (
                <div className="absolute top-4 right-4 rounded-xl bg-blue-600/90 px-4 py-3 backdrop-blur-sm shadow-lg border border-blue-500/50">
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-200" />
                        <span className="text-sm font-semibold text-white">
                            {activePlayerName}'s turn to act
                        </span>
                    </div>
                </div>
            )} */}

            {/* Action Buttons Overlay - Center when it's the user's turn or dealer's turn */}
            {((isPlayerTurn || isDealer) && onAction) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="pointer-events-auto">
                        <ActionButtons
                            isDealer={isDealer ?? false}
                            isJoinable={isJoinable ?? false}
                            state={gameStatus}
                            currentUserSeatId={currentUserSeatId}
                            bettingActorSeatId={bettingActorSeatId}
                            isLoading={isLoading ?? false}
                            onAction={onAction ?? (() => { })}
                            onDealCard={onDealCard}
                            onRandomCard={onRandomCard}
                            raiseAmount={raiseAmount}
                            onRaise={isPlayerTurn ? handleRaise : undefined}
                        />
                    </div>
                </div>
            )}

            {/* Leave Table Button - Bottom Left */}
            {isJoinable && onLeaveTable && (
                <div className="absolute bottom-4 left-4">
                    <button
                        onClick={onLeaveTable}
                        disabled={isLeaving}
                        className="bg-red-600/90 hover:bg-red-500/90 disabled:bg-red-600/50 text-white font-semibold px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105 border border-red-500/50 hover:border-red-400/50 backdrop-blur-sm shadow-lg"
                    >
                        {isLeaving ? 'Leaving...' : 'Leave Table'}
                    </button>
                </div>
            )}

            {/* Horizontal Raise Controls - Bottom Right */}
            {isPlayerTurn && onAction && (
                <div className="absolute bottom-4 right-4">
                    <div className="bg-black/20 backdrop-blur-md rounded-xl p-3 shadow-2xl border border-white/10 w-64">
                        <VerticalRaiseControls
                            isLoading={isLoading ?? false}
                            potTotal={potTotal}
                            currentBet={currentBet ?? 0}
                            playerBalance={playerBalance ?? 1000}
                            bigBlind={bigBlind ?? 20}
                            maxBet={maxBet ?? 0}
                            raiseAmount={raiseAmount}
                            onRaiseAmountChange={setRaiseAmount}
                        />
                    </div>
                </div>
            )}

            {/* Subtle gradient overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10 pointer-events-none" />
        </div>
    );
}
