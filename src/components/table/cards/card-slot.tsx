import { AnimatePresence, motion } from 'framer-motion';

import { CardImage } from './card-img';

interface CardSlotProps {
    card?: string | null;
    index: number;
    size?: number;
    highlighted?: boolean;
    gameState?: string;
    winningCards?: string[];
    seatId?: string;
    compact?: boolean;
    seatStatus?: string;
}

export function CardSlot({
    card,
    index,
    size = 28,
    highlighted = false,
    gameState,
    winningCards,
    seatId,
    compact = false,
    seatStatus
}: CardSlotProps) {
    const isEmpty = !card;
    const isFolded = seatStatus === 'folded';
    const isEliminated = seatStatus === 'eliminated';

    // Calculate placeholder dimensions to match actual card size
    // CardImage uses width={size} and height={Math.round(size * 1.4)}
    const placeholderWidth = size;
    const placeholderHeight = Math.round(size * 1.4);

    return (
        <div className="relative">
            {(isFolded || isEliminated) && (
                <div
                    className={`pointer-events-none absolute inset-0 z-10 rounded-sm mix-blend-multiply ${isEliminated ? 'bg-red-600/80' : 'bg-zinc-600/80'
                        }`}
                />
            )}
            {isEmpty ? (
                // Empty card placeholder - sized to match actual cards
                <div
                    className={`rounded flex items-center justify-center border ${isEliminated
                        ? 'border-red-500/50 bg-red-900/40'
                        : 'border-zinc-500/40 bg-zinc-800/40'
                        }`}
                    style={{
                        width: `${placeholderWidth}px`,
                        height: `${placeholderHeight}px`
                    }}
                >
                    {/* Optional: Add a subtle indicator for empty slot */}
                    <div className={`w-2 h-2 rounded-full ${isEliminated ? 'bg-red-700/40' : 'bg-zinc-700/30'}`}></div>
                </div>
            ) : (
                // Actual card with animation
                <AnimatePresence mode="popLayout">
                    <motion.div
                        key={`${seatId || 'card'}-${card}-${index}`}
                        initial={{ opacity: 0, y: 20, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.8 }}
                        transition={{
                            duration: 0.4,
                            delay: index * 0.1,
                            ease: "easeOut"
                        }}
                    >
                        <CardImage
                            code={card}
                            size={size}
                            highlighted={highlighted || (gameState === 'SHOWDOWN' &&
                                Array.isArray(winningCards) &&
                                winningCards.some(wc => wc.toUpperCase() === card.toUpperCase()))}
                            compact={compact}
                        />
                    </motion.div>
                </AnimatePresence>
            )}
        </div>
    );
}
