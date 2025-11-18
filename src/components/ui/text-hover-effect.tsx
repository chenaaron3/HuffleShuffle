"use client";
import { motion } from 'motion/react';
import React, { useEffect, useRef, useState } from 'react';

export const TextHoverEffect = ({
    text,
    duration,
    id,
}: {
    text: string;
    duration?: number;
    automatic?: boolean;
    id?: string;
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [cursor, setCursor] = useState({ x: 0, y: 0 });
    const [hovered, setHovered] = useState(false);
    const [maskPosition, setMaskPosition] = useState({ cx: "50%", cy: "50%" });
    const [gradientAngle, setGradientAngle] = useState(0);
    const uniqueId = id || `text-hover-${Math.random().toString(36).substring(7)}`;
    const textGradientId = `textGradient-${uniqueId}`;
    const revealMaskId = `revealMask-${uniqueId}`;
    const textMaskId = `textMask-${uniqueId}`;

    // Animate gradient angle when hovered
    useEffect(() => {
        if (!hovered) return;

        const interval = setInterval(() => {
            setGradientAngle((prev) => (prev + 2) % 360);
        }, 50);

        return () => clearInterval(interval);
    }, [hovered]);

    useEffect(() => {
        if (svgRef.current && cursor.x !== null && cursor.y !== null) {
            const svgRect = svgRef.current.getBoundingClientRect();
            const cxPercentage = ((cursor.x - svgRect.left) / svgRect.width) * 100;
            const cyPercentage = ((cursor.y - svgRect.top) / svgRect.height) * 100;
            setMaskPosition({
                cx: `${cxPercentage}%`,
                cy: `${cyPercentage}%`,
            });
        }
    }, [cursor]);

    return (
        <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox="0 0 300 100"
            xmlns="http://www.w3.org/2000/svg"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
            className="select-none"
        >
            <defs>
                {/* Animated gradient with vibrant colors */}
                <linearGradient
                    id={textGradientId}
                    gradientUnits="userSpaceOnUse"
                    x1={`${50 + 50 * Math.cos((gradientAngle * Math.PI) / 180)}%`}
                    y1={`${50 + 50 * Math.sin((gradientAngle * Math.PI) / 180)}%`}
                    x2={`${50 - 50 * Math.cos((gradientAngle * Math.PI) / 180)}%`}
                    y2={`${50 - 50 * Math.sin((gradientAngle * Math.PI) / 180)}%`}
                >
                    {hovered && (
                        <>
                            <stop offset="0%" stopColor="#fbbf24" stopOpacity="1" />
                            <stop offset="12.5%" stopColor="#f59e0b" stopOpacity="1" />
                            <stop offset="25%" stopColor="#ef4444" stopOpacity="1" />
                            <stop offset="37.5%" stopColor="#ec4899" stopOpacity="1" />
                            <stop offset="50%" stopColor="#a855f7" stopOpacity="1" />
                            <stop offset="62.5%" stopColor="#8b5cf6" stopOpacity="1" />
                            <stop offset="75%" stopColor="#3b82f6" stopOpacity="1" />
                            <stop offset="87.5%" stopColor="#06b6d4" stopOpacity="1" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="1" />
                        </>
                    )}
                </linearGradient>

                {/* Glow filter - subtle */}
                <filter id={`glow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>

                <motion.radialGradient
                    id={revealMaskId}
                    gradientUnits="userSpaceOnUse"
                    r={hovered ? "25%" : "20%"}
                    initial={{ cx: "50%", cy: "50%" }}
                    animate={maskPosition}
                    transition={{
                        duration: duration ?? 0.15,
                        ease: "easeOut",
                    }}
                >
                    <stop offset="0%" stopColor="white" stopOpacity="1" />
                    <stop offset="50%" stopColor="white" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="black" stopOpacity="0" />
                </motion.radialGradient>
                <mask id={textMaskId}>
                    <rect
                        x="0"
                        y="0"
                        width="100%"
                        height="100%"
                        fill={`url(#${revealMaskId})`}
                    />
                </mask>
            </defs>
            {/* Base text with pulsing effect */}
            <motion.text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="middle"
                strokeWidth="0.3"
                className="fill-transparent stroke-zinc-400 font-[helvetica] text-7xl font-bold"
                animate={{
                    opacity: hovered ? [0.4, 0.6, 0.4] : 0.5,
                    strokeWidth: hovered ? [0.3, 0.4, 0.3] : 0.3,
                }}
                transition={{
                    duration: 1.5,
                    repeat: hovered ? Infinity : 0,
                    ease: "easeInOut",
                }}
            >
                {text}
            </motion.text>

            {/* Main gradient text with glow */}
            <motion.text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="middle"
                stroke={`url(#${textGradientId})`}
                strokeWidth={hovered ? "0.5" : "0.35"}
                mask={`url(#${textMaskId})`}
                filter={`url(#glow-${uniqueId})`}
                className="fill-transparent font-[helvetica] text-7xl font-bold"
                animate={{
                    strokeWidth: hovered ? [0.4, 0.6, 0.4] : 0.35,
                }}
                transition={{
                    duration: 1,
                    repeat: hovered ? Infinity : 0,
                    ease: "easeInOut",
                }}
            >
                {text}
            </motion.text>
        </svg>
    );
};
