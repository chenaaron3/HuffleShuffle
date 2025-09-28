import { Coins, Target, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { RollingNumber } from '~/components/ui/chip-animations';
import { Slider } from '~/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';

interface VerticalRaiseControlsProps {
    isLoading?: boolean;
    potTotal?: number;
    currentBet?: number;
    playerBalance?: number;
    bigBlind?: number;
    maxBet?: number;
    raiseAmount: number;
    onRaiseAmountChange: (amount: number) => void;
}

export function VerticalRaiseControls({
    isLoading = false,
    potTotal = 0,
    currentBet = 0,
    playerBalance = 1000,
    bigBlind = 20,
    maxBet = 0,
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
    const isHalfPotDisabled = halfPot < maxBet;
    const isFullPotDisabled = fullPot < maxBet;
    const isAllInDisabled = allIn < maxBet;

    return (
        <div className="flex flex-col gap-3 w-full">
            {/* Quick Action Buttons - Top */}
            <div className="flex gap-1.5 w-full">
                {/* Half Pot Button */}
                <Button
                    onClick={handleHalfPot}
                    disabled={isLoading || isHalfPotDisabled}
                    className="bg-blue-500/20 hover:bg-blue-500/30 backdrop-blur-md text-white font-medium px-2 py-1 rounded-md border border-blue-400/30 hover:border-blue-400/50 flex items-center gap-1 text-xs flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Target className="w-3 h-3" />
                    ½ Pot
                </Button>

                {/* Full Pot Button */}
                <Button
                    onClick={handleFullPot}
                    disabled={isLoading || isFullPotDisabled}
                    className="bg-purple-500/20 hover:bg-purple-500/30 backdrop-blur-md text-white font-medium px-2 py-1 rounded-md border border-purple-400/30 hover:border-purple-400/50 flex items-center gap-1 text-xs flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Zap className="w-3 h-3" />
                    Pot
                </Button>

                {/* All In Button */}
                <Button
                    onClick={handleAllIn}
                    disabled={isLoading || isAllInDisabled}
                    className="bg-yellow-500/20 hover:bg-yellow-500/30 backdrop-blur-md text-white font-medium px-2 py-1 rounded-md border border-yellow-400/30 hover:border-yellow-400/50 flex items-center gap-1 text-xs flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Coins className="w-3 h-3" />
                    All In
                </Button>
            </div>

            {/* Horizontal Slider with Official Tooltip */}
            <div className="w-full space-y-3">
                {/* Min/Max Labels */}
                <div className="flex justify-between w-full text-xs text-white/60">
                    <span>${maxBet}</span>
                    <span>${playerBalance}</span>
                </div>

                {/* Slider with Always Visible Tooltip */}
                <Tooltip open={true}>
                    <TooltipTrigger asChild>
                        <div className="w-full">
                            <Slider
                                value={[raiseAmount]}
                                onValueChange={(value) => onRaiseAmountChange(value[0] ?? maxBet)}
                                max={playerBalance}
                                min={maxBet}
                                step={bigBlind}
                                orientation="horizontal"
                                className="w-full [&_[data-slot=slider-track]]:bg-zinc-700/50 [&_[data-slot=slider-range]]:bg-orange-500 [&_[data-slot=slider-thumb]]:bg-orange-400 [&_[data-slot=slider-thumb]]:border-orange-300 [&_[data-slot=slider-thumb]]:hover:bg-orange-300 [&_[data-slot=slider-thumb]]:hover:scale-110"
                            />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-zinc-900/95 text-white border-zinc-700">
                        <p className="font-medium"><RollingNumber value={raiseAmount} prefix="$" /></p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
}
