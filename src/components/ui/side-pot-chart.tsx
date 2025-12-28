import * as React from 'react';
import {
    Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';

import type { SeatWithPlayer } from '~/server/api/routers/table';

type SidePotDetail = {
    potNumber: number;
    amount: number;
    betLevelRange: { min: number; max: number };
    contributors: Array<{ seatId: string; contribution: number }>;
    eligibleSeatIds: string[];
    winners: Array<{ seatId: string; amount: number }>;
};

interface SidePotChartProps {
    sidePots: SidePotDetail[];
    seats: SeatWithPlayer[];
}

function getSeatName(seatId: string, seats: SeatWithPlayer[]): string {
    const seat = seats.find((s) => s.id === seatId);
    return seat?.player?.name ?? `Seat ${(seat?.seatNumber ?? -1) + 1}`;
}

// Transform side pot data into recharts format
function transformSidePotData(
    sidePots: SidePotDetail[],
    seats: SeatWithPlayer[],
): {
    chartData: Array<Record<string, string | number>>;
    potBoundaries: number[];
    potAmounts: Array<{ value: number; position: number }>;
} {
    // Get all unique contributors across all pots
    const allContributorIds = new Set<string>();
    sidePots.forEach((pot) => {
        pot.contributors.forEach((contributor) => {
            allContributorIds.add(contributor.seatId);
        });
    });

    // Sort pots by potNumber to ensure correct stacking order
    const sortedPots = [...sidePots].sort((a, b) => a.potNumber - b.potNumber);

    // Initialize all pot keys for all players first
    const allPotKeys: string[] = [];
    sortedPots.forEach((pot) => {
        const potKey = `pot${pot.potNumber}`;
        allPotKeys.push(`${potKey}_winner`);
        allPotKeys.push(`${potKey}_nonwinner`);
    });

    // Create data point for each contributor
    const chartData: Array<Record<string, string | number>> = Array.from(
        allContributorIds,
    ).map((seatId) => {
        const dataPoint: Record<string, string | number> = {
            player: getSeatName(seatId, seats),
            seatId,
        };

        // Initialize all pot keys to 0 first
        allPotKeys.forEach((key) => {
            dataPoint[key] = 0;
        });

        // For each pot, add contribution amount
        // Stack pots in order: Main Pot (pot0) first, then Side Pot 1, 2, etc.
        sortedPots.forEach((pot) => {
            const contributor = pot.contributors.find((c) => c.seatId === seatId);
            const contribution = contributor?.contribution ?? 0;
            const isWinner = pot.winners.some((w) => w.seatId === seatId);

            // Create separate keys for winner and non-winner segments
            // Format: pot0_winner, pot0_nonwinner, pot1_winner, etc.
            const potKey = `pot${pot.potNumber}`;
            const winnerKey = `${potKey}_winner`;
            const nonWinnerKey = `${potKey}_nonwinner`;

            if (contribution > 0) {
                if (isWinner) {
                    dataPoint[winnerKey] = contribution;
                    dataPoint[nonWinnerKey] = 0;
                } else {
                    dataPoint[winnerKey] = 0;
                    dataPoint[nonWinnerKey] = contribution;
                }
            }
        });

        return dataPoint;
    });

    // Calculate pot boundaries for left Y-axis (cumulative bet levels)
    const potBoundaries: number[] = [0];
    sortedPots.forEach((pot) => {
        potBoundaries.push(pot.betLevelRange.max);
    });

    // Calculate pot amounts and their positions for right Y-axis labels
    const potAmounts: Array<{ value: number; position: number }> = [];
    sortedPots.forEach((pot, index) => {
        // Position is the middle of the pot section
        const minBoundary = pot.betLevelRange.min;
        const maxBoundary = pot.betLevelRange.max;
        const position = (minBoundary + maxBoundary) / 2;
        potAmounts.push({ value: pot.amount, position });
    });

    return { chartData, potBoundaries, potAmounts };
}

export function SidePotChart({ sidePots, seats }: SidePotChartProps) {
    const { chartData, potBoundaries, potAmounts } = transformSidePotData(
        sidePots,
        seats,
    );

    // Sort pots by potNumber
    const sortedPots = [...sidePots].sort((a, b) => a.potNumber - b.potNumber);

    // Get max Y value for scaling
    const maxYValue = Math.max(...potBoundaries);

    // Generate colors for each pot
    const potColors = sortedPots.map((pot, index) => {
        // Use yellow for winners, uniform gray for non-winners
        // Different shades of yellow for different pots to distinguish them
        const winnerColor = index === 0 ? '#eab308' : '#fbbf24'; // yellow-500 or yellow-400
        const nonWinnerColor = '#3f3f46'; // zinc-700 - consistent gray for all pots
        return { winnerColor, nonWinnerColor };
    });

    // Debug: Log chart data to see what we're working with
    if (chartData.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm">
                No data to display
            </div>
        );
    }

    // Calculate height based on number of players (min 50px per player, max 600px)
    const playerCount = chartData.length;
    const minHeightPerPlayer = 50;

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 20, right: 80, bottom: 60, left: 100 }}
                barCategoryGap="10%"
                barGap={0}
            >
                <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#3f3f46"
                    opacity={0.3}
                />
                <XAxis
                    type="number"
                    domain={[0, maxYValue]}
                    ticks={potBoundaries}
                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                    tickLine={{ stroke: '#71717a' }}
                    axisLine={{ stroke: '#71717a' }}
                    label={{
                        value: 'Bet Level',
                        position: 'insideBottom',
                        offset: -5,
                        style: { fill: '#a1a1aa', fontSize: 12 },
                    }}
                />
                <YAxis
                    type="category"
                    dataKey="player"
                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                    tickLine={{ stroke: '#71717a' }}
                    axisLine={{ stroke: '#71717a' }}
                    width={90}
                />
                <Tooltip
                    content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;

                        return (
                            <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl">
                                <p className="text-zinc-400 text-xs mb-2">{label}</p>
                                {payload.map((entry: any) => {
                                    // Skip zero values
                                    if (entry.value === 0) return null;

                                    const name = entry.name;
                                    const color = entry.color;

                                    // Extract pot number
                                    const match = name.match(/pot(\d+)_(winner|nonwinner)/);
                                    if (!match) return null;

                                    const potNum = parseInt(match[1] ?? '0', 10);
                                    const potName = potNum === 0 ? 'Main Pot' : `Side Pot ${potNum}`;

                                    // Get the actual pot data to find the win amount
                                    const pot = sortedPots.find(p => p.potNumber === potNum);
                                    const seatId = entry.payload.seatId;

                                    // Check if this player is a winner for this pot
                                    const winnerInfo = pot?.winners.find(w => w.seatId === seatId);

                                    // If winner, show their win amount. Otherwise show 0 (lost the pot)
                                    const displayValue = winnerInfo ? winnerInfo.amount : 0;

                                    return (
                                        <div key={name} className="flex items-center gap-2 text-sm mb-1">
                                            <div
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: color }}
                                            />
                                            <span className="text-zinc-300">
                                                {potName}:
                                            </span>
                                            <span className="font-semibold text-zinc-100">
                                                ${displayValue}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    }}
                />
                {/* Reference lines for pot boundaries - vertical lines */}
                {potBoundaries.map((boundary, index) => {
                    if (index === 0) return null; // Skip 0 boundary
                    return (
                        <ReferenceLine
                            key={`boundary-${boundary}`}
                            x={boundary}
                            stroke="#71717a"
                            strokeDasharray="2 2"
                            strokeWidth={1}
                            opacity={0.5}
                        />
                    );
                })}
                {/* Stacked bars for each pot - stack all pots together */}
                {/* IMPORTANT: Render bars in the order they should stack */}
                {/* For horizontal bars (layout="vertical"), bars stack from left to right */}
                {sortedPots.flatMap((pot, index) => {
                    const potKey = `pot${pot.potNumber}`;
                    const winnerKey = `${potKey}_winner`;
                    const nonWinnerKey = `${potKey}_nonwinner`;
                    const colors = potColors[index];
                    if (!colors) return [];

                    // Return array of bars directly (no Fragment) to ensure Recharts can see them
                    return [
                        // Non-winner segment (gray) - base layer, renders first
                        <Bar
                            key={`${potKey}_nonwinner`}
                            dataKey={nonWinnerKey}
                            stackId="allPots"
                            fill={colors.nonWinnerColor}
                            radius={index === sortedPots.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]}
                            stroke={colors.nonWinnerColor}
                            strokeWidth={1}
                        />,
                        // Winner segment (yellow) - renders on top of non-winner
                        <Bar
                            key={`${potKey}_winner`}
                            dataKey={winnerKey}
                            stackId="allPots"
                            fill={colors.winnerColor}
                            radius={index === sortedPots.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]}
                            stroke={colors.winnerColor}
                            strokeWidth={1}
                        />
                    ];
                })}
            </BarChart>
        </ResponsiveContainer>
    );
}

