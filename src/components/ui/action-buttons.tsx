import { ChevronDown, ChevronUp, Coins, Minus, Plus, Target, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Slider } from '~/components/ui/slider';

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
    // Add these props for better raise functionality
    potTotal?: number;
    currentBet?: number;
    playerBalance?: number;
    bigBlind?: number;
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
    potTotal = 0,
    currentBet = 0,
    playerBalance = 1000,
    bigBlind = 20
}: ActionButtonsProps) {
    const [dealRank, setDealRank] = useState<string>('A');
    const [dealSuit, setDealSuit] = useState<string>('s');
    const [showRaiseControls, setShowRaiseControls] = useState(false);
    const [raiseAmount, setRaiseAmount] = useState<number>(bigBlind);
    const [maxBet, setMaxBet] = useState<number>(playerBalance);

    const isPlayerTurn = state === 'BETTING' && currentUserSeatId === bettingActorSeatId;
    const isDealing = ['DEAL_HOLE_CARDS', 'DEAL_FLOP', 'DEAL_TURN', 'DEAL_RIVER', 'SHOWDOWN'].includes(state || '');

    // Calculate raise amounts
    const halfPot = Math.floor(potTotal / 2);
    const fullPot = potTotal;
    const allIn = playerBalance;

    useEffect(() => {
        setMaxBet(playerBalance);
        setRaiseAmount(Math.max(bigBlind, currentBet + bigBlind));
    }, [playerBalance, bigBlind, currentBet]);

    const handleQuickRaise = (amount: number) => {
        onAction('RAISE', { amount });
        setShowRaiseControls(false);
    };

    const handleCustomRaise = () => {
        onAction('RAISE', { amount: raiseAmount });
        setShowRaiseControls(false);
    };

    if (isDealer) {
        // Only show dealer controls when it's the dealer's turn
        if (!isDealing) {
            return (
                <div className="w-full">
                    <div className="bg-black/20 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-white/10">
                        <div className="flex items-center justify-center">
                            <span className="text-white/80 font-medium">
                                Waiting for dealer turn...
                            </span>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="w-full">
                <div className="bg-black/20 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-white/10">
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
                            className="bg-green-500/20 hover:bg-green-500/30 backdrop-blur-md text-white font-semibold px-8 py-3 rounded-xl transition-all duration-200 hover:scale-105 border border-green-400/30 hover:border-green-400/50"
                        >
                            {isJoinable ? 'Start Game' : 'Reset Table'}
                        </Button>

                        {onRandomCard && (
                            <Button
                                onClick={onRandomCard}
                                disabled={isLoading}
                                className="bg-purple-500/20 hover:bg-purple-500/30 backdrop-blur-md text-white font-semibold px-8 py-3 rounded-xl transition-all duration-200 hover:scale-105 border border-purple-400/30 hover:border-purple-400/50"
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
                    onClick={() => onAction('FOLD')}
                    disabled={isLoading}
                    className="bg-red-500/20 hover:bg-red-500/30 backdrop-blur-md text-white font-semibold px-8 py-4 rounded-2xl transition-all duration-200 hover:scale-105 min-w-[140px] shadow-2xl border border-red-400/30 hover:border-red-400/50"
                >
                    {isLoading ? '...' : 'Fold'}
                </Button>

                {/* Center - Check/Call */}
                <Button
                    onClick={() => onAction('CHECK')}
                    disabled={isLoading}
                    className="bg-green-500/20 hover:bg-green-500/30 backdrop-blur-md text-white font-semibold px-10 py-4 rounded-2xl transition-all duration-200 hover:scale-105 min-w-[160px] shadow-2xl border border-green-400/30 hover:border-green-400/50"
                >
                    {isLoading ? '...' : 'Check'}
                </Button>

                {/* Right Side - Positive Actions */}
                <Button
                    onClick={() => setShowRaiseControls(!showRaiseControls)}
                    disabled={isLoading}
                    className="bg-orange-500/20 hover:bg-orange-500/30 backdrop-blur-md text-white font-semibold px-8 py-4 rounded-2xl transition-all duration-200 hover:scale-105 min-w-[140px] shadow-2xl border border-orange-400/30 hover:border-orange-400/50 flex items-center gap-2"
                >
                    {isLoading ? '...' : 'Raise'}
                    {showRaiseControls ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
            </div>

            {/* Raise Controls - Expanded below */}
            {showRaiseControls && (
                <div className="mt-6 animate-in slide-in-from-top-2 duration-300">
                    <div className="bg-black/20 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-white/10">
                        <div className="space-y-6">
                            {/* Quick Actions */}
                            <div className="flex items-center justify-center gap-3">
                                <Button
                                    onClick={() => handleQuickRaise(halfPot)}
                                    className="bg-blue-500/20 hover:bg-blue-500/30 backdrop-blur-md text-white font-medium px-4 py-2 rounded-xl border border-blue-400/30 hover:border-blue-400/50 flex items-center gap-2"
                                >
                                    <Target className="w-4 h-4" />
                                    ½ Pot (${halfPot})
                                </Button>
                                <Button
                                    onClick={() => handleQuickRaise(fullPot)}
                                    className="bg-purple-500/20 hover:bg-purple-500/30 backdrop-blur-md text-white font-medium px-4 py-2 rounded-xl border border-purple-400/30 hover:border-purple-400/50 flex items-center gap-2"
                                >
                                    <Zap className="w-4 h-4" />
                                    Pot (${fullPot})
                                </Button>
                                <Button
                                    onClick={() => handleQuickRaise(allIn)}
                                    className="bg-yellow-500/20 hover:bg-yellow-500/30 backdrop-blur-md text-white font-medium px-4 py-2 rounded-xl border border-yellow-400/30 hover:border-yellow-400/50 flex items-center gap-2"
                                >
                                    <Coins className="w-4 h-4" />
                                    All In (${allIn})
                                </Button>
                            </div>

                            {/* Custom Raise Slider */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-lg text-sm text-white font-medium">
                                        Custom Raise: ${raiseAmount}
                                    </div>
                                    <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-lg text-sm text-white/80 font-medium">
                                        Max: ${maxBet}
                                    </div>
                                </div>

                                <div className="px-2">
                                    <Slider
                                        value={[raiseAmount]}
                                        onValueChange={(value) => setRaiseAmount(value[0] ?? bigBlind)}
                                        max={maxBet}
                                        min={bigBlind}
                                        step={bigBlind}
                                        className="w-full"
                                    />
                                </div>

                                <div className="flex items-center justify-center gap-3">
                                    <Button
                                        onClick={() => setRaiseAmount(Math.max(bigBlind, raiseAmount - bigBlind))}
                                        className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-3 py-2 rounded-xl border border-white/20"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        onClick={handleCustomRaise}
                                        className="bg-orange-500/20 hover:bg-orange-500/30 backdrop-blur-md text-white font-semibold px-6 py-2 rounded-xl border border-orange-400/30 hover:border-orange-400/50"
                                    >
                                        Raise ${raiseAmount}
                                    </Button>
                                    <Button
                                        onClick={() => setRaiseAmount(Math.min(maxBet, raiseAmount + bigBlind))}
                                        className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-3 py-2 rounded-xl border border-white/20"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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