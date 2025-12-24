import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useGameState, useOriginalSeats, useSidePotDetails } from '~/hooks/use-table-selectors';
import { cn } from '~/lib/utils';

import type { SeatWithPlayer } from '~/server/api/routers/table';

interface SidePotDetailsProps {
    className?: string;
}

function getSeatName(seatId: string, seats: SeatWithPlayer[]): string {
    const seat = seats.find((s) => s.id === seatId);
    return seat?.player?.name ?? `Seat ${(seat?.seatNumber ?? -1) + 1}`;
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

    const totalPotAmount = sidePots.reduce((sum, pot) => sum + pot.amount, 0);

    return (
        <motion.div
            className={cn(
                "relative bg-zinc-900/95 backdrop-blur-sm rounded-xl shadow-2xl border border-zinc-500/50 overflow-hidden transition-all duration-300",
                className
            )}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            {/* Header - Always visible */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-800/50 transition-colors cursor-pointer"
            >
                <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-zinc-100">
                        Pot Breakdown
                    </div>
                    <div className="text-xs text-zinc-400">
                        {sidePots.length} pot{sidePots.length !== 1 ? 's' : ''} • ${totalPotAmount} total
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
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 border-t border-zinc-700/50 pt-4">
                            <div className="space-y-2">
                                {sidePots.map((pot, index) => {
                                    const potName = pot.potNumber === 0 ? 'Main Pot' : `Side Pot ${pot.potNumber}`;
                                    const hasWinners = pot.winners.length > 0;

                                    return (
                                        <motion.div
                                            key={pot.potNumber}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className={cn(
                                                "rounded-lg border p-3",
                                                hasWinners
                                                    ? "bg-emerald-950/30 border-emerald-500/30"
                                                    : "bg-zinc-800/50 border-zinc-700/30"
                                            )}
                                        >
                                            {/* Pot Header */}
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-zinc-100">
                                                        {potName}
                                                    </span>
                                                    <span className="text-xs text-zinc-400">
                                                        ${pot.betLevelRange.min} - ${pot.betLevelRange.max}
                                                    </span>
                                                </div>
                                                <span className={cn(
                                                    "text-base font-bold",
                                                    hasWinners ? "text-emerald-400" : "text-zinc-300"
                                                )}>
                                                    ${pot.amount}
                                                </span>
                                            </div>

                                            {/* Eligible Players */}
                                            <div className="text-xs text-zinc-400 mb-1.5">
                                                <span className="font-medium text-zinc-500">Eligible: </span>
                                                {pot.eligibleSeatIds.map((seatId, i) => {
                                                    const name = getSeatName(seatId, seats);
                                                    const isWinner = pot.winners.some((w) => w.seatId === seatId);
                                                    return (
                                                        <span key={seatId}>
                                                            {i > 0 && ', '}
                                                            <span className={cn(
                                                                isWinner ? "text-emerald-400 font-semibold" : "text-zinc-400"
                                                            )}>
                                                                {name}
                                                            </span>
                                                        </span>
                                                    );
                                                })}
                                            </div>

                                            {/* Winners */}
                                            {hasWinners && (
                                                <div className="text-xs mt-2 pt-2 border-t border-zinc-700/30">
                                                    <span className="font-medium text-emerald-400">Winners: </span>
                                                    {pot.winners.map((winner, i) => {
                                                        const name = getSeatName(winner.seatId, seats);
                                                        return (
                                                            <span key={winner.seatId}>
                                                                {i > 0 && ', '}
                                                                <span className="text-emerald-300 font-semibold">
                                                                    {name} (+${winner.amount})
                                                                </span>
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Contributors (collapsed by default, can expand) */}
                                            {pot.contributors.length > 0 && (
                                                <details className="mt-2 text-xs">
                                                    <summary className="cursor-pointer text-zinc-500 hover:text-zinc-400">
                                                        Contributors ({pot.contributors.length})
                                                    </summary>
                                                    <div className="mt-1.5 pl-2 text-zinc-400">
                                                        {pot.contributors.map((contributor, i) => {
                                                            const name = getSeatName(contributor.seatId, seats);
                                                            return (
                                                                <span key={contributor.seatId}>
                                                                    {i > 0 && ', '}
                                                                    {name} (${contributor.contribution})
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </details>
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
