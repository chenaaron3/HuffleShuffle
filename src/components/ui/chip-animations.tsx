import { AnimatePresence, motion, useAnimation } from 'framer-motion';
import React, { useEffect, useState } from 'react';

// Chip streaming animation component
interface ChipStreamProps {
    fromPosition: { x: number; y: number };
    toPosition: { x: number; y: number };
    amount: number;
    isVisible: boolean;
    onComplete?: () => void;
    color?: 'yellow' | 'red' | 'blue' | 'green';
}

export function ChipStream({
    fromPosition,
    toPosition,
    amount,
    isVisible,
    onComplete,
    color = 'yellow'
}: ChipStreamProps) {
    const chipColors = {
        yellow: 'from-yellow-400 via-yellow-500 to-yellow-600',
        red: 'from-red-400 via-red-500 to-red-600',
        blue: 'from-blue-400 via-blue-500 to-blue-600',
        green: 'from-green-400 via-green-500 to-green-600'
    };

    console.log('ChipStream: Component called with', {
        fromPosition,
        toPosition,
        amount,
        isVisible,
        color
    });

    if (!isVisible) {
        console.log('ChipStream: Not visible, returning null');
        return null;
    }

    // Calculate number of chips based on amount (more chips for larger amounts)
    const chipCount = Math.min(Math.max(Math.floor(amount / 25), 3), 12);

    // Generate randomized offsets for each chip
    const chipOffsets = Array.from({ length: chipCount }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 40, // Random X offset between -20 and 20
        y: (Math.random() - 0.5) * 40, // Random Y offset between -20 and 20
        delay: Math.random() * 0.3, // Random delay between 0 and 0.3s
        scale: 0.8 + Math.random() * 0.4, // Random scale between 0.8 and 1.2
        rotation: (Math.random() - 0.5) * 360, // Random rotation
    }));

    console.log('ChipStream: Rendering with', { fromPosition, toPosition, amount, chipCount, isVisible });

    return (
        <div className="fixed inset-0 pointer-events-none z-50">
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
                        scale: 0,
                        rotate: chip.rotation
                    }}
                    animate={{
                        x: toPosition.x - fromPosition.x - chip.x,
                        y: toPosition.y - fromPosition.y - chip.y,
                        scale: chip.scale,
                        rotate: chip.rotation + 360
                    }}
                    transition={{
                        duration: 1.5 + Math.random() * 0.5, // Random duration between 1.5-2s
                        delay: chip.delay,
                        ease: [0.25, 0.46, 0.45, 0.94],
                    }}
                    onAnimationComplete={() => {
                        if (chip.id === chipCount - 1) {
                            console.log('ChipStream: All chips animation completed');
                            onComplete?.();
                        }
                    }}
                >
                    <div className="relative -translate-x-1/2 -translate-y-1/2">
                        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${chipColors[color]} border-2 border-yellow-300 shadow-lg flex items-center justify-center`}>
                            <div className="absolute inset-1 rounded-full border border-yellow-200/50"></div>
                            {/* No number display - just pure chip */}
                        </div>
                    </div>
                </motion.div>
            ))}

            {/* Sparkle effects */}
            {[...Array(8)].map((_, i) => (
                <motion.div
                    key={`sparkle-${i}-${fromPosition.x}-${fromPosition.y}-${toPosition.x}-${toPosition.y}`}
                    className="absolute w-1 h-1 bg-yellow-300 rounded-full"
                    style={{
                        left: fromPosition.x + (Math.random() - 0.5) * 60,
                        top: fromPosition.y + (Math.random() - 0.5) * 60,
                    }}
                    initial={{
                        x: 0,
                        y: 0,
                        scale: 0,
                        opacity: 1
                    }}
                    animate={{
                        x: (toPosition.x - fromPosition.x) + (Math.random() - 0.5) * 100,
                        y: (toPosition.y - fromPosition.y) + (Math.random() - 0.5) * 100,
                        scale: [0, 1, 0],
                        opacity: [1, 1, 0]
                    }}
                    transition={{
                        duration: 1.8,
                        delay: Math.random() * 0.4,
                        ease: "easeOut",
                    }}
                />
            ))}
        </div>
    );
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
            animate={isAnimating ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.2, repeat: isAnimating ? Infinity : 0, repeatType: "reverse" }}
        >
            {prefix}{displayValue.toFixed(0)}{suffix}
        </motion.span>
    );
}

// Pot splash effect component
interface PotSplashProps {
    isVisible: boolean;
    onComplete?: () => void;
}

export function PotSplash({ isVisible, onComplete }: PotSplashProps) {
    const [potPosition, setPotPosition] = React.useState<{ x: number; y: number } | null>(null);

    React.useEffect(() => {
        if (isVisible) {
            // Get the pot position when splash becomes visible
            const getPotPosition = () => {
                const potElement = document.getElementById('pot-display');
                if (potElement) {
                    const rect = potElement.getBoundingClientRect();
                    setPotPosition({
                        x: rect.left + rect.width / 2,
                        y: rect.top + rect.height / 2,
                    });
                } else {
                    // Fallback to approximate position
                    setPotPosition({
                        x: window.innerWidth - 150,
                        y: 100,
                    });
                }
            };

            getPotPosition();
        }
    }, [isVisible]);

    if (!isVisible || !potPosition) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 pointer-events-none z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onAnimationComplete={onComplete}
            >
                {/* Main splash effect */}
                <motion.div
                    className="absolute w-20 h-20 rounded-full bg-yellow-400/30"
                    style={{
                        left: potPosition.x - 40, // Center the 40px wide element
                        top: potPosition.y - 40,  // Center the 40px tall element
                    }}
                    initial={{ scale: 0, opacity: 0.8 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                />

                {/* Secondary splash rings */}
                {[...Array(2)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-16 h-16 rounded-full border-2 border-yellow-300/40"
                        style={{
                            left: potPosition.x - 32, // Center the 32px wide element
                            top: potPosition.y - 32,  // Center the 32px tall element
                        }}
                        initial={{ scale: 0, opacity: 0.6 }}
                        animate={{ scale: 1.5 + (i * 0.5), opacity: 0 }}
                        transition={{
                            duration: 0.8,
                            delay: i * 0.1,
                            ease: "easeOut"
                        }}
                    />
                ))}

                {/* Sparkle effects */}
                {[...Array(6)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-2 h-2 bg-yellow-300 rounded-full"
                        style={{
                            left: potPosition.x + Math.cos(i * 60 * Math.PI / 180) * 20 - 1,
                            top: potPosition.y + Math.sin(i * 60 * Math.PI / 180) * 20 - 1,
                        }}
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{
                            scale: [0, 1, 0],
                            opacity: [1, 1, 0],
                            x: Math.cos(i * 60 * Math.PI / 180) * 30,
                            y: Math.sin(i * 60 * Math.PI / 180) * 30,
                        }}
                        transition={{
                            duration: 0.8,
                            delay: i * 0.05,
                            ease: "easeOut"
                        }}
                    />
                ))}
            </motion.div>
        </AnimatePresence>
    );
}

// Pulsing chip component for bet increases
interface PulsingChipProps {
    amount: number;
    isVisible: boolean;
    onComplete?: () => void;
    color?: 'yellow' | 'red' | 'blue' | 'green';
}

export function PulsingChip({
    amount,
    isVisible,
    onComplete,
    color = 'yellow'
}: PulsingChipProps) {
    const chipColors = {
        yellow: 'from-yellow-400 via-yellow-500 to-yellow-600',
        red: 'from-red-400 via-red-500 to-red-600',
        blue: 'from-blue-400 via-blue-500 to-blue-600',
        green: 'from-green-400 via-green-500 to-green-600'
    };

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.3 }}
                onAnimationComplete={onComplete}
            >
                <motion.div
                    className={`w-12 h-12 rounded-full bg-gradient-to-br ${chipColors[color]} border-2 border-yellow-300 shadow-2xl flex items-center justify-center`}
                    animate={{
                        scale: [1, 1.3, 1],
                        rotate: [0, 10, -10, 0],
                        y: [0, -10, 0]
                    }}
                    transition={{
                        duration: 0.8,
                        ease: "easeInOut",
                        times: [0, 0.5, 1]
                    }}
                >
                    <div className="absolute inset-1 rounded-full border border-yellow-200/50"></div>
                    <span className="relative text-sm font-bold text-yellow-900 drop-shadow-sm">
                        ${amount}
                    </span>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

// Animation context for managing global animation state
interface AnimationContextType {
    triggerChipStream: (from: { x: number; y: number }, to: { x: number; y: number }, amount: number) => void;
    triggerPotSplash: () => void;
    triggerPulsingChip: (amount: number) => void;
}

export const AnimationContext = React.createContext<AnimationContextType | null>(null);

export function AnimationProvider({ children }: { children: React.ReactNode }) {
    const [chipStreams, setChipStreams] = useState<Array<{
        id: string;
        from: { x: number; y: number };
        to: { x: number; y: number };
        amount: number;
        isVisible: boolean;
    }>>([]);

    const [potSplash, setPotSplash] = useState(false);
    const [pulsingChip, setPulsingChip] = useState<{ amount: number; isVisible: boolean }>({ amount: 0, isVisible: false });

    const triggerChipStream = (from: { x: number; y: number }, to: { x: number; y: number }, amount: number) => {
        console.log('AnimationProvider: triggerChipStream called with', { from, to, amount });
        const id = Math.random().toString(36).substr(2, 9);
        setChipStreams(prev => [...prev, { id, from, to, amount, isVisible: true }]);
    };

    const triggerPotSplash = () => {
        setPotSplash(true);
    };

    const triggerPulsingChip = (amount: number) => {
        setPulsingChip({ amount, isVisible: true });
    };

    const removeChipStream = (id: string) => {
        setChipStreams(prev => prev.filter(stream => stream.id !== id));
    };

    const contextValue: AnimationContextType = {
        triggerChipStream,
        triggerPotSplash,
        triggerPulsingChip,
    };

    return (
        <AnimationContext.Provider value={contextValue}>
            {children}

            {/* Render all active chip streams */}
            {chipStreams.map(stream => (
                <ChipStream
                    key={stream.id}
                    fromPosition={stream.from}
                    toPosition={stream.to}
                    amount={stream.amount}
                    isVisible={stream.isVisible}
                    onComplete={() => removeChipStream(stream.id)}
                />
            ))}

            {/* Render pot splash */}
            <PotSplash
                isVisible={potSplash}
                onComplete={() => setPotSplash(false)}
            />

            {/* Render pulsing chip */}
            <PulsingChip
                amount={pulsingChip.amount}
                isVisible={pulsingChip.isVisible}
                onComplete={() => setPulsingChip({ amount: 0, isVisible: false })}
            />
        </AnimationContext.Provider>
    );
}
