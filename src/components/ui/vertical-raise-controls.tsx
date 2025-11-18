import { motion } from 'framer-motion';
import { Coins } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { RollingNumber } from '~/components/ui/chip-animations';
import { GlowingEffect } from '~/components/ui/glowing-effect';
import { Slider } from '~/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';

interface VerticalRaiseControlsProps {
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
            animate={{
                opacity: 1,
                y: 0,
                scale: [1, 1.03, 1]
            }}
            exit={{
                opacity: [1, 0.6, 0],
                scale: [1, 1.08, 0.92],
                y: [0, 6, 12],
                transition: {
                    duration: 0.25,
                    ease: [0.4, 0, 0.2, 1] // cubic-bezier for snappy feel
                }
            }}
            transition={{
                type: 'spring',
                stiffness: 260,
                damping: 24,
                mass: 0.7,
                scale: {
                    duration: 0.4,
                    ease: "easeOut"
                }
            }}
            className="relative rounded-xl shadow-2xl w-80 bg-zinc-900/95 border border-white/10 p-3 backdrop-blur flex flex-col gap-3"
        >
            <GlowingEffect disabled={false} spread={25} proximity={40} inactiveZone={0.3} borderWidth={2} variant="golden" className="rounded-xl" />
            {/* All In Button */}
            <Button
                onClick={handleAllIn}
                disabled={isAllInDisabled}
                variant="default"
                size="sm"
                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
            >
                <Coins className="w-3.5 h-3.5" />
                All In
            </Button>

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

            {/* Quick Action Buttons - Pot Buttons */}
            <div className="flex gap-1.5 w-full">
                <Button
                    onClick={handleQuarterPot}
                    disabled={isQuarterPotDisabled}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/50 text-white"
                >
                    <span className="text-base">¼</span><span>Pot</span>
                </Button>
                <Button
                    onClick={handleHalfPot}
                    disabled={isHalfPotDisabled}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/50 text-white"
                >
                    <span className="text-base">½</span><span>Pot</span>
                </Button>
                <Button
                    onClick={handleThreeQuarterPot}
                    disabled={isThreeQuarterPotDisabled}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs bg-orange-600/20 hover:bg-orange-600/30 border-orange-600/50 text-white"
                >
                    <span className="text-base">¾</span><span>Pot</span>
                </Button>
                <Button
                    onClick={handleFullPot}
                    disabled={isFullPotDisabled}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs bg-red-500/20 hover:bg-red-500/30 border-red-500/50 text-white"
                >
                    Pot
                </Button>
            </div>

            {/* Divider */}
            {(onFold || onCheck || onRaise) && (
                <div className="w-full h-px bg-white/10" />
            )}

            {/* Main Action Buttons - Fold, Check/Call, Raise */}
            {(onFold || onCheck || onRaise) && (
                <div className="flex gap-2 w-full">
                    {onFold && (
                        <Button
                            onClick={onFold}
                            variant="default"
                            size="sm"
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                        >
                            Fold
                        </Button>
                    )}
                    {onCheck && (
                        <Button
                            onClick={onCheck}
                            variant="default"
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                            {maxBet ? 'Call' : 'Check'}
                        </Button>
                    )}
                    {onRaise && (
                        <Button
                            onClick={onRaise}
                            variant="default"
                            size="sm"
                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                        >
                            Raise <RollingNumber value={raiseAmount} prefix="$" className="font-semibold" />
                        </Button>
                    )}
                </div>
            )}
        </motion.div>
    );
}
