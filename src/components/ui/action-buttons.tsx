import { CheckCircle, Coins, Hand, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { RollingNumber } from '~/components/ui/chip-animations';

type GameAction = "RESET_TABLE" | "START_GAME" | "DEAL_CARD" | "RAISE" | "FOLD" | "CHECK" | "LEAVE";

interface ActionButtonsProps {
    isDealer: boolean;
    isJoinable: boolean;
    state?: string;
    isLoading?: boolean;
    onAction: (action: GameAction, params?: any) => void;
    onDealCard?: (rank: string, suit: string) => void;
    onRandomCard?: () => void;
    // Props for raise functionality
    raiseAmount?: number;
    onRaise?: () => void;
    maxBet?: number;
}

export function ActionButtons({
    isDealer,
    isJoinable,
    state,
    isLoading = false,
    onAction,
    onDealCard,
    onRandomCard,
    raiseAmount = 0,
    onRaise,
    maxBet
}: ActionButtonsProps) {
    const [dealRank, setDealRank] = useState<string>('A');
    const [dealSuit, setDealSuit] = useState<string>('s');
    const [isDealerTurn, setIsDealerTurn] = useState<boolean>(false);

    useEffect(() => {
        if (state) {
            setIsDealerTurn(['DEAL_HOLE_CARDS', 'DEAL_FLOP', 'DEAL_TURN', 'DEAL_RIVER'].includes(state));
        }
    }, [state]);

    // Using Tailwind palette utilities for button styling

    if (isDealer) {
        return (
            <div className="w-full">
                <div
                    className="rounded-2xl shadow-2xl bg-black/20 border border-white/10 p-6 backdrop-blur-md"
                >
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        {/* Game Control Buttons */}
                        <Button
                            onClick={() => {
                                if (isJoinable) {
                                    onAction('START_GAME')
                                } else {
                                    onAction('RESET_TABLE')
                                }
                            }}
                            disabled={isLoading}
                            className="transition-all duration-200 hover:scale-105 shadow-2xl inline-flex items-center justify-center font-semibold px-8 py-3 rounded-xl border text-white bg-green-600/20 border-green-400/30 backdrop-blur"
                        >
                            {isJoinable ? 'Start Game' : 'Reset Table'}
                        </Button>

                        {onRandomCard && (
                            <Button
                                onClick={onRandomCard}
                                disabled={isLoading || isJoinable || !isDealerTurn}
                                className="transition-all duration-200 hover:scale-105 shadow-2xl inline-flex items-center justify-center font-semibold px-8 py-3 rounded-xl border text-white bg-purple-500/20 border-purple-400/30 backdrop-blur"
                            >
                                {isLoading ? 'Dealing...' : 'Deal Random'}
                            </Button>
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
                    onClick={() => onAction('FOLD')}
                    disabled={isLoading}
                    className="transition-all duration-200 hover:scale-105 min-w-[140px] shadow-2xl flex items-center gap-2 border text-white font-semibold bg-red-600/20 border-red-400/30 backdrop-blur"
                >
                    <Hand className="w-4 h-4" />
                    {isLoading ? '...' : 'Fold'}
                </Button>

                {/* Center - Check/Call */}
                <Button
                    onClick={() => onAction('CHECK')}
                    disabled={isLoading}
                    className="transition-all duration-200 hover:scale-105 min-w-[160px] shadow-2xl flex items-center gap-2 px-10 py-4 rounded-2xl border text-white font-semibold bg-green-600/20 border-green-400/30 backdrop-blur"
                >
                    <CheckCircle className="w-4 h-4" />
                    {isLoading ? '...' : (maxBet ? 'Call' : 'Check')}
                </Button>

                {/* Right Side - Raise */}
                {onRaise && (
                    <Button
                        onClick={onRaise}
                        disabled={isLoading}
                        className="transition-all duration-200 hover:scale-105 min-w-[140px] shadow-2xl flex items-center gap-2 px-8 py-4 rounded-2xl border text-white font-semibold bg-orange-500/20 border-orange-400/30 backdrop-blur"
                    >
                        <TrendingUp className="w-4 h-4" />
                        {isLoading ? '...' : (
                            <>
                                Raise to <RollingNumber value={raiseAmount} prefix="$" className="font-semibold" />
                            </>
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
}