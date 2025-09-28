import * as React from 'react';
import { ChipStream } from '~/components/ui/chip-animations';
import { usePokerAnimations } from '~/hooks/use-poker-animations';
import { getPotPosition, getSeatPosition } from '~/utils/dom-positions';

import type { SeatWithPlayer } from "~/server/api/routers/table";

interface TableAnimationProps {
    seats: SeatWithPlayer[];
    gameState: string;
}

export function TableAnimation({ seats, gameState }: TableAnimationProps) {
    const { chipStreams, removeChipStream, triggerChipStream } = usePokerAnimations({
        seats,
        gameState,
    });

    const testPotToSeat = () => {
        console.log('Testing pot to seat chip stream');

        // Test from pot to a seat
        const fromPosition = getPotPosition() || { x: window.innerWidth - 150, y: 100 };
        const toPosition = getSeatPosition(seats[0]?.id || 'seat-1') || { x: 100, y: 300 };

        triggerChipStream(fromPosition, toPosition, 75);
    };

    return (
        <>
            {/* Test buttons */}
            <div className="fixed bottom-4 left-4 z-50 flex gap-2">
                <button
                    onClick={testPotToSeat}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs rounded shadow-lg"
                >
                    Pot→Seat
                </button>
            </div>

            {/* Render chip streams */}
            {chipStreams.map(stream => (
                <ChipStream
                    key={stream.id}
                    fromPosition={stream.from}
                    toPosition={stream.to}
                    amount={stream.amount}
                    onComplete={() => removeChipStream(stream.id)}
                />
            ))}
        </>
    );
}
