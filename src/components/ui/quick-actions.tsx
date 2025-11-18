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
    isMyTurn?: boolean;
}

const actionDescriptions = {
    fold: "Auto-fold when it's your turn.",
    check: "Auto-check if no bet is required.",
    'check-fold': "Auto-check if no bet, otherwise auto-fold.",
};

export function QuickActions({ value, onChange, disabled, gameState, isMyTurn = false }: QuickActionsProps) {
    const [hoveredAction, setHoveredAction] = useState<QuickActionType>(null);
    // Show during betting or dealing phases
    const dealingStates = ['DEAL_HOLE_CARDS', 'DEAL_FLOP', 'DEAL_TURN', 'DEAL_RIVER'];
    const shouldShow = gameState === 'BETTING' || dealingStates.includes(gameState ?? '');

    // Hide when it's the player's turn (they need to act manually)
    if (!shouldShow || isMyTurn) {
        return null;
    }

    const displayedAction = hoveredAction || value;

    return (
        <div className="h-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-5 w-full flex flex-col justify-between gap-5">
            {/* Header */}
            <div>
                <h3 className="text-sm font-semibold text-white/90">Auto-Play Actions</h3>
            </div>

            {/* Toggle Group */}
            <ToggleGroup
                type="single"
                value={value ?? ''}
                onValueChange={(newValue) => {
                    // Allow deselecting by clicking the same button again
                    onChange(newValue === value ? null : (newValue as QuickActionType));
                }}
                className="grid grid-cols-3 gap-2.5"
                disabled={disabled}
            >
                <ToggleGroupItem
                    value="fold"
                    disabled={disabled}
                    onMouseEnter={() => setHoveredAction('fold')}
                    onMouseLeave={() => setHoveredAction(null)}
                    className={cn(
                        "px-3 py-2.5 h-auto rounded-xl border flex items-center justify-center gap-1.5",
                        "data-[state=on]:bg-[#B5332F]/20 data-[state=on]:text-white data-[state=on]:border-[#B5332F]/40 data-[state=on]:ring-2 data-[state=on]:ring-[#B5332F]/20",
                        "hover:bg-[#B5332F]/10 hover:text-white/90 hover:border-[#B5332F]/30",
                        "border-white/10 bg-white/5 text-white/70",
                        "transition-all duration-200 active:scale-[1.03]",
                        disabled && "opacity-50 cursor-not-allowed"
                    )}
                >
                    <span className="text-sm">🚫</span>
                    <span className="font-medium text-xs">Fold</span>
                </ToggleGroupItem>

                <ToggleGroupItem
                    value="check"
                    disabled={disabled}
                    onMouseEnter={() => setHoveredAction('check')}
                    onMouseLeave={() => setHoveredAction(null)}
                    className={cn(
                        "px-3 py-2.5 h-auto rounded-xl border flex items-center justify-center gap-1.5",
                        "data-[state=on]:bg-[#2EA043]/20 data-[state=on]:text-white data-[state=on]:border-[#2EA043]/40 data-[state=on]:ring-2 data-[state=on]:ring-[#2EA043]/20",
                        "hover:bg-[#2EA043]/10 hover:text-white/90 hover:border-[#2EA043]/30",
                        "border-white/10 bg-white/5 text-white/70",
                        "transition-all duration-200 active:scale-[1.03]",
                        disabled && "opacity-50 cursor-not-allowed"
                    )}
                >
                    <span className="text-sm">✓</span>
                    <span className="font-medium text-xs">Check</span>
                </ToggleGroupItem>

                <ToggleGroupItem
                    value="check-fold"
                    disabled={disabled}
                    onMouseEnter={() => setHoveredAction('check-fold')}
                    onMouseLeave={() => setHoveredAction(null)}
                    className={cn(
                        "px-3 py-2.5 h-auto rounded-xl border flex items-center justify-center gap-1.5",
                        "data-[state=on]:bg-[#F3C36A]/20 data-[state=on]:text-white data-[state=on]:border-[#F3C36A]/40 data-[state=on]:ring-2 data-[state=on]:ring-[#F3C36A]/20",
                        "hover:bg-[#F3C36A]/10 hover:text-white/90 hover:border-[#F3C36A]/30",
                        "border-white/10 bg-white/5 text-white/70",
                        "transition-all duration-200 active:scale-[1.03]",
                        disabled && "opacity-50 cursor-not-allowed"
                    )}
                >
                    <span className="text-sm">⚡</span>
                    <span className="font-medium text-xs whitespace-nowrap">C/F</span>
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
                                "text-xs leading-relaxed font-medium",
                                displayedAction === 'fold' && "text-[#B5332F]/90",
                                displayedAction === 'check' && "text-[#2EA043]/90",
                                displayedAction === 'check-fold' && "text-[#F3C36A]/90"
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
                            <p className="text-xs text-white/50 font-medium">
                                No action selected. You'll need to act manually.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
