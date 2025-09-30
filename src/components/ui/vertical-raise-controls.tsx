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
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 500,
                        padding: '4px 8px',
                        borderRadius: 8,
                        border: '1px solid rgba(48,128,255,0.5)',
                        backgroundColor: 'rgba(48,128,255,0.2)',
                        color: '#fff',
                        backdropFilter: 'blur(8px)'
                    }}
                    className="flex items-center gap-1 text-xs flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Target className="w-3 h-3" />
                    ½ Pot
                </Button>

                {/* Full Pot Button */}
                <Button
                    onClick={handleFullPot}
                    disabled={isLoading || isFullPotDisabled}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 500,
                        padding: '4px 8px',
                        borderRadius: 8,
                        border: '1px solid rgba(192,126,255,0.5)',
                        backgroundColor: 'rgba(172,75,255,0.2)',
                        color: '#fff',
                        backdropFilter: 'blur(8px)'
                    }}
                    className="flex items-center gap-1 text-xs flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Zap className="w-3 h-3" />
                    Pot
                </Button>

                {/* All In Button */}
                <Button
                    onClick={handleAllIn}
                    disabled={isLoading || isAllInDisabled}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 500,
                        padding: '4px 8px',
                        borderRadius: 8,
                        border: '1px solid rgba(250,200,0,0.5)',
                        backgroundColor: 'rgba(237,178,0,0.2)',
                        color: '#fff',
                        backdropFilter: 'blur(8px)'
                    }}
                    className="flex items-center gap-1 text-xs flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                className="w-full"
                                trackStyle={{ backgroundColor: 'rgba(63,63,70,0.5)' }}
                                rangeStyle={{ backgroundColor: 'rgb(249,115,22)' }}
                                thumbStyle={{ backgroundColor: 'rgb(251,146,60)', borderColor: 'rgb(253,186,116)' }}
                            />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent
                        side="top"
                        className="text-white"
                        style={{ backgroundColor: 'rgba(24,24,27,0.95)', border: '1px solid rgb(63,63,70)' }}
                    >
                        <p className="font-medium">${raiseAmount}</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
}
