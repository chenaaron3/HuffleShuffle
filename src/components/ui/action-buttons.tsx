import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';

type GameAction = "RESET_TABLE" | "START_GAME" | "DEAL_CARD";

interface ActionButtonsProps {
    isJoinable: boolean;
    state?: string;
    isLoading?: boolean;
    onAction: (action: GameAction, params?: any) => void;
    onRandomCard?: () => void;
}

export function ActionButtons({
    isJoinable,
    state,
    isLoading = false,
    onAction,
    onRandomCard,
}: ActionButtonsProps) {
    const [autoDeal, setAutoDeal] = useState<boolean>(false);

    const isDealerTurn = state ? ['DEAL_HOLE_CARDS', 'DEAL_FLOP', 'DEAL_TURN', 'DEAL_RIVER', 'SHOWDOWN'].includes(state) : false;

    // Auto-deal: run onRandomCard every second when enabled and it's dealer's turn
    useEffect(() => {
        if (!autoDeal || !isDealerTurn || !onRandomCard) {
            return;
        }

        const interval = setInterval(() => {
            if (!isLoading) {
                onRandomCard();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [autoDeal, isDealerTurn, onRandomCard, isLoading]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24, mass: 0.7 }}
            className="w-full"
        >
            <div className="rounded-2xl shadow-2xl bg-black/20 border border-white/10 p-6 backdrop-blur-md">
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

                    {/* Auto-Deal Toggle */}
                    {onRandomCard && (
                        <label className="inline-flex items-center gap-2 text-white/80 font-medium cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoDeal}
                                onChange={(e) => setAutoDeal(e.target.checked)}
                                disabled={isLoading}
                                className="w-4 h-4 rounded border-white/30 bg-white/10 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                            />
                            Auto-Deal
                        </label>
                    )}
                </div>
            </div>
        </motion.div>
    );
}