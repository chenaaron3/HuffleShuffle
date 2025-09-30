import { CheckCircle, Coins, Hand, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { RollingNumber } from '~/components/ui/chip-animations';

type GameAction = "RESET_TABLE" | "START_GAME" | "DEAL_CARD" | "RAISE" | "FOLD" | "CHECK" | "LEAVE";

interface ActionButtonsProps {
    isDealer: boolean;
    isJoinable: boolean;
    state?: string;
    currentUserSeatId?: string | null;
    bettingActorSeatId?: string | null;
    isLoading?: boolean;
    onAction: (action: GameAction, params?: any) => void;
    onDealCard?: (rank: string, suit: string) => void;
    onRandomCard?: () => void;
    // Props for raise functionality
    raiseAmount?: number;
    onRaise?: () => void;
}

export function ActionButtons({
    isDealer,
    isJoinable,
    state,
    currentUserSeatId,
    bettingActorSeatId,
    isLoading = false,
    onAction,
    onDealCard,
    onRandomCard,
    raiseAmount = 0,
    onRaise
}: ActionButtonsProps) {
    const [dealRank, setDealRank] = useState<string>('A');
    const [dealSuit, setDealSuit] = useState<string>('s');
    const [isDealerTurn, setIsDealerTurn] = useState<boolean>(false);

    const isPlayerTurn = state === 'BETTING' && currentUserSeatId === bettingActorSeatId;
    useEffect(() => {
        if (state) {
            console.log('isDealerTurn', isDealerTurn);
            console.log('state', state);
            setIsDealerTurn(['DEAL_HOLE_CARDS', 'DEAL_FLOP', 'DEAL_TURN', 'DEAL_RIVER'].includes(state));
        }
    }, [state]);

    if (isDealer) {
        console.log('isDealerTurn', isDealerTurn);
        return (
            <div className="w-full">
                <div className="bg-black/20 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-white/10">
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        {/* Game Control Buttons */}
                        <Button
                            variant="plain"
                            size="none"
                            onClick={() => {
                                if (isJoinable) {
                                    onAction('START_GAME')
                                } else {
                                    onAction('RESET_TABLE')
                                }
                            }}
                            disabled={isLoading}
                            className="!bg-green-500/20 hover:!bg-green-500/30 backdrop-blur-md !text-white font-semibold px-8 py-3 rounded-xl transition-all duration-200 hover:scale-105 !border !border-green-400/30 hover:!border-green-400/50"
                        >
                            {isJoinable ? 'Start Game' : 'Reset Table'}
                        </Button>

                        {onRandomCard && (
                            <Button
                                variant="plain"
                                size="none"
                                onClick={onRandomCard}
                                disabled={isLoading || isJoinable || !isDealerTurn}
                                className="!bg-purple-500/20 hover:!bg-purple-500/30 backdrop-blur-md !text-white font-semibold px-8 py-3 rounded-xl transition-all duration-200 hover:scale-105 !border !border-purple-400/30 hover:!border-purple-400/50"
                            >
                                {isLoading ? 'Dealing...' : 'Deal Random'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Player Action Buttons - Arc Layout around hand camera
    if (!isPlayerTurn) {
        return (
            <div className="w-full">
                <div className="bg-black/20 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-white/10">
                    <div className="space-y-4">
                        <div className="text-center text-white/80 font-medium">
                            Waiting for your turn...
                        </div>

                        {/* Leave Button - Show when table is joinable */}
                        {isJoinable && (
                            <div className="pt-4 border-t border-white/20">
                                <Button
                                    onClick={() => onAction('LEAVE')}
                                    disabled={isLoading}
                                    className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-semibold px-6 py-2 rounded-xl transition-all duration-200 hover:scale-105 w-full border border-white/20 hover:border-white/30"
                                >
                                    {isLoading ? 'Leaving...' : 'Leave Table'}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Main Action Buttons in FanDuel-style overlay */}
            <div className="relative flex items-center justify-center gap-4">
                {/* Left Side - Negative Actions */}
                <Button
                    variant="plain"
                    size="none"
                    onClick={() => onAction('FOLD')}
                    disabled={isLoading}
                    className="!bg-red-500/20 hover:!bg-red-500/30 backdrop-blur-md !text-white font-semibold px-8 py-4 rounded-2xl transition-all duration-200 hover:scale-105 min-w-[140px] shadow-2xl !border !border-red-400/30 hover:!border-red-400/50 flex items-center gap-2"
                >
                    <Hand className="w-4 h-4" />
                    {isLoading ? '...' : 'Fold'}
                </Button>

                {/* Center - Check/Call */}
                <Button
                    variant="plain"
                    size="none"
                    onClick={() => onAction('CHECK')}
                    disabled={isLoading}
                    className="!bg-green-500/20 hover:!bg-green-500/30 backdrop-blur-md !text-white font-semibold px-10 py-4 rounded-2xl transition-all duration-200 hover:scale-105 min-w-[160px] shadow-2xl !border !border-green-400/30 hover:!border-green-400/50 flex items-center gap-2"
                >
                    <CheckCircle className="w-4 h-4" />
                    {isLoading ? '...' : 'Check'}
                </Button>

                {/* Right Side - Raise */}
                {onRaise && (
                    <Button
                        variant="plain"
                        size="none"
                        onClick={onRaise}
                        disabled={isLoading}
                        className="!bg-orange-500/20 hover:!bg-orange-500/30 backdrop-blur-md !text-white font-semibold px-8 py-4 rounded-2xl transition-all duration-200 hover:scale-105 min-w-[140px] shadow-2xl !border !border-orange-400/30 hover:!border-orange-400/50 flex items-center gap-2"
                    >
                        <TrendingUp className="w-4 h-4" />
                        {isLoading ? '...' : (
                            <>
                                Raise <RollingNumber value={raiseAmount} prefix="$" className="font-semibold" />
                            </>
                        )}
                    </Button>
                )}
            </div>

            {/* Leave Button - Bottom */}
            {isJoinable && (
                <div className="mt-4 flex justify-center">
                    <Button
                        onClick={() => onAction('LEAVE')}
                        disabled={isLoading}
                        className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-semibold px-6 py-2 rounded-xl transition-all duration-200 hover:scale-105 border border-white/20 hover:border-white/30"
                    >
                        {isLoading ? 'Leaving...' : 'Leave Table'}
                    </Button>
                </div>
            )}
        </div>
    );
}