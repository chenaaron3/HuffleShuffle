import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Track } from 'livekit-client';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { HandCamera } from '~/components/table/camera/hand-camera';
import { cardCodeToFilename } from '~/components/table/cards/card-img';
import { MobileActionControls } from '~/components/table/mobile/action-controls';
import { PotAndBlindsDisplay } from '~/components/table/pot/pot-blinds-display';
import {
    useCommunityCards,
    useDealerId,
    useGameState,
    useWinningCards,
} from '~/hooks/use-table-selectors';
import { cn } from '~/lib/utils';

import { ParticipantTile, useTracks, VideoTrack } from '@livekit/components-react';

import type { QuickActionType } from '~/components/table/betting/quick-actions';

const COMMUNITY_SLOT_COUNT = 5;
const TILE_SIZE_CLASS = 'w-[5.5rem] min-w-[5.5rem]';
const RAIL_CONTENT_WIDTH_CLASS = 'w-[11.25rem]';
/** Tall enough for compact raise controls so the board does not jump. */
const ACTION_SLOT_HEIGHT_CLASS = 'h-[5.5rem]';

interface MobilePlayersRailProps {
    quickAction: QuickActionType;
    onQuickActionChange: (action: QuickActionType) => void;
    handRoomName: string | null;
    tableId: string;
    showHandCamera: boolean;
    collapsed: boolean;
    onCollapsedChange: (collapsed: boolean) => void;
    onClose: () => void;
}

