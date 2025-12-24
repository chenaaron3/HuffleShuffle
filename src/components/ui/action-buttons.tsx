import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { useActions } from '~/hooks/use-actions';
import { useGameState, useIsJoinable } from '~/hooks/use-table-selectors';

interface ActionButtonsProps {
    // No props needed - all data comes from selectors
}

// Note: Random card selection is now handled server-side via DEAL_RANDOM action
// to ensure the dealer has access to all player hands and community cards

export function ActionButtons({ }: ActionButtonsProps) {
    const [autoDeal, setAutoDeal] = useState<boolean>(false);

    // Use actions hook
    const { mutate: performAction, isPending: isLoading } = useActions();

    // Get data from Zustand store using selectors
    const isJoinable = useIsJoinable() ?? false;
    const gameStatus = useGameState();

    const isDealerTurn = gameStatus
        ? ['DEAL_HOLE_CARDS', 'DEAL_FLOP', 'DEAL_TURN', 'DEAL_RIVER', 'SHOWDOWN'].includes(gameStatus)
        : false;

    // Callback that deals a random card via server (for manual button click)
    const dealRandomCard = useCallback(() => {
        performAction('DEAL_RANDOM');
    }, [performAction]);

    // Use a callback ref pattern to avoid restarting interval when values change
    const latestValuesRef = useRef({ performAction, isLoading });

    // Update the ref whenever dependencies change
    useEffect(() => {
        latestValuesRef.current = { performAction, isLoading };
    }, [performAction, isLoading]);

    // Auto-deal: run dealRandomCard every second when enabled and it's dealer's turn
    useEffect(() => {
        if (!autoDeal || !isDealerTurn) {
            return;
        }

        const interval = setInterval(() => {
            const { performAction, isLoading } = latestValuesRef.current;
            if (!isLoading) {
                performAction('DEAL_RANDOM');
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [autoDeal, isDealerTurn]);

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
                                performAction('START_GAME')
                            } else {
                                performAction('RESET_TABLE')
                            }
                        }}
                        disabled={isLoading}
                        className="transition-all duration-200 hover:scale-105 hover:bg-green-600/80 shadow-2xl inline-flex items-center justify-center font-semibold px-8 py-3 rounded-xl border text-white bg-green-600/70 border-green-300/80 backdrop-blur"
                    >
                        {isJoinable ? 'Start Game' : 'Reset Table'}
                    </Button>

                    <Button
                        onClick={dealRandomCard}
                        disabled={isLoading || (!isJoinable && !isDealerTurn)}
                        className="transition-all duration-200 hover:scale-105 hover:bg-purple-500/80 shadow-2xl inline-flex items-center justify-center font-semibold px-8 py-3 rounded-xl border text-white bg-purple-500/70 border-purple-300/80 backdrop-blur"
                    >
                        {isLoading ? 'Dealing...' : 'Deal Random'}
                    </Button>

                    {/* Auto-Deal Toggle */}
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
                </div>
            </div>
        </motion.div>
    );
}