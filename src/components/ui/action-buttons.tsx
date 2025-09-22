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
                <div className="mt-6">
                    <Card className="bg-zinc-900/95 backdrop-blur-sm border-zinc-700/50 shadow-2xl">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-center">
                                <span className="text-zinc-400 font-medium">
                                    Waiting for dealer turn...
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return (
            <div className="mt-6">
                <Card className="bg-zinc-900/95 backdrop-blur-sm border-zinc-700/50 shadow-2xl">
                    <CardContent className="p-4">
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            {/* Deal Card Controls */}
                            {isDealing && (
                                <div className="flex gap-2">
                                    <select
                                        aria-label="Rank"
                                        value={dealRank}
                                        onChange={(e) => setDealRank(e.target.value)}
                                        className="rounded-lg bg-zinc-800 border-zinc-600 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
                                    >
                                        {['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'].map((r) => (
                                            <option key={r} value={r}>{r}</option>
                                        ))}
                                    </select>
                                    <select
                                        aria-label="Suit"
                                        value={dealSuit}
                                        onChange={(e) => setDealSuit(e.target.value)}
                                        className="rounded-lg bg-zinc-800 border-zinc-600 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
                                    >
                                        {[
                                            { value: 's', label: '♠' },
                                            { value: 'h', label: '♥' },
                                            { value: 'd', label: '♦' },
                                            { value: 'c', label: '♣' },
                                        ].map((s) => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

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
                                className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded-lg transition-all duration-200 hover:scale-105"
                            >
                                {isJoinable ? 'Start Game' : 'Reset Table'}
                            </Button>

                            {onDealCard && (
                                <Button
                                    onClick={() => onDealCard(dealRank, dealSuit)}
                                    disabled={isLoading}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-all duration-200 hover:scale-105"
                                >
                                    {isLoading ? 'Dealing...' : 'Deal Card'}
                                </Button>
                            )}

                            {onRandomCard && (
                                <Button
                                    onClick={onRandomCard}
                                    disabled={isLoading}
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2 rounded-lg transition-all duration-200 hover:scale-105"
                                >
                                    {isLoading ? 'Dealing...' : 'Random'}
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Player Action Buttons - Arc Layout around hand camera
    if (!isPlayerTurn) {
        return (
            <div className="mt-6">
                <Card className="bg-zinc-900/95 backdrop-blur-sm border-zinc-700/50 shadow-2xl">
                    <CardContent className="p-4">
                        <div className="space-y-4">
                            <div className="text-center text-zinc-400 font-medium">
                                Waiting for your turn...
                            </div>

                            {/* Leave Button - Show when table is joinable */}
                            {isJoinable && (
                                <div className="pt-4 border-t border-zinc-700">
                                    <Button
                                        onClick={() => onAction('LEAVE')}
                                        disabled={isLoading}
                                        className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 font-semibold px-6 py-2 rounded-lg transition-all duration-200 hover:scale-105 w-full"
                                    >
                                        {isLoading ? 'Leaving...' : 'Leave Table'}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="mt-6">
            {/* Main Action Buttons in Arc Layout */}
            <div className="relative flex items-center justify-center">
                {/* Left Side - Negative Actions */}
                <div className="absolute -left-32 top-0 flex flex-col gap-3">
                    <Button
                        onClick={() => onAction('FOLD')}
                        disabled={isLoading}
                        className="bg-red-600/90 hover:bg-red-500 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 hover:scale-105 min-w-[120px] shadow-lg border border-red-500/50"
                    >
                        {isLoading ? '...' : 'Fold'}
                    </Button>
                </div>

                {/* Center - Check/Call */}
                <div className="flex flex-col gap-3">
                    <Button
                        onClick={() => onAction('CHECK')}
                        disabled={isLoading}
                        className="bg-green-600/90 hover:bg-green-500 text-white font-semibold px-8 py-3 rounded-xl transition-all duration-200 hover:scale-105 min-w-[140px] shadow-lg border border-green-500/50"
                    >
                        {isLoading ? '...' : 'Check'}
                    </Button>
                </div>

                {/* Right Side - Positive Actions */}
                <div className="absolute -right-32 top-0 flex flex-col gap-3">
                    <Button
                        onClick={() => setShowRaiseControls(!showRaiseControls)}
                        disabled={isLoading}
                        className="bg-orange-600/90 hover:bg-orange-500 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 hover:scale-105 min-w-[120px] shadow-lg border border-orange-500/50 flex items-center gap-2"
                    >
                        {isLoading ? '...' : 'Raise'}
                        {showRaiseControls ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                </div>
            </div>

            {/* Raise Controls - Expanded below */}
            {showRaiseControls && (
                <div className="mt-6 animate-in slide-in-from-top-2 duration-300">
                    <Card className="bg-zinc-900/95 backdrop-blur-sm border-zinc-700/50 shadow-2xl">
                        <CardContent className="p-6">
                            <div className="space-y-6">
                                {/* Quick Actions */}
                                <div className="flex items-center justify-center gap-3">
                                    <Button
                                        onClick={() => handleQuickRaise(halfPot)}
                                        variant="outline"
                                        className="flex items-center gap-2 text-sm px-4 py-2 border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                                    >
                                        <Target className="w-4 h-4" />
                                        ½ Pot (${halfPot})
                                    </Button>
                                    <Button
                                        onClick={() => handleQuickRaise(fullPot)}
                                        variant="outline"
                                        className="flex items-center gap-2 text-sm px-4 py-2 border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                                    >
                                        <Zap className="w-4 h-4" />
                                        Pot (${fullPot})
                                    </Button>
                                    <Button
                                        onClick={() => handleQuickRaise(allIn)}
                                        variant="outline"
                                        className="flex items-center gap-2 text-sm px-4 py-2 border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                                    >
                                        <Coins className="w-4 h-4" />
                                        All In (${allIn})
                                    </Button>
                                </div>

                                {/* Custom Raise Slider */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Badge variant="secondary" className="text-sm bg-zinc-800 text-zinc-300">
                                            Custom Raise: ${raiseAmount}
                                        </Badge>
                                        <Badge variant="outline" className="text-sm border-zinc-600 text-zinc-400">
                                            Max: ${maxBet}
                                        </Badge>
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
                                            variant="outline"
                                            size="sm"
                                            className="px-3 border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            onClick={handleCustomRaise}
                                            className="bg-orange-600 hover:bg-orange-500 text-white font-semibold px-6 py-2"
                                        >
                                            Raise ${raiseAmount}
                                        </Button>
                                        <Button
                                            onClick={() => setRaiseAmount(Math.min(maxBet, raiseAmount + bigBlind))}
                                            variant="outline"
                                            size="sm"
                                            className="px-3 border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Leave Button - Bottom */}
            {isJoinable && (
                <div className="mt-4 flex justify-center">
                    <Button
                        onClick={() => onAction('LEAVE')}
                        disabled={isLoading}
                        className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 font-semibold px-6 py-2 rounded-lg transition-all duration-200 hover:scale-105"
                    >
                        {isLoading ? 'Leaving...' : 'Leave Table'}
                    </Button>
                </div>
            )}
        </div>
    );
}