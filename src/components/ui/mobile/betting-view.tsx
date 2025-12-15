import { useSession } from 'next-auth/react';
import * as React from 'react';
import {
    useBettingActorSeatId, useCommunityCards, useCurrentSeat, useCurrentUserSeatId, useGameState,
    useIsPlayerTurn, useTableId, useWinningCards
} from '~/hooks/use-table-selectors';

import { HandCamera } from '../hand-camera';
import { QuickActions } from '../quick-actions';
import { VerticalRaiseControls } from '../vertical-raise-controls';
import { CommunityCardsDisplay } from './community-cards-display';
import { MobileSeatSection } from './seat-section';

interface MobileBettingViewProps {
    handRoomName: string | null;
    quickAction: 'fold' | 'check' | 'check-fold' | null;
    onQuickActionChange: (action: 'fold' | 'check' | 'check-fold' | null) => void;
}

export function MobileBettingView({
    handRoomName,
    quickAction,
    onQuickActionChange,
}: MobileBettingViewProps) {
    const { data: session } = useSession();
    const userId = session?.user?.id;

    // Get data from Zustand store using selectors
    const gameState = useGameState();
    const communityCards = useCommunityCards();
    const winningCards = useWinningCards();
    const currentSeat = useCurrentSeat(userId);
    const currentUserSeatId = useCurrentUserSeatId(userId);
    const bettingActorSeatId = useBettingActorSeatId();
    const tableId = useTableId(); // Guaranteed to be string
    const isPlayerTurn = useIsPlayerTurn(userId);

    return (
        <div className="h-full w-full flex flex-col">
            {/* Top Half: All Player Seats in Horizontal Scroll */}
            <div className="h-1/2 overflow-x-auto overflow-y-visible border-b border-white/10">
                <div className="h-full px-2 py-4 min-w-max overflow-visible">
                    <MobileSeatSection />
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
                                <VerticalRaiseControls />
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

