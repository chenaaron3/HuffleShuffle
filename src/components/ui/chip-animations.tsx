import { AnimatePresence, motion, useAnimation } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Chip streaming animation component
interface ChipStreamProps {
    fromPosition: { x: number; y: number };
    toPosition: { x: number; y: number };
    amount: number;
    isVisible: boolean;
    onComplete?: () => void;
    color?: 'yellow' | 'red' | 'blue' | 'green';
}

// Independent chip stream component that renders in a portal
export function ChipStream({
    fromPosition,
    toPosition,
    amount,
    color = 'yellow',
    onComplete
}: Omit<ChipStreamProps, 'isVisible'>) {
    const chipColors = {
        yellow: 'from-yellow-400 via-yellow-500 to-yellow-600',
        red: 'from-red-400 via-red-500 to-red-600',
        blue: 'from-blue-400 via-blue-500 to-blue-600',
        green: 'from-green-400 via-green-500 to-green-600'
    };

    const [isVisible, setIsVisible] = useState(true);

    console.log('IndependentChipStream: Creating independent stream', {
        fromPosition,
        toPosition,
        amount,
        color
    });

    // Calculate number of chips based on amount (more chips for larger amounts)
    const chipCount = 10// Math.min(Math.max(Math.floor(amount / 25), 3), 12);

    // Generate randomized offsets for each chip
    const chipOffsets = Array.from({ length: chipCount }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 40, // Random X offset between -20 and 20
        y: (Math.random() - 0.5) * 40, // Random Y offset between -20 and 20
        delay: Math.random() * 0.3, // Random delay between 0 and 0.3s
        scale: 0.8 + Math.random() * 0.4, // Random scale between 0.8 and 1.2
        rotation: (Math.random() - 0.5) * 360, // Random rotation
    }));

    const handleComplete = () => {
        console.log('IndependentChipStream: Animation completed');
        setIsVisible(false);
        onComplete?.();
    };

    if (!isVisible) return null;

    const portalContent = (
        <div className="fixed inset-0 pointer-events-none z-30">
            {/* Multiple chips with randomized positions */}
            {chipOffsets.map((chip) => (
                <motion.div
                    key={`chip-${chip.id}-${fromPosition.x}-${fromPosition.y}-${toPosition.x}-${toPosition.y}`}
                    className="absolute"
                    style={{
                        left: fromPosition.x + chip.x,
                        top: fromPosition.y + chip.y,
                    }}
                    initial={{
                        x: 0,
                        y: 0,
                        scale: .3,
                        rotate: chip.rotation,
                        opacity: .75
                    }}
                    animate={{
                        x: toPosition.x - fromPosition.x - chip.x,
                        y: toPosition.y - fromPosition.y - chip.y,
                        scale: 1,
                        rotate: chip.rotation + 360,
                        opacity: [0, 1, 1, 0]
                    }}
                    transition={{
                        duration: 1.2 + Math.random() * 0.3, // Slightly faster, 1.2-1.5s
                        delay: chip.delay,
                        ease: [0.05, 0.3, 0.99, 1], // Very slow start, very fast end
                    }}
                    onAnimationComplete={() => {
                        if (chip.id === chipCount - 1) {
                            // Wait for .3 seconds before completing
                            setTimeout(() => {
                                handleComplete();
                            }, 300);
                        }
                    }}
                >
                    <div className="relative -translate-x-1/2 -translate-y-1/2">
                        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${chipColors[color]} border-2 border-yellow-300 shadow-lg flex items-center justify-center`}>
                            <div className="absolute inset-1 rounded-full border border-yellow-200/50"></div>
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );

    // Render in portal to document.body
    return createPortal(portalContent, document.body);
}

// Rolling number animation component (Robinhood-style)
interface RollingNumberProps {
    value: number;
    duration?: number;
    className?: string;
    prefix?: string;
    suffix?: string;
}

export function RollingNumber({
    value,
    duration = 0.8,
    className = "",
    prefix = "",
    suffix = ""
}: RollingNumberProps) {
    const [displayValue, setDisplayValue] = useState(value);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (displayValue !== value) {
            setIsAnimating(true);

            const startValue = displayValue;
            const endValue = value;
            const startTime = Date.now();

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / (duration * 1000), 1);

                // Easing function for smooth animation
                const easeOutCubic = 1 - Math.pow(1 - progress, 3);
                const currentValue = startValue + (endValue - startValue) * easeOutCubic;

                setDisplayValue(Math.round(currentValue));

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    setDisplayValue(value);
                    setIsAnimating(false);
                }
            };

            requestAnimationFrame(animate);
        }
    }, [value, duration, displayValue]);

    return (
        <motion.span
            className={className}
            animate={isAnimating ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 0.25, repeat: isAnimating ? Infinity : 0, repeatType: "reverse" }}
        >
            {prefix}{displayValue.toFixed(0)}{suffix}
        </motion.span>
    );
}