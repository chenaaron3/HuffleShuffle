import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LayoutGrid } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import {
    useBlindSeatNumbers,
    useGameState,
    useHighlightedSeatId,
    useOriginalSeats,
} from '~/hooks/use-table-selectors';
import { cn } from '~/lib/utils';

import { playerGridColumnCount } from './seat-overlay-logic';
import { buildHudGrid } from './seat-hud-logic';

import type { HudActionTone, HudCell, HudRole } from './seat-hud-logic';

const TONE_CLASS: Record<HudActionTone, string> = {
    none: 'border-white/25 bg-black/75 text-white',
    check: 'border-green-400/40 bg-green-950/85 text-green-50',
    call: 'border-blue-400/40 bg-blue-950/85 text-blue-50',
    raise: 'border-red-400/40 bg-red-950/85 text-red-50',
    fold: 'border-zinc-600/40 bg-zinc-950/80 text-zinc-400',
    'all-in': 'border-yellow-300/50 bg-yellow-950/85 text-yellow-50',
    eliminated: 'border-zinc-800/80 bg-black/70 text-zinc-600',
};

const ROLE_BADGE_CLASS: Record<Exclude<HudRole, null>, string> = {
    BU: 'bg-white text-black',
    SB: 'bg-blue-600 text-white',
    BB: 'bg-red-600 text-white',
};

function ringClass(cell: HudCell): string {
    if (cell.isWinner) return 'ring-1 ring-yellow-300';
    if (cell.isActor) return 'ring-1 ring-blue-400';
    if (cell.isSelf) return 'ring-1 ring-white';
    return '';
}

function HudCellView({ cell, badgeAbove }: { cell: HudCell; badgeAbove: boolean }) {
    if (!cell.occupied) {
        return (
            <div
                className="h-5 w-7 rounded border border-dashed border-white/15 bg-black/30"
            />
        );
    }

    return (
        <div
            className={cn(
                'relative flex w-max flex-col rounded border px-0.5 py-0.5 tabular-nums leading-none',
                TONE_CLASS[cell.tone],
                cell.dimmed && 'opacity-45',
                ringClass(cell),
            )}
        >
            {cell.role && (
                <span
                    className={cn(
                        'absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded px-0.5 text-[8px] font-semibold leading-none',
                        badgeAbove
                            ? 'top-0 -translate-y-[calc(100%+1px)]'
                            : 'bottom-0 translate-y-[calc(100%+1px)]',
                        ROLE_BADGE_CLASS[cell.role],
                    )}
                    aria-hidden="true"
                >
                    {cell.role}
                </span>
            )}
            <span className="text-[10px] font-semibold" aria-hidden="true">
                ${cell.stack}
            </span>
            <span className="text-[9px] font-medium opacity-80" aria-hidden="true">
                ${cell.bet}
            </span>
        </div>
    );
}

export function MobileSeatHud() {
    const { data: session } = useSession();
    const seats = useOriginalSeats();
    const gameState = useGameState();
    const highlightedSeatId = useHighlightedSeatId();
    const { smallBlindIdx, bigBlindIdx, dealerButtonIdx } = useBlindSeatNumbers();

    const grid = buildHudGrid({
        seats: seats
            .filter((seat) => !!seat.player)
            .map((seat) => ({
                id: seat.id,
                seatNumber: seat.seatNumber,
                playerId: seat.playerId,
                buyIn: seat.buyIn,
                currentBet: seat.currentBet,
                seatStatus: seat.seatStatus,
                lastAction: seat.lastAction,
                winAmount: seat.winAmount,
            })),
        smallBlindSeatNumber: smallBlindIdx,
        bigBlindSeatNumber: bigBlindIdx,
        dealerButtonSeatNumber: dealerButtonIdx,
        highlightedSeatId,
        myUserId: session?.user?.id ?? null,
        gameState,
    });

    const [collapsed, setCollapsed] = useState(false);
    const reduceMotion = useReducedMotion();
    const cells = grid.flat();
    if (cells.length === 0) return null;

    const transition = reduceMotion
        ? { duration: 0 }
        : { type: 'spring' as const, stiffness: 380, damping: 32, mass: 0.8 };

    return (
        <AnimatePresence mode="popLayout" initial={false}>
            {collapsed ? (
                <motion.button
                    key="hud-collapsed"
                    type="button"
                    layoutId="mobile-seat-hud"
                    onClick={() => setCollapsed(false)}
                    aria-label="Show table seats"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={transition}
                    className="pointer-events-auto mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-black/70 text-white"
                    style={{ originX: 1, originY: 0 }}
                >
                    <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                </motion.button>
            ) : (
                <motion.button
                    key="hud-expanded"
                    type="button"
                    layoutId="mobile-seat-hud"
                    onClick={() => setCollapsed(true)}
                    aria-label="Hide table seats"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={transition}
                    className="pointer-events-auto mt-1 grid shrink-0 cursor-pointer items-center justify-items-start gap-0.5 overflow-visible pb-3 pt-3 text-left"
                    style={{
                        originX: 1,
                        originY: 0,
                        gridTemplateColumns: `repeat(${playerGridColumnCount(cells.length)}, max-content)`,
                    }}
                >
                    {grid.map((row, rowIndex) =>
                        row.map((cell) => (
                            <HudCellView
                                key={cell.seatNumber}
                                cell={cell}
                                badgeAbove={rowIndex === 0}
                            />
                        )),
                    )}
                </motion.button>
            )}
        </AnimatePresence>
    );
}
