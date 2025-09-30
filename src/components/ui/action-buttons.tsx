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

    useEffect(() => {
        if (state) {
            setIsDealerTurn(['DEAL_HOLE_CARDS', 'DEAL_FLOP', 'DEAL_TURN', 'DEAL_RIVER'].includes(state));
        }
    }, [state]);

    // Inline button styles to ensure colors/borders render correctly in prod
    const btnBase: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        padding: '12px 32px',
        borderRadius: 12,
        transition: 'transform 200ms ease, box-shadow 200ms ease',
        borderWidth: 1,
        borderStyle: 'solid',
        cursor: 'pointer',
        backdropFilter: 'blur(8px)'
    };
    const styleGreen: React.CSSProperties = {
        ...btnBase,
        color: '#fff',
        backgroundColor: 'rgba(0,167,82,0.2)',
        borderColor: 'rgba(5,223,114,0.3)'
    };
    const stylePurple: React.CSSProperties = {
        ...btnBase,
        color: '#fff',
        backgroundColor: 'rgba(172,75,255,0.2)',
        borderColor: 'rgba(192,126,255,0.3)'
    };
    const styleRed: React.CSSProperties = {
        ...btnBase,
        color: '#fff',
        backgroundColor: 'rgba(251,44,54,0.2)',
        borderColor: 'rgba(255,101,104,0.3)'
    };
    const styleOrange: React.CSSProperties = {
        ...btnBase,
        color: '#fff',
        backgroundColor: 'rgba(254,110,0,0.2)',
        borderColor: 'rgba(255,139,26,0.3)'
    };

    if (isDealer) {
        return (
            <div className="w-full">
                <div
                    className="rounded-2xl shadow-2xl"
                    style={{ backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: 24, backdropFilter: 'blur(12px)' }}
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
                            style={styleGreen}
                            className="transition-all duration-200 hover:scale-105 shadow-2xl"
                        >
                            {isJoinable ? 'Start Game' : 'Reset Table'}
                        </Button>

                        {onRandomCard && (
                            <Button
                                onClick={onRandomCard}
                                disabled={isLoading || isJoinable || !isDealerTurn}
                                style={stylePurple}
                                className="transition-all duration-200 hover:scale-105 shadow-2xl"
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
                    style={styleRed}
                    className="transition-all duration-200 hover:scale-105 min-w-[140px] shadow-2xl flex items-center gap-2"
                >
                    <Hand className="w-4 h-4" />
                    {isLoading ? '...' : 'Fold'}
                </Button>

                {/* Center - Check/Call */}
                <Button
                    onClick={() => onAction('CHECK')}
                    disabled={isLoading}
                    style={styleGreen}
                    className="transition-all duration-200 hover:scale-105 min-w-[160px] shadow-2xl flex items-center gap-2 px-10 py-4 rounded-2xl"
                >
                    <CheckCircle className="w-4 h-4" />
                    {isLoading ? '...' : 'Check'}
                </Button>

                {/* Right Side - Raise */}
                {onRaise && (
                    <Button
                        onClick={onRaise}
                        disabled={isLoading}
                        style={styleOrange}
                        className="transition-all duration-200 hover:scale-105 min-w-[140px] shadow-2xl flex items-center gap-2 px-8 py-4 rounded-2xl"
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