import React, { useContext } from 'react';
import { AnimationContext } from '~/components/ui/chip-animations';
import { getPotPosition, waitForElementPosition } from '~/utils/dom-positions';

export function AnimationTestButton() {
    const animationContext = useContext(AnimationContext);

    if (!animationContext) return null;

    const testChipStream = async () => {
        console.log('Manual test: Triggering chip stream');

        // Try to get exact positions, fallback to approximate
        const potPosition = await waitForElementPosition('pot-display');
        const fromPosition = { x: 200, y: 400 }; // Test from position (simulating a chip)
        const toPosition = potPosition || { x: window.innerWidth - 150, y: 100 };

        console.log('Test chip stream positions:', { fromPosition, toPosition });

        animationContext.triggerChipStream(
            fromPosition,
            toPosition,
            100 // Amount
        );
    };

    const testPotSplash = () => {
        console.log('Manual test: Triggering pot splash');
        animationContext.triggerPotSplash();
    };

    const testPulsingChip = () => {
        console.log('Manual test: Triggering pulsing chip');
        animationContext.triggerPulsingChip(50);
    };

    return (
        <div className="fixed bottom-4 left-4 z-50 flex gap-2">
            <button
                onClick={testChipStream}
                className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded shadow-lg"
            >
                Test Chips
            </button>
            <button
                onClick={testPotSplash}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs rounded shadow-lg"
            >
                Test Splash
            </button>
            <button
                onClick={testPulsingChip}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs rounded shadow-lg"
            >
                Test Pulse
            </button>
        </div>
    );
}
