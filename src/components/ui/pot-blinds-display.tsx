import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
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
    const [tick, setTick] = React.useState(0);
    const [isHovered, setIsHovered] = React.useState(false);

    const isTimerRunning = Boolean(blinds?.startedAt);
    const elapsedSeconds = blinds?.elapsedSeconds ?? 0;
    const stepSeconds = blinds?.stepSeconds ?? 0;

    // Sync local tick with timer status
    React.useEffect(() => {
        if (!isTimerRunning) {
            setTick(0);
            return;
        }
        // Reset tick if we get a fresh update from server to avoid double counting
        setTick(0);

        const interval = setInterval(() => {
            setTick((prev) => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [isTimerRunning, elapsedSeconds]);

    // Calculate timer values
    let secondsUntilNextIncrease: number | null = null;
    let progressPercent = 0;

    // Default blinds to what the server says
    let displaySmallBlind = blinds?.effectiveSmallBlind;
    let displayBigBlind = blinds?.effectiveBigBlind;

    if (blinds && stepSeconds > 0) {
        const liveElapsedSeconds = isTimerRunning ? elapsedSeconds + tick : elapsedSeconds;
        const remainder = liveElapsedSeconds % stepSeconds;
        secondsUntilNextIncrease = remainder === 0 ? stepSeconds : stepSeconds - remainder;

        // Calculate progress (0 to 100)
        progressPercent = ((stepSeconds - secondsUntilNextIncrease) / stepSeconds) * 100;

        // Calculate local blind increase
        // If we have passed the step threshold locally before server update
        const steps = Math.floor(liveElapsedSeconds / stepSeconds);
        if (steps > 0 && blinds.multiplier > 0) {
            // Derive base blinds (current / current_multiplier)
            // Note: The 'blinds' prop has the state from the last server snapshot.
            // So blinds.effectiveSmallBlind is base * blinds.multiplier
            const baseSmall = blinds.effectiveSmallBlind / blinds.multiplier;
            const baseBig = blinds.effectiveBigBlind / blinds.multiplier;

            const currentMultiplier = Math.max(1, Math.pow(2, steps));

            displaySmallBlind = Math.round(baseSmall * currentMultiplier);
            displayBigBlind = Math.round(baseBig * currentMultiplier);
        }
    }

    if (!isTimerRunning) {
        progressPercent = 0;
        secondsUntilNextIncrease = stepSeconds;
    }

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
                            {isHovered && isTimerRunning && secondsUntilNextIncrease !== null && (
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
