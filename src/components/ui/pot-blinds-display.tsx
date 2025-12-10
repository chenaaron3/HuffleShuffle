import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useLiveBlindState } from '~/hooks/use-live-blind-state';
import { cn } from '~/lib/utils';

import { RollingNumber } from './chip-animations';

import type { BlindState } from '~/server/api/blind-timer';

interface PotAndBlindsDisplayProps {
    potTotal: number;
    blinds?: BlindState;
    className?: string;
}

function formatTimeRemaining(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PotAndBlindsDisplay({ potTotal, blinds, className }: PotAndBlindsDisplayProps) {
    const [isHovered, setIsHovered] = React.useState(false);
    const liveBlindState = useLiveBlindState();

    const displaySmallBlind = liveBlindState.effectiveSmallBlind;
    const displayBigBlind = liveBlindState.effectiveBigBlind;
    const secondsUntilNextIncrease = liveBlindState.secondsUntilNextIncrease;
    const progressPercent = liveBlindState.progressPercent;
    const isTimerRunning = Boolean(blinds?.startedAt);

    return (
        <motion.div
            className={cn(
                "relative flex flex-col bg-zinc-900/95 backdrop-blur-sm rounded-xl shadow-2xl border border-zinc-500/50 overflow-hidden transition-all duration-300 ease-in-out",
                className
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            layout
        >
            <div className="relative z-10 flex flex-col items-end min-w-[140px]">
                {/* Pot Section */}
                <div className="flex flex-col items-center w-full px-5 pt-2 pb-1">
                    <RollingNumber
                        value={potTotal}
                        className="text-xl font-bold text-zinc-100"
                        prefix="$"
                    />
                    <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
                        Pot Total
                    </div>
                </div>

                {/* Divider */}
                {blinds && (
                    <div className="w-full h-px bg-white/10" />
                )}

                {/* Blinds Section */}
                {blinds && (
                    <div className="relative w-full flex flex-col items-center px-5 py-1.5">
                        {/* Background Progress Timer Gradient - Only in Blinds Section */}
                        {isTimerRunning && (
                            <div
                                className="absolute inset-0 bg-emerald-900/30 pointer-events-none z-0"
                                style={{
                                    width: `${progressPercent}%`,
                                    transition: 'width 1s linear'
                                }}
                            />
                        )}

                        <div className="relative z-10 flex items-center gap-1.5 text-sm font-bold text-zinc-200">
                            <span className="text-emerald-500/80 text-[10px] uppercase font-bold tracking-wider">Blinds</span>
                            <span>{displaySmallBlind}/{displayBigBlind}</span>
                        </div>

                        {/* Expanded Timer View on Hover */}
                        <AnimatePresence>
                            {isHovered && isTimerRunning && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                    animate={{ opacity: 1, height: 'auto', marginTop: 4 }}
                                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                    className="relative z-10 overflow-hidden flex flex-col items-center"
                                >
                                    <div className="text-emerald-400 font-mono text-xs font-medium bg-black/40 px-2 py-0.5 rounded-md">
                                        2x in {formatTimeRemaining(secondsUntilNextIncrease)}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
