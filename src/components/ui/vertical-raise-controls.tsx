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
        <div className="flex flex-col gap-3 w-full">
            {/* Quick Action Buttons - Top */}
            <div className="flex gap-1.5 w-full">
                {/* Half Pot Button */}
                <Button
                    onClick={handleHalfPot}
                    disabled={isLoading || isHalfPotDisabled}
                    className="inline-flex items-center gap-1 text-xs flex-1 disabled:opacity-50 disabled:cursor-not-allowed justify-center font-medium px-2 py-1 rounded-lg border border-blue-400/50 bg-blue-500/20 text-white backdrop-blur"
                >
                    <Target className="w-3 h-3" />
                    ½ Pot
                </Button>

                {/* Full Pot Button */}
                <Button
                    onClick={handleFullPot}
                    disabled={isLoading || isFullPotDisabled}
                    className="inline-flex items-center gap-1 text-xs flex-1 disabled:opacity-50 disabled:cursor-not-allowed justify-center font-medium px-2 py-1 rounded-lg border border-purple-400/50 bg-purple-500/20 text-white backdrop-blur"
                >
                    <Zap className="w-3 h-3" />
                    Pot
                </Button>

                {/* All In Button */}
                <Button
                    onClick={handleAllIn}
                    disabled={isLoading || isAllInDisabled}
                    className="inline-flex items-center gap-1 text-xs flex-1 disabled:opacity-50 disabled:cursor-not-allowed justify-center font-medium px-2 py-1 rounded-lg border border-yellow-400/50 bg-yellow-500/20 text-white backdrop-blur"
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
                                className="w-full [&_[data-slot=slider-track]]:bg-zinc-700/50 [&_[data-slot=slider-range]]:bg-orange-500 [&_[data-slot=slider-thumb]]:bg-orange-400 [&_[data-slot=slider-thumb]]:border-orange-300"
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
        </div>
    );
}
