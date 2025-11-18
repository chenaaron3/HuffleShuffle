import { useRef, useState } from 'react';
import { Button } from '~/components/ui/button';

import type { MouseEvent, ReactNode } from 'react';
interface GlareButtonProps {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
}

export function GlareButton({ children, onClick, disabled, className }: GlareButtonProps) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);

    const handleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
        if (!buttonRef.current || disabled) return;

        const rect = buttonRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        setMousePosition({ x, y });
    };

    const handleMouseEnter = () => {
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    return (
        <Button
            ref={buttonRef}
            onClick={onClick}
            disabled={disabled}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`relative overflow-hidden ${className ?? ''}`}
        >
            {children}
            {isHovered && !disabled && (
                <div
                    className="absolute inset-0 z-0 pointer-events-none"
                    style={{
                        background: `radial-gradient(circle 120px at ${mousePosition.x}% ${mousePosition.y}%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.2) 40%, transparent 70%)`,
                        opacity: 0.6,
                    }}
                />
            )}
        </Button>
    );
}

