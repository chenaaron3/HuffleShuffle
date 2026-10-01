import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useLiveBlindState } from '~/hooks/use-live-blind-state';
import { useBlinds, useTotalPot } from '~/hooks/use-table-selectors';
import { cn } from '~/lib/utils';

import { RollingNumber } from '~/components/table/chips/chip-animations';

interface PotAndBlindsDisplayProps {
    className?: string;
    compact?: boolean;
    hideTimer?: boolean;
}

function formatTimeRemaining(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PotAndBlindsDisplay({
    className,
    compact = false,
    hideTimer = false,
}: PotAndBlindsDisplayProps) {
    // Get data from Zustand store using selectors
    const potTotal = useTotalPot() ?? 0;
    const blinds = useBlinds();
    const liveBlindState = useLiveBlindState();

    const displaySmallBlind = liveBlindState.effectiveSmallBlind;
    const displayBigBlind = liveBlindState.effectiveBigBlind;
    const secondsUntilNextIncrease = liveBlindState.secondsUntilNextIncrease;
    const progressPercent = liveBlindState.progressPercent;
    const isAtMaxMultiplier = liveBlindState.isAtMaxMultiplier;
    const blindTimerVisible =
        !hideTimer && (Boolean(blinds?.startedAt) || Boolean(blinds?.isPaused));

    return (
        <motion.div
            className={cn(
                "relative flex flex-col bg-zinc-900/95 backdrop-blur-sm shadow-2xl border border-zinc-500/50 overflow-hidden transition-all duration-300 ease-in-out",
                compact ? "rounded-lg" : "rounded-xl",
                className
            )}
            layout
        >
            <div className={cn('relative z-10 flex flex-col items-end', compact ? 'min-w-[88px]' : 'min-w-[140px]')}>
                {/* Pot Section */}
                <div className={cn('flex w-full flex-col items-center', compact ? 'px-2.5 pt-1 pb-0.5' : 'px-5 pt-2 pb-1')}>
                    <RollingNumber
                        value={potTotal}
                        className={cn('font-bold text-zinc-100', compact ? 'text-sm' : 'text-xl')}
                        prefix="$"
                    />
                    <div className={cn('uppercase tracking-wider text-zinc-400 font-medium', compact ? 'text-[8px]' : 'text-[10px]')}>
                        Pot Total
                    </div>
                </div>

                {/* Divider */}
                {blinds && (
                    <div className="w-full h-px bg-white/10" />
                )}

                {/* Blinds Section */}
                {blinds && (
                    <div className={cn('relative w-full flex flex-col items-center', compact ? 'px-2.5 py-1' : 'px-5 py-1.5')}>
                        {/* Background Progress Timer Gradient - Only in Blinds Section */}
                        {blindTimerVisible && (
                            <div
                                className="absolute inset-0 bg-emerald-900/30 pointer-events-none z-0"
                                style={{
                                    width: `${progressPercent}%`,
                                    transition: 'width 1s linear'
                                }}
                            />
                        )}

                        <div className={cn('relative z-10 flex items-center font-bold text-zinc-200', compact ? 'gap-1 text-[11px]' : 'gap-1.5 text-sm')}>
                            <span className={cn('uppercase font-bold tracking-wider text-emerald-500/80', compact ? 'text-[8px]' : 'text-[10px]')}>Blinds</span>
                            <span>{displaySmallBlind}/{displayBigBlind}</span>
                        </div>

                        {/* Always show timer while running */}
                        <AnimatePresence>
                            {blindTimerVisible && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                    animate={{ opacity: 1, height: 'auto', marginTop: 4 }}
                                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                    className="relative z-10 overflow-hidden flex flex-col items-center"
                                >
                                    <div className={cn('text-emerald-400 font-mono font-medium bg-black/40 rounded-md', compact ? 'px-1.5 py-px text-[9px]' : 'px-2 py-0.5 text-xs')}>
                                        {blinds?.isPaused
                                            ? 'Paused'
                                            : isAtMaxMultiplier
                                              ? 'Max blinds'
                                              : `Up in ${formatTimeRemaining(secondsUntilNextIncrease)}`}
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
