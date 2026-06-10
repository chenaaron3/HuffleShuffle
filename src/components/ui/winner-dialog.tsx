"use client";

import confetti from "canvas-confetti";
import { Trophy } from "lucide-react";
import { motion } from "motion/react";
import { useSession } from "next-auth/react";
import * as React from "react";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { ShineBorder } from "~/components/ui/shine-border";
import { useTournamentWinner } from "~/hooks/use-table-selectors";

const CONFETTI_DURATION_MS = 3000;
const GOLD_COLORS = ["#FFD700", "#FFC107", "#FFE08A", "#F8DEB1"];

function fireSideCannons(colors: string[]) {
  const end = Date.now() + CONFETTI_DURATION_MS;

  const frame = () => {
    if (Date.now() > end) return;
    confetti({
      particleCount: 2,
      angle: 60,
      spread: 55,
      startVelocity: 60,
      origin: { x: 0, y: 0.5 },
      colors,
    });
    confetti({
      particleCount: 2,
      angle: 120,
      spread: 55,
      startVelocity: 60,
      origin: { x: 1, y: 0.5 },
      colors,
    });
    requestAnimationFrame(frame);
  };

  frame();
}

/** Bigger celebration reserved for the winner themselves. */
function fireGoldenFireworks() {
  const end = Date.now() + CONFETTI_DURATION_MS;

  const interval = window.setInterval(() => {
    if (Date.now() > end) {
      clearInterval(interval);
      return;
    }
    confetti({
      particleCount: 60,
      spread: 360,
      startVelocity: 30,
      ticks: 80,
      colors: GOLD_COLORS,
      origin: { x: 0.2 + Math.random() * 0.6, y: Math.random() * 0.4 },
    });
  }, 350);
}

/**
 * Shown when the game is over and only one player remains (everyone else
 * eliminated). Renders a centered dialog with the winner's name and confetti.
 * The winner themselves gets a personalized "YOU WON" celebration.
 */
export function WinnerDialog() {
  const { data: session } = useSession();
  const winner = useTournamentWinner();
  const [dismissed, setDismissed] = React.useState(false);
  const winnerId = winner?.id ?? null;
  const isSelf = !!winnerId && winnerId === session?.user?.id;

  React.useEffect(() => {
    if (!winnerId) return;
    setDismissed(false);
    fireSideCannons(GOLD_COLORS);
    if (isSelf) fireGoldenFireworks();
  }, [winnerId, isSelf]);

  return (
    <Dialog
      open={!!winner && !dismissed}
      onOpenChange={(open) => {
        if (!open) setDismissed(true);
      }}
    >
      <DialogContent className="max-w-md py-10 text-center">
        <ShineBorder
          borderWidth={2}
          duration={10}
          shineColor={["#FFD700", "#FFC107", "#FFE08A"]}
        />
        <div className="flex flex-col items-center gap-5">
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.15 }}
            className="rounded-full border border-amber-400/30 bg-amber-400/10 p-4 shadow-[0_0_40px_-8px_rgba(251,191,36,0.5)]"
          >
            <Trophy className="size-9 text-amber-300" />
          </motion.div>

          {isSelf ? (
            <div className="flex flex-col gap-2">
              <DialogTitle className="text-4xl font-bold tracking-tight">
                <span className="animate-gold-shimmer bg-gradient-to-r from-yellow-600 via-amber-200 to-yellow-600 bg-clip-text text-transparent">
                  YOU WON
                </span>
              </DialogTitle>
              <p className="text-sm text-zinc-400">
                You outlasted everyone at the table. Take a bow,{" "}
                {winner?.displayName ?? "champion"}.
              </p>
            </div>
          ) : (
            <DialogTitle className="text-3xl font-bold tracking-tight">
              WINNER:{" "}
              <span className="animate-gold-shimmer bg-gradient-to-r from-yellow-600 via-amber-200 to-yellow-600 bg-clip-text text-transparent">
                {winner?.displayName ?? "Player"}
              </span>
            </DialogTitle>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
