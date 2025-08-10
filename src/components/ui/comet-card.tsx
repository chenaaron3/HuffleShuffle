"use client";

import React, { useCallback, useEffect, useRef } from 'react';
import { cn } from '~/lib/utils';

export interface CometCardProps {
    rotateDepth?: number;
    translateDepth?: number;
    className?: string;
    children: React.ReactNode;
}

/**
 * Lightweight 3D tilt card inspired by Aceternity UI Comet Card.
 * Props mirror the reference: rotateDepth and translateDepth control intensity.
 */
export function CometCard({
    rotateDepth = 17.5,
    translateDepth = 20,
    className,
    children,
}: CometCardProps) {
    const ref = useRef<HTMLDivElement>(null);

    const onMove = useCallback((e: PointerEvent) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const px = (x / rect.width) * 2 - 1; // -1..1
        const py = (y / rect.height) * 2 - 1;
        const rx = -py * rotateDepth;
        const ry = px * rotateDepth;
        const tx = px * translateDepth;
        const ty = py * translateDepth;
        el.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translate3d(${tx}px, ${ty}px, 0)`;
    }, [rotateDepth, translateDepth]);

    const reset = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        el.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translate3d(0,0,0)`;
    }, []);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const move = (e: PointerEvent) => onMove(e);
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerleave", reset);
        return () => {
            el.removeEventListener("pointermove", move);
            el.removeEventListener("pointerleave", reset);
        };
    }, [onMove, reset]);

    return (
        <div
            ref={ref}
            className={cn(
                "relative rounded-xl transition-transform duration-200 will-change-transform",
                className
            )}
            style={{ transformStyle: "preserve-3d" as any }}
        >
            {children}
        </div>
    );
}

export default CometCard;


