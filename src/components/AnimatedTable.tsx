import React from 'react';
import { AnimationProvider } from '~/components/ui/chip-animations';
import { usePokerAnimations } from '~/hooks/use-poker-animations';

import type { SeatWithPlayer } from '~/server/api/routers/table';

interface AnimatedTableProps {
    children: React.ReactNode;
    seats: SeatWithPlayer[];
    potTotal: number;
    gameState?: string;
}

export function AnimatedTable({ children, seats, potTotal, gameState }: AnimatedTableProps) {
    // Use the animation hook to detect changes and trigger animations
    usePokerAnimations({
        seats,
        potTotal,
        gameState,
    });

    return (
        <AnimationProvider>
            {children}
        </AnimationProvider>
    );
}
