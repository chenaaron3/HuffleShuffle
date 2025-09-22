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
}

export function CardSlot({
    card,
    index,
    size = 28,
    highlighted = false,
    gameState,
    winningCards,
    seatId
}: CardSlotProps) {
    const isEmpty = !card;

    // Calculate placeholder dimensions to match actual card size
    // CardImage uses width={size} and height={Math.round(size * 1.4)}
    const placeholderWidth = size;
    const placeholderHeight = Math.round(size * 1.4);

    return (
        <div className="relative">
            {isEmpty ? (
                // Empty card placeholder - sized to match actual cards
                <div
                    className="rounded border border-zinc-700/40 bg-zinc-800/40 flex items-center justify-center"
                    style={{
                        width: `${placeholderWidth}px`,
                        height: `${placeholderHeight}px`
                    }}
                >
                    {/* Optional: Add a subtle indicator for empty slot */}
                    <div className="w-2 h-2 rounded-full bg-zinc-600/30"></div>
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
                        />
                    </motion.div>
                </AnimatePresence>
            )}
        </div>
    );
}
