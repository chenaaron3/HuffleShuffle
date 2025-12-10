import * as React from 'react';

import { HandCamera } from '../hand-camera';
import { QuickActions } from '../quick-actions';
import { VerticalRaiseControls } from '../vertical-raise-controls';
import { CommunityCardsDisplay } from './community-cards-display';
import { MobileSeatSection } from './seat-section';

import type { SeatWithPlayer } from '~/server/api/routers/table';

interface SeatSectionProps {
    highlightedSeatId: string | null;
    smallBlindIdx: number;
    bigBlindIdx: number;
    dealerButtonIdx: number;
    myUserId: string | null;
    gameState?: string;
    canMoveSeat: boolean;
    movingSeatNumber: number | null;
    turnStartTime: Date | null;
    tableId: string;
    dealerCanControlAudio: boolean;
    onMoveSeat: (seatNumber: number) => Promise<void>;
}

interface MobileBettingViewProps {
    // Seats data
    seats: (SeatWithPlayer | null)[];
    seatSectionProps: SeatSectionProps;
    tableId: string;

    // Game state
    gameState?: string;
    communityCards: string[];
    winningCards?: string[];
    totalPot: number;

    // Player state
    currentSeat: SeatWithPlayer | null | undefined;
    currentUserSeatId: string | null;
    bettingActorSeatId: string | null;
    handRoomName: string | null;

    // Betting controls
    effectiveBigBlind?: number;
    maxBet?: number;
    quickAction: 'fold' | 'check' | 'check-fold' | null;
    onQuickActionChange: (action: 'fold' | 'check' | 'check-fold' | null) => void;

    // Actions
    onAction: (actionType: 'FOLD' | 'CHECK' | 'RAISE', params?: { amount?: number }) => void;
}

export function MobileBettingView({
    seats,
    seatSectionProps,
    tableId,
    gameState,
    communityCards,
    winningCards,
    totalPot,
    currentSeat,
    currentUserSeatId,
    bettingActorSeatId,
    handRoomName,
    effectiveBigBlind,
    maxBet,
    quickAction,
    onQuickActionChange,
    onAction,
}: MobileBettingViewProps) {
    const isPlayerTurn = gameState === 'BETTING' && currentUserSeatId === bettingActorSeatId;
    const [raiseAmount, setRaiseAmount] = React.useState<number>(
        (effectiveBigBlind ?? 20) + (maxBet ?? 0)
    );

    // Update raise amount when big blind or max bet changes
    React.useEffect(() => {
        const bigBlind = effectiveBigBlind ?? 20;
        const currentMaxBet = maxBet ?? 0;
        if (bigBlind !== undefined && currentMaxBet !== undefined) {
            setRaiseAmount(currentMaxBet + bigBlind);
        }
    }, [effectiveBigBlind, maxBet]);

    const handleFold = () => {
        onAction('FOLD');
    };

    const handleCheck = () => {
        onAction('CHECK');
    };

    const handleRaise = () => {
        onAction('RAISE', { amount: raiseAmount });
    };

    return (
        <div className="h-full w-full flex flex-col">
            {/* Top Half: All Player Seats in Horizontal Scroll */}
            <div className="h-1/2 overflow-x-auto overflow-y-visible border-b border-white/10">
                <div className="h-full px-2 py-4 min-w-max overflow-visible">
                    <MobileSeatSection
                        seats={seats}
                        highlightedSeatId={seatSectionProps.highlightedSeatId}
                        smallBlindIdx={seatSectionProps.smallBlindIdx}
                        bigBlindIdx={seatSectionProps.bigBlindIdx}
                        dealerButtonIdx={seatSectionProps.dealerButtonIdx}
                        myUserId={seatSectionProps.myUserId}
                        gameState={seatSectionProps.gameState}
                        canMoveSeat={seatSectionProps.canMoveSeat}
                        movingSeatNumber={seatSectionProps.movingSeatNumber}
                        turnStartTime={seatSectionProps.turnStartTime}
                        tableId={seatSectionProps.tableId}
                        dealerCanControlAudio={seatSectionProps.dealerCanControlAudio}
                        onMoveSeat={seatSectionProps.onMoveSeat}
                    />
                </div>
            </div>

            {/* Bottom Half: Community Cards, Hand Camera, Betting Controls - Horizontal Scrollable Layout */}
            <div className="h-1/2 overflow-x-auto overflow-y-hidden">
                <div className="h-full flex flex-row items-center gap-4 px-4 py-4 min-w-max">
                    {/* Community Cards - Left */}
                    <div className="flex-shrink-0 flex items-center justify-center h-full">
                        <CommunityCardsDisplay
                            cards={communityCards}
                            winningCards={winningCards}
                            gameStatus={gameState}
                        />
                    </div>

                    {/* Hand Camera - Middle */}
                    <div className="flex-shrink-0 flex items-center justify-center h-full">
                        <HandCamera
                            tableId={tableId}
                            roomName={handRoomName}
                        />
                    </div>

                    {/* Betting Controls - Right */}
                    {(isPlayerTurn || currentSeat) && (
                        <div className="flex-shrink-0 flex items-center justify-center h-full px-2">
                            {isPlayerTurn && currentSeat ? (
                                <VerticalRaiseControls
                                    potTotal={totalPot}
                                    playerBalance={currentSeat.buyIn ?? 0}
                                    currentBet={currentSeat.currentBet ?? 0}
                                    bigBlind={effectiveBigBlind ?? 20}
                                    raiseAmount={raiseAmount}
                                    onRaiseAmountChange={setRaiseAmount}
                                    onFold={handleFold}
                                    onCheck={handleCheck}
                                    onRaise={handleRaise}
                                    maxBet={maxBet}
                                />
                            ) : (
                                currentSeat && (
                                    <QuickActions
                                        value={quickAction}
                                        onChange={onQuickActionChange}
                                        disabled={bettingActorSeatId === currentSeat.id}
                                        gameState={gameState}
                                        isMyTurn={bettingActorSeatId === currentSeat.id}
                                    />
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

