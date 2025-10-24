import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group';
import { cn } from '~/lib/utils';

export type QuickActionType = 'fold' | 'check' | 'check-fold' | null;

interface QuickActionsProps {
    value: QuickActionType;
    onChange: (value: QuickActionType) => void;
    disabled: boolean;
    gameState?: string;
}

const actionDescriptions = {
    fold: "Auto-fold when it's your turn.",
    check: "Auto-check if no bet is required.",
    'check-fold': "Auto-check if no bet, otherwise auto-fold.",
};

export function QuickActions({ value, onChange, disabled, gameState }: QuickActionsProps) {
    const [hoveredAction, setHoveredAction] = useState<QuickActionType>(null);

    // Clear selection when game state changes (new betting round)
    useEffect(() => {
        if (value && gameState) {
            // When betting round changes, clear the selection
            onChange(null);
        }
    }, [gameState]); // Only depend on gameState to detect round changes

    const isInBettingRound = gameState === 'BETTING';

    if (!isInBettingRound) {
        return null;
    }

    const displayedAction = hoveredAction || value;

    return (
        <div className="h-full rounded-xl border border-zinc-500/50 bg-zinc-900/50 backdrop-blur shadow-2xl p-4 w-full flex flex-col justify-between">
            {/* Header */}
            <div>
                <h3 className="text-sm font-bold text-white">Auto-Play Actions</h3>
            </div>

            {/* Toggle Group */}
            <ToggleGroup
                type="single"
                value={value ?? ''}
                onValueChange={(newValue) => {
                    // Allow deselecting by clicking the same button again
                    onChange(newValue === value ? null : (newValue as QuickActionType));
                }}
                className="grid grid-cols-3 gap-2"
                disabled={disabled}
            >
                <ToggleGroupItem
                    value="fold"
                    disabled={disabled}
                    onMouseEnter={() => setHoveredAction('fold')}
                    onMouseLeave={() => setHoveredAction(null)}
                    className={cn(
                        "px-3 py-2 h-auto rounded-lg border flex items-center justify-center gap-1.5",
                        "data-[state=on]:bg-red-500/20 data-[state=on]:text-red-400 data-[state=on]:border-red-500/50 data-[state=on]:ring-2 data-[state=on]:ring-red-500/30",
                        "hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30",
                        "border-zinc-700/50 bg-zinc-800/50 text-zinc-300",
                        "transition-all duration-200",
                        disabled && "opacity-50 cursor-not-allowed"
                    )}
                >
                    <span className="text-sm">🚫</span>
                    <span className="font-semibold text-xs">Fold</span>
                </ToggleGroupItem>

                <ToggleGroupItem
                    value="check"
                    disabled={disabled}
                    onMouseEnter={() => setHoveredAction('check')}
                    onMouseLeave={() => setHoveredAction(null)}
                    className={cn(
                        "px-3 py-2 h-auto rounded-lg border flex items-center justify-center gap-1.5",
                        "data-[state=on]:bg-blue-500/20 data-[state=on]:text-blue-400 data-[state=on]:border-blue-500/50 data-[state=on]:ring-2 data-[state=on]:ring-blue-500/30",
                        "hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/30",
                        "border-zinc-700/50 bg-zinc-800/50 text-zinc-300",
                        "transition-all duration-200",
                        disabled && "opacity-50 cursor-not-allowed"
                    )}
                >
                    <span className="text-sm">✓</span>
                    <span className="font-semibold text-xs">Check</span>
                </ToggleGroupItem>

                <ToggleGroupItem
                    value="check-fold"
                    disabled={disabled}
                    onMouseEnter={() => setHoveredAction('check-fold')}
                    onMouseLeave={() => setHoveredAction(null)}
                    className={cn(
                        "px-3 py-2 h-auto rounded-lg border flex items-center justify-center gap-1.5",
                        "data-[state=on]:bg-yellow-500/20 data-[state=on]:text-yellow-400 data-[state=on]:border-yellow-500/50 data-[state=on]:ring-2 data-[state=on]:ring-yellow-500/30",
                        "hover:bg-yellow-500/10 hover:text-yellow-400 hover:border-yellow-500/30",
                        "border-zinc-700/50 bg-zinc-800/50 text-zinc-300",
                        "transition-all duration-200",
                        disabled && "opacity-50 cursor-not-allowed"
                    )}
                >
                    <span className="text-sm">⚡</span>
                    <span className="font-semibold text-xs whitespace-nowrap">Check/Fold</span>
                </ToggleGroupItem>
            </ToggleGroup>

            {/* Description Area - Fixed height */}
            <div className="h-5 flex items-center">
                <AnimatePresence mode="wait">
                    {displayedAction ? (
                        <motion.div
                            key={displayedAction}
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            transition={{ duration: 0.15 }}
                            className="w-full"
                        >
                            <p className={cn(
                                "text-xs leading-relaxed",
                                displayedAction === 'fold' && "text-red-300",
                                displayedAction === 'check' && "text-blue-300",
                                displayedAction === 'check-fold' && "text-yellow-300"
                            )}>
                                {actionDescriptions[displayedAction]}
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            transition={{ duration: 0.15 }}
                            className="w-full"
                        >
                            <p className="text-xs text-zinc-400">
                                No action selected. You'll need to act manually.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
