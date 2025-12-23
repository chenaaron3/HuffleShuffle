import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { Chart } from 'react-google-charts';
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

    // Build Sankey data for Google Charts
    // Format: [['From', 'To', 'Weight'], ...]
    // Structure: Side Pots (left) -> Players (right)
    const sankeyData: Array<[string, string, number] | [string, string, string]> = [
        ['From', 'To', 'Weight'],
    ];

    // Get all unique players (winners only for right side)
    const winnerPlayerIds = new Set<string>();
    sidePots.forEach((pot) => {
        pot.winners.forEach((w) => winnerPlayerIds.add(w.seatId));
    });

    // Add flows: Side Pots -> Players (winnings only)
    // This avoids cycles by having pots on left and players on right
    sidePots.forEach((pot) => {
        const potName = pot.potNumber === 0 ? 'Main Pot' : `Side Pot ${pot.potNumber}`;
        pot.winners.forEach((winner) => {
            const playerName = getSeatName(winner.seatId, seats);
            // Ensure we don't create duplicate flows (aggregate if same pot->player exists)
            sankeyData.push([potName, playerName, winner.amount]);
        });
    });

    // Calculate chart height based on number of pots and players
    const chartHeight = Math.max(
        400,
        Math.min(800, Math.max(sidePots.length, winnerPlayerIds.size) * 60 + 100)
    );

    // Chart options
    const chartOptions = {
        sankey: {
            node: {
                colors: ['#3b82f6', '#22c55e', '#71717a'], // Blue, Green, Gray
                label: {
                    fontName: 'Inter, system-ui, sans-serif',
                    fontSize: 12,
                    color: '#f4f4f5',
                    bold: true,
                },
                nodePadding: 20,
                width: 15,
            },
            link: {
                colorMode: 'gradient',
                colors: ['#22c55e'], // Green for winnings
                color: {
                    fill: '#22c55e',
                    fillOpacity: 0.7,
                },
            },
            tooltip: {
                textStyle: {
                    fontName: 'Inter, system-ui, sans-serif',
                    fontSize: 11,
                },
            },
        },
        backgroundColor: 'transparent',
        chartArea: {
            left: 20,
            top: 20,
            right: 20,
            bottom: 20,
            width: '90%',
            height: '90%',
        },
        height: chartHeight,
        width: 800,
    };

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
                        Side Pot Flow
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
                            <div className="relative bg-zinc-800/30 rounded-lg p-4">
                                <Chart
                                    chartType="Sankey"
                                    data={sankeyData}
                                    options={chartOptions}
                                    width="100%"
                                    height={chartHeight}
                                />

                                {/* Legend */}
                                <div className="mt-4 flex items-center justify-center gap-6 text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-3 rounded bg-emerald-500/70" />
                                        <span className="text-zinc-400">Pot Distribution</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
