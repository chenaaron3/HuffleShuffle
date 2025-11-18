import { motion } from 'framer-motion';
import { Coins } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { RollingNumber } from '~/components/ui/chip-animations';
import { GlareButton } from '~/components/ui/glare-button';
import { GlowingEffect } from '~/components/ui/glowing-effect';
import { Slider } from '~/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';

interface VerticalRaiseControlsProps {
    isLoading?: boolean;
    potTotal?: number;
    playerBalance?: number;
    currentBet?: number;
    bigBlind?: number;
    minRaise: number;
    raiseAmount: number;
    onRaiseAmountChange: (amount: number) => void;
    onFold?: () => void;
    onCheck?: () => void;
    onRaise?: () => void;
    maxBet?: number;
}

export function VerticalRaiseControls({
    isLoading = false,
    potTotal = 0,
    playerBalance = 1000,
    currentBet = 0,
    bigBlind = 20,
    minRaise,
    raiseAmount,
    onRaiseAmountChange,
    onFold,
    onCheck,
    onRaise,
    maxBet
}: VerticalRaiseControlsProps) {
    const legalMaxBet = currentBet + playerBalance;
    const sliderMax = Math.max(minRaise, legalMaxBet);
    const allIn = legalMaxBet;
    const quarterPot = Math.floor(potTotal / 4);
    const halfPot = Math.floor(potTotal / 2);
    const threeQuarterPot = Math.floor((potTotal * 3) / 4);
    const fullPot = potTotal;

    const handleQuarterPot = () => {
        onRaiseAmountChange(Math.min(quarterPot, legalMaxBet));
    };

    const handleHalfPot = () => {
        onRaiseAmountChange(Math.min(halfPot, legalMaxBet));
    };

    const handleThreeQuarterPot = () => {
        onRaiseAmountChange(Math.min(threeQuarterPot, legalMaxBet));
    };

    const handleFullPot = () => {
        onRaiseAmountChange(Math.min(fullPot, legalMaxBet));
    };

    const handleAllIn = () => {
        onRaiseAmountChange(Math.min(allIn, legalMaxBet));
    };

    // Check if options are below minimum allowed bet
    const isQuarterPotDisabled = quarterPot < minRaise;
    const isHalfPotDisabled = halfPot < minRaise;
    const isThreeQuarterPotDisabled = threeQuarterPot < minRaise;
    const isFullPotDisabled = fullPot < minRaise;
    const isAllInDisabled = allIn < minRaise;

    return (
        <motion.div
            key="raise-controls"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24, mass: 0.7 }}
            className="rounded-xl shadow-2xl w-80 bg-black/20 border border-white/10 p-3 backdrop-blur flex flex-col gap-3"
        >
            {/* All In Button - Shiny Gold with Glare Effect */}
            <div className="relative w-full rounded-lg">
                <GlowingEffect disabled={false} spread={25} proximity={40} inactiveZone={0.3} borderWidth={2} className="rounded-lg" />
                <GlareButton
                    onClick={handleAllIn}
                    disabled={isLoading || isAllInDisabled}
                    className="relative inline-flex items-center justify-center gap-1.5 w-full disabled:opacity-50 disabled:cursor-not-allowed font-medium px-2 py-1 rounded-lg border-0 text-white backdrop-blur transition-all duration-200 hover:scale-105 bg-gradient-to-r from-amber-500/90 via-yellow-400/90 to-amber-500/90 hover:from-amber-500 hover:via-yellow-400 hover:to-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.5)] hover:shadow-[0_0_20px_rgba(251,191,36,0.7)]"
                >
                    <Coins className="w-3.5 h-3.5" />
                    All In
                </GlareButton>
            </div>

            {/* Horizontal Slider with Official Tooltip */}
            <div className="w-full space-y-3">
                {/* Slider with Always Visible Tooltip */}
                <Tooltip open={true}>
                    <TooltipTrigger asChild>
                        <div className="w-full">
                            <Slider
                                value={[raiseAmount]}
                                onValueChange={(value) => onRaiseAmountChange(Math.min(value[0] ?? 0, legalMaxBet))}
                                max={sliderMax}
                                min={minRaise}
                                step={bigBlind}
                                orientation="horizontal"
                                className="w-full [&_[data-slot=slider-track]]:bg-zinc-800/70 [&_[data-slot=slider-range]]:bg-orange-500/90 [&_[data-slot=slider-thumb]]:bg-orange-400 [&_[data-slot=slider-thumb]]:border-orange-300 [&_[data-slot=slider-thumb]]:ring-2 [&_[data-slot=slider-thumb]]:ring-orange-300 [&_[data-slot=slider-thumb]]:drop-shadow-[0_0_12px_rgba(249,115,22,0.85)] [&_[data-slot=slider-thumb]]:transition-shadow"
                            />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent
                        side="bottom"
                        className="text-white/80 bg-zinc-900/60 border border-zinc-700/50 text-xs py-1 px-2"
                    >
                        <p>${raiseAmount}</p>
                    </TooltipContent>
                </Tooltip>

                {/* Min/Max Labels */}
                <div className="flex justify-between w-full text-xs text-white/60">
                    <span>${minRaise}</span>
                    <span>${legalMaxBet}</span>
                </div>
            </div>

            {/* Quick Action Buttons - Two Rows */}
            <div className="flex flex-col gap-1.5 w-full">
                {/* Top Row: Pot Buttons - Heat Map Gradient */}
                <div className="flex gap-1.5 w-full">
                    {/* Quarter Pot Button - Light Yellow to Medium Yellow */}
                    <div className="relative flex-1 rounded-lg">
                        <Button
                            onClick={handleQuarterPot}
                            disabled={isLoading || isQuarterPotDisabled}
                            className="relative inline-flex items-center justify-center text-xs w-full disabled:opacity-50 disabled:cursor-not-allowed font-medium px-2 py-1 rounded-lg border-0 text-white backdrop-blur transition-all duration-200 hover:scale-105 bg-gradient-to-r from-yellow-300/70 to-yellow-500/70 hover:from-yellow-300/80 hover:to-yellow-500/80"
                        >
                            <span className="text-base">¼</span><span>Pot</span>
                        </Button>
                    </div>

                    {/* Half Pot Button - Medium Yellow to Orange */}
                    <div className="relative flex-1 rounded-lg">
                        <Button
                            onClick={handleHalfPot}
                            disabled={isLoading || isHalfPotDisabled}
                            className="relative inline-flex items-center justify-center text-xs w-full disabled:opacity-50 disabled:cursor-not-allowed font-medium px-2 py-1 rounded-lg border-0 text-white backdrop-blur transition-all duration-200 hover:scale-105 bg-gradient-to-r from-yellow-500/70 to-orange-500/70 hover:from-yellow-500/80 hover:to-orange-500/80"
                        >
                            <span className="text-base">½</span><span>Pot</span>
                        </Button>
                    </div>

                    {/* Three Quarter Pot Button - Orange to Red */}
                    <div className="relative flex-1 rounded-lg">
                        <Button
                            onClick={handleThreeQuarterPot}
                            disabled={isLoading || isThreeQuarterPotDisabled}
                            className="relative inline-flex items-center justify-center text-xs w-full disabled:opacity-50 disabled:cursor-not-allowed font-medium px-2 py-1 rounded-lg border-0 text-white backdrop-blur transition-all duration-200 hover:scale-105 bg-gradient-to-r from-orange-500/70 to-red-500/70 hover:from-orange-500/80 hover:to-red-500/80"
                        >
                            <span className="text-base">¾</span><span>Pot</span>
                        </Button>
                    </div>

                    {/* Full Pot Button - Red to Dark Red */}
                    <div className="relative flex-1 rounded-lg">
                        <Button
                            onClick={handleFullPot}
                            disabled={isLoading || isFullPotDisabled}
                            className="relative inline-flex items-center justify-center text-xs w-full disabled:opacity-50 disabled:cursor-not-allowed font-medium px-2 py-1 rounded-lg border-0 text-white backdrop-blur transition-all duration-200 hover:scale-105 bg-gradient-to-r from-red-500/70 to-red-700/70 hover:from-red-500/80 hover:to-red-700/80"
                        >
                            Pot
                        </Button>
                    </div>
                </div>
            </div>

            {/* Divider */}
            {(onFold || onCheck || onRaise) && (
                <div className="w-full h-px bg-white/10" />
            )}

            {/* Main Action Buttons - Fold, Check/Call, Raise */}
            {(onFold || onCheck || onRaise) && (
                <div className="flex gap-2 w-full">
                    {/* Fold Button */}
                    {onFold && (
                        <div className="relative flex-1 rounded-lg">
                            <Button
                                onClick={onFold}
                                disabled={isLoading}
                                className="relative inline-flex items-center justify-center w-full disabled:opacity-50 disabled:cursor-not-allowed font-medium px-2 py-2 rounded-lg border-0 text-white backdrop-blur transition-all duration-200 hover:scale-105 bg-red-600/70 hover:bg-red-600/80"
                            >
                                {isLoading ? '...' : 'Fold'}
                            </Button>
                        </div>
                    )}

                    {/* Check/Call Button */}
                    {onCheck && (
                        <div className="relative flex-1 rounded-lg">
                            <Button
                                onClick={onCheck}
                                disabled={isLoading}
                                className="relative inline-flex items-center justify-center w-full disabled:opacity-50 disabled:cursor-not-allowed font-medium px-2 py-2 rounded-lg border-0 text-white backdrop-blur transition-all duration-200 hover:scale-105 bg-green-600/70 hover:bg-green-600/80"
                            >
                                {isLoading ? '...' : (maxBet ? 'Call' : 'Check')}
                            </Button>
                        </div>
                    )}

                    {/* Raise Button */}
                    {onRaise && (
                        <div className="relative flex-1 rounded-lg">
                            <Button
                                onClick={onRaise}
                                disabled={isLoading}
                                className="relative gap-1 inline-flex items-center justify-center w-full disabled:opacity-50 disabled:cursor-not-allowed font-medium px-2 py-2 rounded-lg border-0 text-white backdrop-blur transition-all duration-200 hover:scale-105 bg-orange-500/70 hover:bg-orange-500/80"
                            >
                                {isLoading ? '...' : (
                                    <>
                                        Raise <RollingNumber value={raiseAmount} prefix="$" className="font-semibold" />
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    );
}
