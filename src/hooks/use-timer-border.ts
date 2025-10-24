import { animate, useMotionValue, useTransform } from 'framer-motion';
import { useEffect, useState } from 'react';
import { PLAYER_ACTION_TIMEOUT_MS, TIMER_WARNING_THRESHOLD_MS } from '~/constants/timer';

interface UseTimerBorderProps {
  turnStartTime: Date | null;
  isActive: boolean;
}

export function useTimerBorder({
  turnStartTime,
  isActive,
}: UseTimerBorderProps) {
  const [isWarning, setIsWarning] = useState<boolean>(false);
  const [remainingAngle, setRemainingAngle] = useState<number>(360);

  // Motion value for smooth animation
  const progress = useMotionValue(1); // Start at 100% (full rope)

  // Transform progress to determine warning state
  const warningThreshold =
    TIMER_WARNING_THRESHOLD_MS / PLAYER_ACTION_TIMEOUT_MS;

  useEffect(() => {
    if (!turnStartTime || !isActive) {
      progress.set(0);
      setIsWarning(false);
      return;
    }

    const elapsed = Date.now() - turnStartTime.getTime();
    const remaining = Math.max(0, PLAYER_ACTION_TIMEOUT_MS - elapsed);
    const initialProgress = remaining / PLAYER_ACTION_TIMEOUT_MS;

    // Set initial progress
    progress.set(initialProgress);

    // Check if we're already in warning state
    setIsWarning(remaining <= TIMER_WARNING_THRESHOLD_MS && remaining > 0);

    // Animate from current progress to 0 over the remaining time
    const animation = animate(progress, 0, {
      duration: remaining / 1000, // Convert to seconds
      ease: "linear", // Linear countdown
      onUpdate: (latest) => {
        // Update remaining angle for the burning rope
        setRemainingAngle(latest * 360);

        // Check if we've entered warning state
        if (latest <= warningThreshold && latest > 0) {
          setIsWarning(true);
        }
      },
      onComplete: () => {
        setRemainingAngle(0);
        setIsWarning(false);
      },
    });

    return () => {
      animation.stop();
    };
  }, [turnStartTime, isActive, progress, warningThreshold]);

  // Generate complete border style including burning rope timer
  const getBorderStyle = (
    isWinner: boolean,
    isActive: boolean,
    gameState?: string,
  ): React.CSSProperties => {
    // Winner styling
    if (isWinner) {
      return {
        border: "2px solid rgba(250, 204, 21, 0.8)",
        borderRadius: "16px",
        boxShadow:
          "0 25px 50px -12px rgba(250, 204, 21, 0.5), 0 0 0 1px rgba(250, 204, 21, 0.1)",
      };
    }

    // Active player styling (no timer)
    if (isActive && gameState !== "BETTING") {
      return {
        border: "2px solid rgba(250, 204, 21, 0.6)",
        borderRadius: "16px",
      };
    }

    // Burning rope timer for active player during betting
    if (isActive && gameState === "BETTING") {
      const borderColor = isWarning ? "#ef4444" : "#3b82f6";
      const sparkleColor = isWarning ? "#ff6b6b" : "#60a5fa";

      // Create the burning rope with sparkling end
      const ropeGradient = `conic-gradient(
        from 0deg,
        ${borderColor} 0deg,
        ${borderColor} ${Math.max(0, remainingAngle - 15)}deg,
        ${sparkleColor} ${Math.max(0, remainingAngle - 15)}deg,
        ${sparkleColor} ${remainingAngle}deg,
        transparent ${remainingAngle}deg,
        transparent 360deg
      )`;

      return {
        border: "2px solid transparent",
        borderRadius: "16px",
        borderImage: `${ropeGradient} 1`,
        boxShadow: isWarning
          ? `0 0 15px ${borderColor}40, 0 0 10px ${sparkleColor}30`
          : `0 0 8px ${borderColor}25, 0 0 5px ${sparkleColor}20`,
        position: "relative",
      };
    }

    // Default inactive styling
    return {
      border: "2px solid rgba(113, 113, 122, 0.3)",
      borderRadius: "16px",
    };
  };

  return {
    getBorderStyle,
    progress,
    remainingAngle,
    isWarning,
  };
}
