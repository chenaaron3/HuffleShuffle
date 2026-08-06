import { motion } from 'framer-motion';

interface SeatTurnGlowProps {
    seatId: string;
    glowRgb: string;
}

export function SeatTurnGlow({ seatId, glowRgb }: SeatTurnGlowProps) {
    return (
        <motion.div
            key={`turn-glow-${seatId}`}
            aria-hidden
            className="pointer-events-none absolute -inset-1 rounded-2xl z-0"
            initial={false}
            animate={{
                boxShadow: [
                    `0 0 14px 3px rgba(${glowRgb}, 0.35), 0 0 36px 10px rgba(${glowRgb}, 0.15)`,
                    `0 0 14px 3px rgba(${glowRgb}, 0.55), 0 0 36px 10px rgba(${glowRgb}, 0.25)`,
                    `0 0 14px 3px rgba(${glowRgb}, 0.35), 0 0 36px 10px rgba(${glowRgb}, 0.15)`,
                ],
            }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
    );
}
