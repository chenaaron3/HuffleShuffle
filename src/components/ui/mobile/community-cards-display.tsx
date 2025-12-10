import { AnimatePresence, motion } from 'framer-motion';

import { CardImage } from '../card-img';

interface CommunityCardsDisplayProps {
  cards: string[];
  winningCards?: string[];
  gameStatus?: string;
}

/**
 * Displays community cards in a horizontal row.
 * Highlights winning cards during showdown.
 */
export function CommunityCardsDisplay({
  cards,
  winningCards = [],
  gameStatus,
}: CommunityCardsDisplayProps) {
  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center py-4">
        <p className="text-sm text-zinc-500">No community cards yet</p>
      </div>
    );
  }

  const isShowdown = gameStatus === 'SHOWDOWN';

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <AnimatePresence mode="popLayout">
        {cards.map((card: string, index: number) => {
          const normalizedCard = card.toUpperCase();
          const isWinningCard =
            isShowdown &&
            Array.isArray(winningCards) &&
            winningCards.some((wc) => wc.toUpperCase() === normalizedCard);

          return (
            <motion.div
              key={`community-card-${card}-${index}`}
              className="relative"
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              transition={{
                duration: 0.4,
                delay: index * 0.1,
                ease: 'easeOut',
              }}
            >
              <CardImage code={card} size={60} highlighted={isWinningCard} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
