import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useGameState, useOriginalSeats, useSidePotDetails } from '~/hooks/use-table-selectors';
import { cn } from '~/lib/utils';

import { SidePotChart } from './side-pot-chart';

interface SidePotDetailsProps {
    className?: string;
}

export function SidePotDetails({ className }: SidePotDetailsProps) {
    const gameState = useGameState();
    const sidePots = useSidePotDetails();
    const seats = useOriginalSeats();
    const [isExpanded, setIsExpanded] = React.useState(false);

    // Only show during showdown or after game ends
    if (gameState !== 'SHOWDOWN' || sidePots.length === 0) {
        return null;
    }

    return (
        <motion.div
            className={cn(
                "relative bg-zinc-900/95 backdrop-blur-sm rounded-xl shadow-2xl border border-zinc-500/50 transition-all duration-300 flex flex-col",
                isExpanded ? "w-full flex-1 min-h-0" : "h-fit",
                className,
            )}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            {/* Header - Always visible */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-800/50 transition-colors cursor-pointer shrink-0"
            >
                <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-zinc-100">
                        Side Pots
                    </div>
                </div>
                <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-zinc-400 text-xs"
                >
                    ▼
                </motion.div>
            </button>

            {/* Expandable Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1, flex: 1 }}
                        exit={{ height: 0, opacity: 0, flex: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-auto pointer-events-auto min-h-0 flex flex-col"
                    >
                        <SidePotChart sidePots={sidePots} seats={seats} />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
