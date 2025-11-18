import { AnimatePresence, motion } from 'framer-motion';
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

    const dealerView = (
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
                        className="transition-all duration-200 hover:scale-105 hover:bg-green-600/80 shadow-2xl inline-flex items-center justify-center font-semibold px-8 py-3 rounded-xl border text-white bg-green-600/70 border-green-300/80 backdrop-blur"
                    >
                        {isJoinable ? 'Start Game' : 'Reset Table'}
                    </Button>

                    {onRandomCard && (
                        <Button
                            onClick={onRandomCard}
                            disabled={isLoading || (!isJoinable && !isDealerTurn)}
                            className="transition-all duration-200 hover:scale-105 hover:bg-purple-500/80 shadow-2xl inline-flex items-center justify-center font-semibold px-8 py-3 rounded-xl border text-white bg-purple-500/70 border-purple-300/80 backdrop-blur"
                        >
                            {isLoading ? 'Dealing...' : 'Deal Random'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );

    const playerView = <></>;
    // (
    //     <div className="w-full">
    //         {/* Main Action Buttons in FanDuel-style overlay */}
    //         <div className="relative flex items-center justify-center gap-4 rounded-2xl shadow-2xl bg-black/25 border border-white/10 p-3 backdrop-blur">
    //             {/* Left Side - Negative Actions */}
    //             <Button
    //                 onClick={() => onAction('FOLD')}
    //                 disabled={isLoading}
    //                 className="transition-all duration-200 hover:scale-105 hover:bg-red-600/80 min-w-[140px] shadow-2xl flex items-center gap-2  px-10 py-4 rounded-2xl border text-white font-semibold bg-red-600/70 border-red-300/80 backdrop-blur"
    //             >
    //                 <Hand className="w-4 h-4" />
    //                 {isLoading ? '...' : 'Fold'}
    //             </Button>

    //             {/* Center - Check/Call */}
    //             <Button
    //                 onClick={() => onAction('CHECK')}
    //                 disabled={isLoading}
    //                 className="transition-all duration-200 hover:scale-105 hover:bg-green-600/80 min-w-[160px] shadow-2xl flex items-center gap-2 px-10 py-4 rounded-2xl border text-white font-semibold bg-green-600/70 border-green-300/80 backdrop-blur"
    //             >
    //                 <CheckCircle className="w-4 h-4" />
    //                 {isLoading ? '...' : (maxBet ? 'Call' : 'Check')}
    //             </Button>

    //             {/* Right Side - Raise */}
    //             {onRaise && (
    //                 <Button
    //                     onClick={onRaise}
    //                     disabled={isLoading}
    //                     className="transition-all duration-200 hover:scale-105 hover:bg-orange-500/80 min-w-[140px] shadow-2xl flex items-center gap-2 px-8 py-4 rounded-2xl border text-white font-semibold bg-orange-500/70 border-orange-300/80 backdrop-blur"
    //                 >
    //                     <TrendingUp className="w-4 h-4" />
    //                     {isLoading ? '...' : (
    //                         <>
    //                             Raise to <RollingNumber value={raiseAmount} prefix="$" className="font-semibold" />
    //                         </>
    //                     )}
    //                 </Button>
    //             )}
    //         </div>
    //     </div>
    // );

    return (
        <motion.div
            key={isDealer ? 'dealer' : 'player'}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24, mass: 0.7 }}
        >
            {isDealer ? dealerView : playerView}
        </motion.div>
    );
}