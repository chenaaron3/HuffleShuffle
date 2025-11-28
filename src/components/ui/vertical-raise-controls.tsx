import { motion } from 'framer-motion';
import { Coins } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { RollingNumber } from '~/components/ui/chip-animations';
import { GlowingEffect } from '~/components/ui/glowing-effect';
import { Slider } from '~/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { cn } from '~/lib/utils';

interface VerticalRaiseControlsProps {
    potTotal?: number;
    playerBalance?: number;
    currentBet?: number;
    bigBlind?: number;
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
    raiseAmount,
    onRaiseAmountChange,
    onFold,
    onCheck,
    onRaise,
    maxBet = 0
}: VerticalRaiseControlsProps) {
    const maxBetAmount = Math.max(0, currentBet + playerBalance);
    const availableAfterCall = Math.max(0, maxBetAmount - maxBet);
    // If player can't afford full big blind raise, all-in becomes the minimum
    const minRaise = Math.min(
        maxBetAmount, // Can't exceed all-in
        maxBet + Math.min(bigBlind || 0, availableAfterCall)
    );

    // Clamp value to valid range
    const clampAmount = (value: number) => Math.max(minRaise, Math.min(value, maxBetAmount));
    const validatedAmount = clampAmount(raiseAmount);

    const handleAmountChange = (amount: number) => {
        onRaiseAmountChange(clampAmount(amount));
    };

    const quarterPot = Math.floor(Math.max(0, potTotal) / 4);
    const halfPot = Math.floor(Math.max(0, potTotal) / 2);
    const threeQuarterPot = Math.floor((Math.max(0, potTotal) * 3) / 4);

    const [inputValue, setInputValue] = useState<string>(validatedAmount.toString());
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (!isEditing) {
            setInputValue(validatedAmount.toString());
        }
    }, [validatedAmount, isEditing]);

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;

        // Allow empty input while typing
        if (rawValue === '') {
            setInputValue('');
            return;
        }

        // Allow only integers (no decimals)
        if (!/^\d*$/.test(rawValue)) {
            return;
        }

        setInputValue(rawValue);
    };

    // Handle input blur - finalize the value
    const handleInputBlur = () => {
        setIsEditing(false);
        const numValue = parseInt(inputValue, 10);

        if (isNaN(numValue) || inputValue === '') {
            setInputValue(validatedAmount.toString());
        } else {
            const validated = clampAmount(numValue);
            setInputValue(validated.toString());
            handleAmountChange(validated);
        }
    };

    // Handle input focus
    const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsEditing(true);
        // Select all text so it can be replaced immediately
        e.target.select();
    };

    // Handle Enter key to submit
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur(); // This will trigger handleInputBlur
        }
    };

    const handleQuarterPot = () => handleAmountChange(quarterPot);
    const handleHalfPot = () => handleAmountChange(halfPot);
    const handleThreeQuarterPot = () => handleAmountChange(threeQuarterPot);
    const handleFullPot = () => handleAmountChange(Math.max(0, potTotal));
    const handleAllIn = () => handleAmountChange(maxBetAmount);

    const isQuarterPotDisabled = quarterPot < minRaise;
    const isHalfPotDisabled = halfPot < minRaise;
    const isThreeQuarterPotDisabled = threeQuarterPot < minRaise;
    const isFullPotDisabled = potTotal < minRaise;
    const isAllInDisabled = playerBalance <= 0;

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
                                value={[validatedAmount]}
                                onValueChange={(value) => handleAmountChange(value[0] ?? 0)}
                                max={maxBetAmount}
                                min={minRaise}
                                step={bigBlind || 1}
                                orientation="horizontal"
                                disabled={maxBetAmount <= minRaise}
                                className="w-full [&_[data-slot=slider-track]]:bg-zinc-800/70 [&_[data-slot=slider-range]]:bg-orange-500/90 [&_[data-slot=slider-thumb]]:bg-orange-400 [&_[data-slot=slider-thumb]]:border-orange-300 [&_[data-slot=slider-thumb]]:ring-2 [&_[data-slot=slider-thumb]]:ring-orange-300 [&_[data-slot=slider-thumb]]:drop-shadow-[0_0_12px_rgba(249,115,22,0.85)] [&_[data-slot=slider-thumb]]:transition-shadow"
                            />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent
                        side="bottom"
                        className={cn(
                            "text-white/80 bg-zinc-800/95 border text-xs p-0 shadow-lg transition-all cursor-text [&_svg]:hidden",
                            isEditing
                                ? "border-orange-400/80 shadow-orange-500/20"
                                : "border-orange-500/40 hover:border-orange-400/60"
                        )}
                    >
                        <input
                            type="text"
                            value={inputValue}
                            onChange={handleInputChange}
                            onBlur={handleInputBlur}
                            onFocus={handleInputFocus}
                            onKeyDown={handleInputKeyDown}
                            className="w-14 bg-transparent border-none outline-none text-white text-xs py-1.5 px-3 text-center focus:text-white focus:ring-2 focus:ring-orange-400/50 focus:bg-zinc-700/50 rounded cursor-text transition-all"
                            placeholder={validatedAmount.toString()}
                            inputMode="numeric"
                            pattern="[0-9]*"
                        />
                    </TooltipContent>
                </Tooltip>

                {/* Min/Max Labels */}
                <div className="flex justify-between w-full text-xs text-white/60">
                    <span>${minRaise}</span>
                    <span>${maxBetAmount}</span>
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
                            {maxBet > 0 ? 'Call' : 'Check'}
                        </Button>
                    )}
                    {onRaise && (
                        <Button
                            onClick={onRaise}
                            variant="default"
                            size="sm"
                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                        >
                            Raise <RollingNumber value={validatedAmount} prefix="$" className="font-semibold" />
                        </Button>
                    )}
                </div>
            )}
        </motion.div>
    );
}
