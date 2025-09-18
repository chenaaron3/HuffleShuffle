import { ChevronDown, ChevronUp, Coins, Target, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Slider } from '~/components/ui/slider';

type GameAction = "RESET_TABLE" | "START_GAME" | "DEAL_CARD" | "RAISE" | "FOLD" | "CHECK";

interface ActionButtonsProps {
    isDealer: boolean;
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
    const isDealing = ['DEAL_HOLE_CARDS', 'DEAL_FLOP', 'DEAL_TURN', 'DEAL_RIVER'].includes(state || '');

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
        return (
            <Card className="bg-white/95 backdrop-blur-sm border-white/20 shadow-xl">
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        {/* Deal Card Controls */}
                        {isDealing && (
                            <div className="flex gap-2">
                                <select
                                    aria-label="Rank"
                                    value={dealRank}
                                    onChange={(e) => setDealRank(e.target.value)}
                                    className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black border border-gray-200 hover:bg-gray-50 transition-colors"
                                >
                                    {['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'].map((r) => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                                <select
                                    aria-label="Suit"
                                    value={dealSuit}
                                    onChange={(e) => setDealSuit(e.target.value)}
                                    className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black border border-gray-200 hover:bg-gray-50 transition-colors"
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
                            onClick={() => onAction('START_GAME')}
                            disabled={isLoading}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded-lg transition-all duration-200 hover:scale-105"
                        >
                            {isLoading ? 'Starting...' : 'Start Game'}
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
        );
    }

    // Player Action Buttons
    if (!isPlayerTurn) {
        return (
            <Card className="bg-gray-100/90 backdrop-blur-sm border-gray-200/50">
                <CardContent className="p-4">
                    <div className="text-center text-gray-600 font-medium">
                        Waiting for your turn...
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-white/95 backdrop-blur-sm border-white/20 shadow-xl">
            <CardContent className="p-4">
                <div className="space-y-4">
                    {/* Main Action Buttons */}
                    <div className="flex items-center justify-center gap-3">
                        <Button
                            onClick={() => onAction('CHECK')}
                            disabled={isLoading}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 hover:scale-105 min-w-[100px]"
                        >
                            {isLoading ? '...' : 'Check'}
                        </Button>

                        <Button
                            onClick={() => setShowRaiseControls(!showRaiseControls)}
                            disabled={isLoading}
                            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 hover:scale-105 min-w-[100px] flex items-center gap-2"
                        >
                            {isLoading ? '...' : 'Raise'}
                            {showRaiseControls ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>

                        <Button
                            onClick={() => onAction('FOLD')}
                            disabled={isLoading}
                            className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 hover:scale-105 min-w-[100px]"
                        >
                            {isLoading ? '...' : 'Fold'}
                        </Button>
                    </div>

                    {/* Raise Controls */}
                    {showRaiseControls && (
                        <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                            {/* Quick Actions */}
                            <div className="flex items-center justify-center gap-2">
                                <Button
                                    onClick={() => handleQuickRaise(halfPot)}
                                    variant="outline"
                                    className="flex items-center gap-2 text-xs px-3 py-2"
                                >
                                    <Target className="w-3 h-3" />
                                    ½ Pot (${halfPot})
                                </Button>
                                <Button
                                    onClick={() => handleQuickRaise(fullPot)}
                                    variant="outline"
                                    className="flex items-center gap-2 text-xs px-3 py-2"
                                >
                                    <Zap className="w-3 h-3" />
                                    Pot (${fullPot})
                                </Button>
                                <Button
                                    onClick={() => handleQuickRaise(allIn)}
                                    variant="outline"
                                    className="flex items-center gap-2 text-xs px-3 py-2"
                                >
                                    <Coins className="w-3 h-3" />
                                    All In (${allIn})
                                </Button>
                            </div>

                            {/* Custom Raise Slider */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Badge variant="secondary" className="text-xs">
                                        Custom Raise: ${raiseAmount}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
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

                                <div className="flex items-center justify-center gap-2">
                                    <Button
                                        onClick={() => setRaiseAmount(Math.max(bigBlind, raiseAmount - bigBlind))}
                                        variant="outline"
                                        size="sm"
                                        className="px-3"
                                    >
                                        -${bigBlind}
                                    </Button>
                                    <Button
                                        onClick={handleCustomRaise}
                                        className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-6 py-2"
                                    >
                                        Raise ${raiseAmount}
                                    </Button>
                                    <Button
                                        onClick={() => setRaiseAmount(Math.min(maxBet, raiseAmount + bigBlind))}
                                        variant="outline"
                                        size="sm"
                                        className="px-3"
                                    >
                                        +${bigBlind}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
