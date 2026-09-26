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

const actions = [
    {
        value: 'fold' as const,
        label: 'Fold',
        emoji: '🚫',
        className:
            'data-[state=on]:bg-[#B5332F]/20 data-[state=on]:text-white data-[state=on]:border-[#B5332F]/40 data-[state=on]:ring-2 data-[state=on]:ring-[#B5332F]/20 hover:bg-[#B5332F]/10 hover:text-white/90 hover:border-[#B5332F]/30',
        descriptionClass: 'text-[#B5332F]/90',
    },
    {
        value: 'check' as const,
        label: 'Check',
        emoji: '✓',
        className:
            'data-[state=on]:bg-[#2EA043]/20 data-[state=on]:text-white data-[state=on]:border-[#2EA043]/40 data-[state=on]:ring-2 data-[state=on]:ring-[#2EA043]/20 hover:bg-[#2EA043]/10 hover:text-white/90 hover:border-[#2EA043]/30',
        descriptionClass: 'text-[#2EA043]/90',
    },
    {
        value: 'check-fold' as const,
        label: 'C/F',
        emoji: '⚡',
        className:
            'data-[state=on]:bg-[#F3C36A]/20 data-[state=on]:text-white data-[state=on]:border-[#F3C36A]/40 data-[state=on]:ring-2 data-[state=on]:ring-[#F3C36A]/20 hover:bg-[#F3C36A]/10 hover:text-white/90 hover:border-[#F3C36A]/30',
        descriptionClass: 'text-[#F3C36A]/90',
    },
];

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
            'flex flex-col border border-white/10 bg-zinc-900/90 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md',
            compact ? 'w-64 gap-1 rounded-xl p-2' : 'h-full w-full justify-between gap-5 rounded-2xl bg-white/5 p-5',
        )}>
            {!compact && (
                <h3 className="text-sm font-semibold text-white/90">Auto-Play Actions</h3>
            )}

            <ToggleGroup
                type="single"
                value={value ?? ''}
                onValueChange={(newValue) => {
                    onChange(newValue === value ? null : (newValue as QuickActionType));
                }}
                className={cn('grid grid-cols-3', compact ? 'w-full gap-1.5' : 'gap-2.5')}
                disabled={disabled}
            >
                {actions.map((action) => (
                    <ToggleGroupItem
                        key={action.value}
                        value={action.value}
                        disabled={disabled}
                        onMouseEnter={() => setHoveredAction(action.value)}
                        onMouseLeave={() => setHoveredAction(null)}
                        className={cn(
                            'flex items-center justify-center border border-white/10 bg-white/5 text-white/70 transition-all duration-200',
                            compact ? 'h-8 gap-1 rounded-lg px-1.5' : 'h-auto gap-1.5 rounded-xl px-3 py-2.5',
                            action.className,
                            disabled && 'cursor-not-allowed opacity-50',
                        )}
                    >
                        <span className={compact ? 'text-xs' : 'text-sm'}>{action.emoji}</span>
                        <span className={cn('font-medium whitespace-nowrap', compact ? 'text-[11px]' : 'text-xs')}>
                            {action.label}
                        </span>
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
                                    'w-full text-xs font-medium leading-relaxed',
                                    actions.find((action) => action.value === displayedAction)?.descriptionClass,
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
