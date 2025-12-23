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
                "relative bg-zinc-900/95 backdrop-blur-sm rounded-xl shadow-2xl border border-zinc-500/50 overflow-hidden transition-all duration-300 max-w-sm",
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
                        Side Pot Details
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
                        <div className="px-4 pb-4 space-y-3 border-t border-zinc-700/50">
                            {sidePots.map((pot, index) => {
                                const potName = pot.potNumber === 0 ? 'Main Pot' : `Side Pot ${pot.potNumber}`;
                                const hasWinners = pot.winners.length > 0;

                                return (
                                    <motion.div
                                        key={pot.potNumber}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/30"
                                    >
                                        {/* Pot Header */}
                                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-700/30">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-zinc-100">{potName}</span>
                                                <span className="text-sm font-bold text-emerald-400">${pot.amount}</span>
                                            </div>
                                            {hasWinners && (
                                                <div className="text-xs text-emerald-400 font-medium">
                                                    {pot.winners.length} winner{pot.winners.length !== 1 ? 's' : ''}
                                                </div>
                                            )}
                                        </div>

                                        {/* Bet Level Range */}
                                        <div className="text-xs text-zinc-400 mb-2">
                                            Bet Level: ${pot.betLevelRange.min} - ${pot.betLevelRange.max}
                                        </div>

                                        {/* Contributors */}
                                        <div className="mb-2">
                                            <div className="text-xs font-medium text-zinc-500 mb-1">Contributors:</div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {pot.contributors.map((contributor) => {
                                                    const name = getSeatName(contributor.seatId, seats);
                                                    return (
                                                        <span
                                                            key={contributor.seatId}
                                                            className="text-xs px-2 py-0.5 bg-zinc-700/50 rounded text-zinc-300"
                                                        >
                                                            {name} (${contributor.contribution})
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Eligible Players */}
                                        <div className="mb-2">
                                            <div className="text-xs font-medium text-zinc-500 mb-1">Eligible to Win:</div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {pot.eligibleSeatIds.map((seatId) => {
                                                    const name = getSeatName(seatId, seats);
                                                    const isWinner = pot.winners.some((w) => w.seatId === seatId);
                                                    return (
                                                        <span
                                                            key={seatId}
                                                            className={cn(
                                                                "text-xs px-2 py-0.5 rounded",
                                                                isWinner
                                                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                                                    : "bg-zinc-700/30 text-zinc-400"
                                                            )}
                                                        >
                                                            {name}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Winners */}
                                        {hasWinners && (
                                            <div>
                                                <div className="text-xs font-medium text-emerald-400 mb-1">Winners:</div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {pot.winners.map((winner) => {
                                                        const name = getSeatName(winner.seatId, seats);
                                                        return (
                                                            <span
                                                                key={winner.seatId}
                                                                className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded font-medium"
                                                            >
                                                                {name} +${winner.amount}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

