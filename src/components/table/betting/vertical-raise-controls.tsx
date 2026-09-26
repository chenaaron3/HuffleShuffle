import { motion } from 'framer-motion';
import { Coins } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { RollingNumber } from '~/components/table/chips/chip-animations';
import { GlowingEffect } from '~/components/effects/glowing-effect';
import { Slider } from '~/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { useActions } from '~/hooks/use-actions';
import {
    useCurrentBetTarget, useCurrentSeat, useEffectiveBigBlind, useMinRaiseIncrement, useTotalPot
} from '~/hooks/use-table-selectors';
import { cn } from '~/lib/utils';

interface VerticalRaiseControlsProps {
    compact?: boolean;
}

export function VerticalRaiseControls({ compact = false }: VerticalRaiseControlsProps) {
    const { data: session } = useSession();
    const userId = session?.user?.id;

    // Get data from Zustand store using selectors
    const potTotal = useTotalPot() ?? 0;
    const currentSeat = useCurrentSeat(userId);
    const playerBalance = currentSeat?.buyIn ?? 1000;
    const currentBet = currentSeat?.currentBet ?? 0;
    const bigBlind = useEffectiveBigBlind() ?? 20;
    const minRaiseIncrement = useMinRaiseIncrement();
    const currentBetTarget = useCurrentBetTarget() ?? 0;

    // Use actions hook for mutations
    const { mutate: performAction } = useActions();

    // State for raise amount
    const [raiseAmount, setRaiseAmount] = useState<number>(bigBlind);

    // Update raise amount when min raise increment or max bet changes
    useEffect(() => {
        if (minRaiseIncrement && currentBetTarget !== undefined) {
            setRaiseAmount(currentBetTarget + minRaiseIncrement);
        }
    }, [minRaiseIncrement, currentBetTarget]);

    // Handle fold action
    const handleFold = () => {
        performAction('FOLD');
    };

    // Handle check action
    const handleCheck = () => {
        performAction('CHECK');
    };
    const maxBetAmount = Math.max(0, currentBet + playerBalance);
    const availableAfterCall = Math.max(0, maxBetAmount - currentBetTarget);
    // Min raise = current bet target + lastRaiseIncrement (TDA rule); all-in if short
    const minRaise = Math.min(
        maxBetAmount, // Can't exceed all-in
        currentBetTarget + Math.min(minRaiseIncrement || 0, availableAfterCall)
    );

    // Clamp value to valid range
    const clampAmount = (value: number) => Math.max(minRaise, Math.min(value, maxBetAmount));
    const validatedAmount = clampAmount(raiseAmount);
    const isForcedAllIn = maxBetAmount <= minRaise;

    const handleAmountChange = (amount: number) => {
        setRaiseAmount(clampAmount(amount));
    };

    const quarterPot = Math.floor(Math.max(0, potTotal) / 4);
    const halfPot = Math.floor(Math.max(0, potTotal) / 2);
    const threeQuarterPot = Math.floor((Math.max(0, potTotal) * 3) / 4);

    const [inputValue, setInputValue] = useState<string>(validatedAmount.toString());
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const inputValueRef = useRef(inputValue);
    inputValueRef.current = inputValue;

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

    const commitInputValue = useCallback(() => {
        setIsEditing(false);
        const rawValue = inputValueRef.current;
        const numValue = parseInt(rawValue, 10);

        if (isNaN(numValue) || rawValue === '') {
            setInputValue(validatedAmount.toString());
            return validatedAmount;
        }

        const validated = clampAmount(numValue);
        setInputValue(validated.toString());
        setRaiseAmount(validated);
        return validated;
    }, [validatedAmount, minRaise, maxBetAmount]);

    const handleRaise = () => {
        const amount = isEditing ? commitInputValue() : validatedAmount;
        performAction('RAISE', { amount });
    };

    // Handle input blur / keyboard dismiss - finalize the value
    const handleInputBlur = () => {
        commitInputValue();
    };

    // Mobile keyboards (especially Android back) often hide without firing blur.
    useEffect(() => {
        if (!isEditing) return;
        const viewport = window.visualViewport;
        if (!viewport) return;

        let previousHeight = viewport.height;
        const handleViewportResize = () => {
            const nextHeight = viewport.height;
            const grew = nextHeight - previousHeight;
            previousHeight = nextHeight;
            if (grew > 80) {
                commitInputValue();
                inputRef.current?.blur();
            }
        };

        viewport.addEventListener('resize', handleViewportResize);
        return () => {
            viewport.removeEventListener('resize', handleViewportResize);
        };
    }, [isEditing, commitInputValue]);

    // Handle input focus
    const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsEditing(true);
        // Select all text so it can be replaced immediately
        e.target.select();
    };

    // Handle Enter / Done to commit
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

    // Disable buttons if player can't afford the bet or if it's below minimum raise
    const isQuarterPotDisabled = quarterPot < minRaise || quarterPot > maxBetAmount;
    const isHalfPotDisabled = halfPot < minRaise || halfPot > maxBetAmount;
    const isThreeQuarterPotDisabled = threeQuarterPot < minRaise || threeQuarterPot > maxBetAmount;
    const isFullPotDisabled = potTotal < minRaise || potTotal > maxBetAmount;
    const isAllInDisabled = playerBalance <= 0;

    // Determine if it's a Call or Check
    // Call: currentBet < currentBetTarget (need to match current street target)
    // Check: currentBet === currentBetTarget (already matched, no action needed)
    const isCall = currentBetTarget > 0 && currentBet < currentBetTarget;
    // Bet = first wager on the street (no outstanding bet to match); Raise = increasing an existing bet
    const isOpeningBet = currentBetTarget === 0;
    // Call amount is limited by player's available balance (may be all-in)
    const callAmount = isCall ? Math.min(currentBetTarget - currentBet, playerBalance) : 0;

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
            className={cn(
                'relative flex flex-col border border-white/10 bg-zinc-900/95 shadow-2xl backdrop-blur',
                compact ? 'w-52 gap-1 rounded-lg p-1' : 'w-80 gap-3 rounded-xl p-3',
            )}
        >
            {!compact && (
                <GlowingEffect
                    disabled={false}
                    spread={25}
                    proximity={40}
                    inactiveZone={0.3}
                    borderWidth={2}
                    variant="golden"
                    className="rounded-xl"
                />
            )}
            {compact && !isForcedAllIn && (
                <div className="flex w-full flex-col gap-1">
                    <Slider
                        value={[validatedAmount]}
                        onValueChange={(value) => handleAmountChange(value[0] ?? 0)}
                        max={maxBetAmount}
                        min={minRaise}
                        step={bigBlind || 1}
                        orientation="horizontal"
                        disabled={playerBalance <= 0}
                        className="w-full [&_[data-slot=slider-track]]:bg-zinc-800/70 [&_[data-slot=slider-range]]:bg-orange-500/90 [&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-thumb]]:bg-orange-400 [&_[data-slot=slider-thumb]]:border-orange-300"
                    />
                    <div className="flex w-full items-center gap-0.5">
                        <Button
                            onClick={handleQuarterPot}
                            disabled={isQuarterPotDisabled}
                            variant="outline"
                            size="sm"
                            className="h-6 flex-1 px-0 text-[10px] bg-yellow-500/20 text-white hover:bg-yellow-500/30 border-yellow-500/50"
                        >
                            ¼
                        </Button>
                        <Button
                            onClick={handleHalfPot}
                            disabled={isHalfPotDisabled}
                            variant="outline"
                            size="sm"
                            className="h-6 flex-1 px-0 text-[10px] bg-orange-500/20 text-white hover:bg-orange-500/30 border-orange-500/50"
                        >
                            ½
                        </Button>
                        <Button
                            onClick={handleFullPot}
                            disabled={isFullPotDisabled}
                            variant="outline"
                            size="sm"
                            className="h-6 flex-1 px-0 text-[10px] bg-red-500/20 text-white hover:bg-red-500/30 border-red-500/50"
                        >
                            Pot
                        </Button>
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={handleInputChange}
                            onBlur={handleInputBlur}
                            onFocus={handleInputFocus}
                            onKeyDown={handleInputKeyDown}
                            className="h-6 w-11 shrink-0 rounded-md border border-white/10 bg-zinc-800/80 px-1 text-center text-[10px] text-white outline-none focus:ring-1 focus:ring-orange-400/50"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            enterKeyHint="done"
                        />
                    </div>
                </div>
            )}
            {!compact && !isForcedAllIn && (
                <>
                    <Button
                        onClick={handleAllIn}
                        disabled={isAllInDisabled}
                        variant="default"
                        size="sm"
                        className="w-full bg-amber-500 text-white hover:bg-amber-600"
                    >
                        <Coins className="h-3.5 w-3.5" />
                        All In
                    </Button>

                    <div className="w-full space-y-3">
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
                                        disabled={playerBalance <= 0}
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
                                    ref={inputRef}
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
                                    enterKeyHint="done"
                                />
                            </TooltipContent>
                        </Tooltip>

                        <div className="flex w-full justify-between text-xs text-white/60">
                            <span>${minRaise}</span>
                            <span>${maxBetAmount}</span>
                        </div>
                    </div>

                    <div className="flex w-full gap-1.5">
                        <Button
                            onClick={handleQuarterPot}
                            disabled={isQuarterPotDisabled}
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs bg-yellow-500/20 text-white hover:bg-yellow-500/30 border-yellow-500/50"
                        >
                            <span className="text-base">¼</span><span>Pot</span>
                        </Button>
                        <Button
                            onClick={handleHalfPot}
                            disabled={isHalfPotDisabled}
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs bg-orange-500/20 text-white hover:bg-orange-500/30 border-orange-500/50"
                        >
                            <span className="text-base">½</span><span>Pot</span>
                        </Button>
                        <Button
                            onClick={handleThreeQuarterPot}
                            disabled={isThreeQuarterPotDisabled}
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs bg-orange-600/20 text-white hover:bg-orange-600/30 border-orange-600/50"
                        >
                            <span className="text-base">¾</span><span>Pot</span>
                        </Button>
                        <Button
                            onClick={handleFullPot}
                            disabled={isFullPotDisabled}
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs bg-red-500/20 text-white hover:bg-red-500/30 border-red-500/50"
                        >
                            Pot
                        </Button>
                    </div>
                    <div className="h-px w-full bg-white/10" />
                </>
            )}

            {/* Main Action Buttons - Fold, Check/Call, Raise */}
            <div className={cn('flex w-full', compact ? 'gap-0.5' : 'gap-2')}>
                <Button
                    onClick={handleFold}
                    variant="default"
                    size="sm"
                    className={cn(
                        'flex-1 bg-red-600 text-white hover:bg-red-700',
                        compact && 'h-6 px-1 text-[10px]',
                    )}
                >
                    Fold
                </Button>
                <Button
                    onClick={handleCheck}
                    variant="default"
                    size="sm"
                    className={cn(
                        'flex-1 bg-green-600 text-white hover:bg-green-700',
                        compact && 'h-6 px-1 text-[10px]',
                    )}
                >
                    {isCall ? (
                        <>
                            Call <RollingNumber value={callAmount} prefix="$" className="font-semibold" />
                        </>
                    ) : (
                        'Check'
                    )}
                </Button>
                <Button
                    onClick={handleRaise}
                    variant="default"
                    size="sm"
                    disabled={playerBalance <= 0}
                    className={cn(
                        'flex-1 bg-orange-500 text-white hover:bg-orange-600',
                        compact && 'h-6 px-1 text-[10px]',
                    )}
                >
                    {isForcedAllIn ? (
                        <>
                            All In <RollingNumber value={validatedAmount} prefix="$" className="font-semibold" />
                        </>
                    ) : (
                        <>
                            {isOpeningBet ? 'Bet' : 'Raise'} <RollingNumber value={validatedAmount} prefix="$" className="font-semibold" />
                        </>
                    )}
                </Button>
            </div>
        </motion.div>
    );
}