function FillCard({
    code,
    highlighted = false,
    className,
}: {
    code: string;
    highlighted?: boolean;
    className?: string;
}) {
    const src = cardCodeToFilename(code, true);
    if (!src) return null;

    return (
        <div className={cn('relative h-full w-full', className)}>
            {highlighted && (
                <div className="absolute inset-0 rounded-sm bg-gradient-to-r from-yellow-400/10 to-yellow-500/15 blur-sm scale-110 animate-pulse" />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={src}
                alt={code}
                className={cn(
                    'h-full w-full object-contain select-none [image-rendering:auto]',
                    highlighted && 'ring-2 ring-yellow-400 ring-opacity-75 shadow-lg shadow-yellow-400/50 animate-subtle-bounce',
                )}
                draggable={false}
            />
        </div>
    );
}

function PlaceholderCard({
    card,
    index,
    highlighted = false,
}: {
    card?: string | null;
    index: number;
    highlighted?: boolean;
}) {
    return (
        <div className="relative h-full w-full min-h-0 min-w-0">
            <FillCard code="FD" className="opacity-40" />
            <AnimatePresence>
                {card && (
                    <motion.div
                        key={`dealt-${card}-${index}`}
                        className="absolute inset-0"
                        initial={{ opacity: 0, y: 10, scale: 0.85 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.85 }}
                        transition={{ duration: 0.28, delay: index * 0.06, ease: 'easeOut' }}
                    >
                        <FillCard code={card} highlighted={highlighted} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function RailCommunityCards() {
    const communityCards = useCommunityCards();
    const gameStatus = useGameState();
    const winningCards = useWinningCards();

    const slots = Array.from({ length: COMMUNITY_SLOT_COUNT }, (_, index) => communityCards[index] ?? null);

    return (
        <div className="grid w-full grid-cols-5 gap-0.5">
            {slots.map((card, index) => (
                <div key={`community-${index}`} className="aspect-[5/7] min-w-0">
                    <PlaceholderCard
                        card={card}
                        index={index}
                        highlighted={isWinningCommunityCard(card, gameStatus, winningCards)}
                    />
                </div>
            ))}
        </div>
    );
}

function isWinningCommunityCard(
    card: string | null,
    gameStatus: string | null | undefined,
    winningCards: unknown,
): boolean {
    if (!card || gameStatus !== 'SHOWDOWN' || !Array.isArray(winningCards)) return false;
    return winningCards.some((wc) => String(wc).toUpperCase() === card.toUpperCase());
}

function RailDealerStream() {
    const dealerUserId = useDealerId();
    const trackRefs = useTracks([Track.Source.Camera]);
    const dealerRef = dealerUserId
        ? trackRefs.find(
            (t) => t.participant.identity === dealerUserId && t.source === Track.Source.Camera,
        )
        : null;

    return (
        <div className="hs-dealer-feed-contain hs-overlay-seat flex h-full w-full items-center justify-center overflow-hidden bg-black">
            {dealerRef ? (
                <ParticipantTile trackRef={dealerRef} className="h-full w-full">
                    <VideoTrack
                        trackRef={dealerRef}
                        className="h-full w-full object-contain"
                    />
                </ParticipantTile>
            ) : (
                <div className="px-2 text-center text-[10px] text-zinc-400">
                    Waiting for dealer camera...
                </div>
            )}
        </div>
    );
}

export function MobilePlayersRail({
    quickAction,
    onQuickActionChange,
    handRoomName,
    tableId,
    showHandCamera,
    collapsed,
    onCollapsedChange,
    onClose,
}: MobilePlayersRailProps) {
    const reduceMotion = useReducedMotion();

    return (
        <aside className={cn('h-full shrink-0', collapsed ? 'flex flex-col items-center' : 'relative')}>
            <button
                type="button"
                onClick={onClose}
                aria-label="Back to table"
                className={cn(
                    'z-20 flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-black/80 text-white',
                    collapsed ? 'mt-2' : 'absolute top-2 -left-3',
                )}
            >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
                type="button"
                onClick={() => onCollapsedChange(!collapsed)}
                aria-expanded={!collapsed}
                aria-label={collapsed ? 'Open table rail' : 'Collapse table rail'}
                className={cn(
                    'z-20 flex h-10 w-6 items-center justify-center rounded-md border border-white/15 bg-black/80 text-white',
                    collapsed
                        ? 'my-auto'
                        : 'absolute top-1/2 -left-3 -translate-y-1/2',
                )}
            >
                {collapsed ? (
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                )}
            </button>
            <div
                className={cn(
                    'grid h-full',
                    collapsed
                        ? 'absolute right-0 w-0 overflow-hidden grid-cols-[0fr]'
                        : 'grid-cols-[1fr]',
                    !reduceMotion && 'transition-[grid-template-columns] duration-200 ease-out',
                )}
            >
                <div className="min-w-0 overflow-hidden">
                    <div
                        className="flex h-full w-max flex-col justify-between border-l border-white/10 bg-black/70"
                        style={{
                            paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
                            paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
                            paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
                            paddingLeft: '0.5rem',
                        }}
                    >
                        <div className={cn('flex shrink-0 items-stretch gap-1', RAIL_CONTENT_WIDTH_CLASS)}>
                            <div className={cn('overflow-hidden rounded-lg', TILE_SIZE_CLASS)}>
                                {showHandCamera && (
                                    <HandCamera
                                        compact
                                        size="half"
                                        tableId={tableId}
                                        roomName={handRoomName}
                                    />
                                )}
                            </div>
                            <PotAndBlindsDisplay compact hideTimer className={cn('shrink-0', TILE_SIZE_CLASS)} />
                        </div>

                        <div className={cn('flex min-h-0 flex-1 flex-col', RAIL_CONTENT_WIDTH_CLASS)}>
                            <div className="flex min-h-0 flex-1 items-center">
                                <RailCommunityCards />
                            </div>
                            <div className="min-h-0 flex-1">
                                <RailDealerStream />
                            </div>
                        </div>

                        <div className={cn(
                            'flex shrink-0 flex-col items-stretch justify-end',
                            RAIL_CONTENT_WIDTH_CLASS,
                            ACTION_SLOT_HEIGHT_CLASS,
                        )}>
                            <MobileActionControls
                                quickAction={quickAction}
                                onQuickActionChange={onQuickActionChange}
                                fill
                            />
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
