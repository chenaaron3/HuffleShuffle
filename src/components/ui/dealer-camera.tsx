import { AnimatePresence, motion } from 'framer-motion';
import { Track } from 'livekit-client';
import { useEffect, useState } from 'react';
import { isDefaultClause } from 'typescript';
import { CardImage } from '~/components/ui/card-img';
import { RollingNumber } from '~/components/ui/chip-animations';
import { cn } from '~/lib/utils';

import { ParticipantTile, useTracks, VideoTrack } from '@livekit/components-react';

import { ActionButtons } from './action-buttons';
import { PotAndBlindsDisplay } from './pot-blinds-display';
import { Spinner } from './spinner';
import { TurnIndicator } from './turn-indicator';
import { VerticalRaiseControls } from './vertical-raise-controls';

import type { BlindState } from '~/server/api/blind-timer';

interface DealerCameraProps {
    communityCards: string[];
    potTotal: number;
    gameStatus?: string;
    activePlayerName?: string;
    winningCards?: string[]; // Cards that make up the winning hand
    dealerUserId?: string;
    blinds?: BlindState;
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
    blinds,
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
    const [pendingAction, setPendingAction] = useState<'fold' | 'check' | 'raise' | null>(null);

    // Update raise amount when big blind or max bet changes
    useEffect(() => {
        if (bigBlind && maxBet !== undefined) {
            setRaiseAmount(maxBet + bigBlind);
        }
    }, [bigBlind, maxBet]);

    // Handle raise action
    const handleRaise = () => {
        setPendingAction('raise');
        onAction?.('RAISE', { amount: raiseAmount });
    };

    // Handle fold action
    const handleFold = () => {
        setPendingAction('fold');
        onAction?.('FOLD');
    };

    // Handle check action
    const handleCheck = () => {
        setPendingAction('check');
        onAction?.('CHECK');
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
            <AnimatePresence mode="wait">
                {isPlayerTurn && onAction && (
                    <motion.div
                        key={isLoading ? 'spinner' : 'controls'}
                        layoutId="raise-controls"
                        className="absolute right-4 bottom-3"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                    >
                        {isLoading ? (
                            <div
                                className="flex items-center justify-center p-2 rounded-xl backdrop-blur border"
                                style={{
                                    borderColor: pendingAction === 'fold' ? 'rgba(239, 68, 68, 0.3)' :
                                        pendingAction === 'check' ? 'rgba(34, 197, 94, 0.3)' :
                                            pendingAction === 'raise' ? 'rgba(234, 179, 8, 0.3)' :
                                                'rgba(255, 255, 255, 0.1)',
                                }}
                            >
                                <Spinner variant="ring" size={24} className="text-white" />
                            </div>
                        ) : (
                            <VerticalRaiseControls
                                potTotal={potTotal}
                                playerBalance={playerBalance ?? 1000}
                                currentBet={currentBet ?? 0}
                                bigBlind={bigBlind ?? 20}
                                raiseAmount={raiseAmount}
                                onRaiseAmountChange={setRaiseAmount}
                                onFold={handleFold}
                                onCheck={handleCheck}
                                onRaise={handleRaise}
                                maxBet={maxBet}
                            />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Subtle gradient overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10 pointer-events-none" />
        </div>
    );
}
