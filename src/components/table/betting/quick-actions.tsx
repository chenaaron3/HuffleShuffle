import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group';
import { cn } from '~/lib/utils';

export type QuickActionType = 'fold' | 'check' | 'check-fold' | null;

interface QuickActionsProps {
    value: QuickActionType;
    onChange: (value: QuickActionType) => void;
    disabled: boolean;
    gameState?: string;
    isMyTurn?: boolean;
    compact?: boolean;
}

const actionDescriptions = {
    fold: "Auto-fold when it's your turn.",
    check: "Auto-check if no bet is required.",
    'check-fold': "Auto-check if no bet, otherwise auto-fold.",
};

const actionButtonClass = {
    fold: 'bg-red-600 hover:bg-red-700',
    check: 'bg-green-600 hover:bg-green-700',
    'check-fold': 'bg-orange-500 hover:bg-orange-600',
} as const;

export function QuickActions({ value, onChange, disabled, gameState, isMyTurn = false, compact = false }: QuickActionsProps) {
    const [hoveredAction, setHoveredAction] = useState<QuickActionType>(null);
    const dealingStates = ['DEAL_HOLE_CARDS', 'DEAL_FLOP', 'DEAL_TURN', 'DEAL_RIVER'];
    const shouldShow = gameState === 'BETTING' || dealingStates.includes(gameState ?? '');

    if (!shouldShow || isMyTurn) {
        return null;
    }

    const displayedAction = hoveredAction || value;

    return (
        <div className={cn(
            'flex flex-col border border-white/10 bg-zinc-900/95 shadow-2xl backdrop-blur',
            compact ? 'w-72 gap-0 rounded-lg p-1.5' : 'h-full w-full justify-center gap-2 rounded-xl p-2',
        )}>
            <ToggleGroup
                type="single"
                value={value ?? ''}
                onValueChange={(newValue) => {
                    onChange(newValue === value ? null : (newValue as QuickActionType));
                }}
                className="grid w-full grid-cols-3 gap-1"
                disabled={disabled}
            >
                {([
                    { value: 'fold', label: 'Fold' },
                    { value: 'check', label: 'Check' },
                    { value: 'check-fold', label: 'Check/Fold' },
                ] as const).map((action) => (
                    <ToggleGroupItem
                        key={action.value}
                        value={action.value}
                        disabled={disabled}
                        onMouseEnter={() => setHoveredAction(action.value)}
                        onMouseLeave={() => setHoveredAction(null)}
                        className={cn(
                            'flex-1 rounded-md border-0 text-white data-[state=off]:opacity-45 data-[state=on]:opacity-100 data-[state=on]:ring-2 data-[state=on]:ring-white/40',
                            compact ? 'h-7 px-1.5 text-[11px]' : 'h-9 px-2 text-sm',
                            actionButtonClass[action.value],
                            disabled && 'cursor-not-allowed opacity-50',
                        )}
                    >
                        <span className="whitespace-nowrap">{action.label}</span>
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>

            {!compact && (
                <div className="flex h-5 items-center">
                    <AnimatePresence mode="wait">
                        {displayedAction ? (
                            <motion.p
                                key={displayedAction}
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 5 }}
                                transition={{ duration: 0.15 }}
                                className={cn(
                                    'w-full text-xs font-medium',
                                    displayedAction === 'fold' && 'text-red-300',
                                    displayedAction === 'check' && 'text-green-300',
                                    displayedAction === 'check-fold' && 'text-orange-300',
                                )}
                            >
                                {actionDescriptions[displayedAction]}
                            </motion.p>
                        ) : (
                            <motion.p
                                key="empty"
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 5 }}
                                transition={{ duration: 0.15 }}
                                className="w-full text-xs font-medium text-white/50"
                            >
                                No action selected. You'll need to act manually.
                            </motion.p>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
