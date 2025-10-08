import { AnimatePresence, motion } from 'framer-motion';
import { Coins, Target, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { RollingNumber } from '~/components/ui/chip-animations';
import { Slider } from '~/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';

interface VerticalRaiseControlsProps {
    isLoading?: boolean;
    potTotal?: number;
    playerBalance?: number;
    bigBlind?: number;
    minRaise: number;
    raiseAmount: number;
    onRaiseAmountChange: (amount: number) => void;
}

export function VerticalRaiseControls({
    isLoading = false,
    potTotal = 0,
    playerBalance = 1000,
    bigBlind = 20,
    minRaise,
    raiseAmount,
    onRaiseAmountChange
}: VerticalRaiseControlsProps) {
    const allIn = playerBalance;
    const halfPot = Math.floor(potTotal / 2);
    const fullPot = potTotal;

    const handleAllIn = () => {
        onRaiseAmountChange(allIn);
    };

    const handleHalfPot = () => {
        onRaiseAmountChange(halfPot);
    };

    const handleFullPot = () => {
        onRaiseAmountChange(fullPot);
    };

    // Check if options are below minimum allowed bet
    const isHalfPotDisabled = halfPot < minRaise;
    const isFullPotDisabled = fullPot < minRaise;
    const isAllInDisabled = allIn < minRaise;

    return (
        <motion.div
            key="raise-controls"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24, mass: 0.7 }}
            className="rounded-xl shadow-2xl w-64 bg-black/20 border border-white/10 p-3 backdrop-blur flex flex-col gap-3"
        >
            {/* Quick Action Buttons - Top */}
            <div className="flex gap-1.5 w-full">
                {/* Half Pot Button */}
                <Button
                    onClick={handleHalfPot}
                    disabled={isLoading || isHalfPotDisabled}
                    className="inline-flex items-center gap-1 text-xs flex-1 disabled:opacity-50 disabled:cursor-not-allowed justify-center font-medium px-2 py-1 rounded-lg border text-white backdrop-blur transition-all duration-200 hover:scale-105 bg-blue-500/70 hover:bg-blue-500/80 border-blue-300/80"
                >
                    <Target className="w-3 h-3" />
                    ½ Pot
                </Button>

                {/* Full Pot Button */}
                <Button
                    onClick={handleFullPot}
                    disabled={isLoading || isFullPotDisabled}
                    className="inline-flex items-center gap-1 text-xs flex-1 disabled:opacity-50 disabled:cursor-not-allowed justify-center font-medium px-2 py-1 rounded-lg border text-white backdrop-blur transition-all duration-200 hover:scale-105 bg-purple-500/70 hover:bg-purple-500/80 border-purple-300/80"
                >
                    <Zap className="w-3 h-3" />
                    Pot
                </Button>

                {/* All In Button */}
                <Button
                    onClick={handleAllIn}
                    disabled={isLoading || isAllInDisabled}
                    className="inline-flex items-center gap-1 text-xs flex-1 disabled:opacity-50 disabled:cursor-not-allowed justify-center font-medium px-2 py-1 rounded-lg border text-white backdrop-blur transition-all duration-200 hover:scale-105 bg-yellow-500/70 hover:bg-yellow-500/80 border-yellow-300/80"
                >
                    <Coins className="w-3 h-3" />
                    All In
                </Button>
            </div>

            {/* Horizontal Slider with Official Tooltip */}
            <div className="w-full space-y-3">
                {/* Min/Max Labels */}
                <div className="flex justify-between w-full text-xs text-white/60">
                    <span>${minRaise}</span>
                    <span>${playerBalance}</span>
                </div>

                {/* Slider with Always Visible Tooltip */}
                <Tooltip open={true}>
                    <TooltipTrigger asChild>
                        <div className="w-full">
                            <Slider
                                value={[raiseAmount]}
                                onValueChange={(value) => onRaiseAmountChange(value[0] ?? 0)}
                                max={playerBalance}
                                min={minRaise}
                                step={bigBlind}
                                orientation="horizontal"
                                className="w-full [&_[data-slot=slider-track]]:bg-zinc-800/70 [&_[data-slot=slider-range]]:bg-orange-500/90 [&_[data-slot=slider-thumb]]:bg-orange-400 [&_[data-slot=slider-thumb]]:border-orange-300 [&_[data-slot=slider-thumb]]:ring-2 [&_[data-slot=slider-thumb]]:ring-orange-300 [&_[data-slot=slider-thumb]]:drop-shadow-[0_0_12px_rgba(249,115,22,0.85)] [&_[data-slot=slider-thumb]]:transition-shadow"
                            />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent
                        side="top"
                        className="text-white bg-zinc-900/95 border border-zinc-700"
                    >
                        <p className="font-medium">${raiseAmount}</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </motion.div>
    );
}
