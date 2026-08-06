import { AnimatePresence, motion } from 'framer-motion';
import { Track } from 'livekit-client';
import { Crown } from 'lucide-react';
import * as React from 'react';
import { BackgroundBlurToggle } from '~/components/table/media/background-blur-toggle';
import { CardSlot } from '~/components/table/cards/card-slot';
import { ParticipantMuteButton } from '~/components/table/media/participant-mute-button';
import { RollingNumber } from '~/components/table/chips/chip-animations';
import { useTableQuery } from '~/hooks/use-table-query';
import { useBettingActorSeatId, useEffectiveBigBlind } from '~/hooks/use-table-selectors';
import { useTimerBorder } from '~/hooks/use-timer-border';
import { useInteractionStore } from '~/stores/interaction-store';
import { api } from '~/utils/api';
import { generateRsaKeyPairForTable } from '~/utils/crypto';

import { ParticipantTile, TrackToggle, useTracks, VideoTrack } from '@livekit/components-react';

import { EmptySeatCard } from './empty-seat-card';
import { getSeatSizeClasses } from './seat-size-classes';
import { SeatTurnGlow } from './seat-turn-glow';

import type { SeatWithPlayer } from '~/server/api/routers/table';

export interface SeatCardProps {
    seat: SeatWithPlayer | null;
    index: number;
    seatNumber: number;
    small: boolean;
    big: boolean;
    button: boolean;
    active?: boolean;
    isWinner?: boolean;
    myUserId?: string | null;
    side: 'left' | 'right';
    gameState?: string;
    canMoveSeat?: boolean;
    turnStartTime?: Date | null;
    tableId: string;
    dealerCanControlAudio?: boolean;
    fullHeight?: boolean;
}

export function SeatCard({
    seat,
    seatNumber,
    small,
    big,
    button,
    active,
    isWinner,
    myUserId,
    side,
    gameState,
    canMoveSeat,
    turnStartTime,
    tableId,
    dealerCanControlAudio,
    fullHeight = false,
}: SeatCardProps) {
    const [isMoving, setIsMoving] = React.useState(false);
    const tableQuery = useTableQuery(tableId ?? undefined);
    const updateSnapshot = tableQuery.updateSnapshot;
    const utils = api.useUtils();

    const changeSeat = api.table.changeSeat.useMutation({
        onSuccess: (data) => {
            if (data && tableId) {
                updateSnapshot(data);
                utils.table.get.setData({ tableId }, data);
            }
        },
        onError: (error) => {
            console.error('Change seat failed:', error);
            setIsMoving(false);
        },
        onSettled: () => {
            setIsMoving(false);
        },
    });

    const handleMoveSeat = React.useCallback(async () => {
        if (isMoving || !canMoveSeat) return;
        try {
            setIsMoving(true);
            const { publicKeyPem } = await generateRsaKeyPairForTable(tableId);
            await changeSeat.mutateAsync({
                tableId,
                toSeatNumber: seatNumber,
                userPublicKey: publicKeyPem,
            });
        } catch (e) {
            console.error('Failed to generate keypair for seat move', e);
            setIsMoving(false);
        }
    }, [tableId, isMoving, canMoveSeat, seatNumber, changeSeat]);

    const trackRefs = useTracks([Track.Source.Camera]);
    const videoTrackRef = seat
        ? trackRefs.find(
            (t) => t.participant.identity === seat.player?.id && t.source === Track.Source.Camera,
        )
        : null;
    const playerId = seat?.player?.id ?? null;
    const isSelf = !!myUserId && seat?.player?.id === myUserId;
    const effectiveBigBlind = useEffectiveBigBlind();
    const bettingActorSeatId = useBettingActorSeatId();
    const blindsRemaining = Math.ceil((seat?.buyIn ?? 0) / effectiveBigBlind);
    const isTotalHovered = useInteractionStore((s) => s.isBlindsHovered);
    const setTotalHovered = useInteractionStore((s) => s.setBlindsHovered);

    const totalText = `$${seat?.buyIn ?? 0} total`;
    const blindsText = `${blindsRemaining} ${blindsRemaining === 1 ? 'blind' : 'blinds'}`;

    const timerBorder = useTimerBorder({
        turnStartTime: turnStartTime ?? null,
        isActive: !!(active && gameState === 'BETTING'),
    });

    if (!seat) {
        return (
            <EmptySeatCard
                seatNumber={seatNumber}
                fullHeight={fullHeight}
                canMoveSeat={canMoveSeat}
                isMoving={isMoving}
                onMoveSeat={() => void handleMoveSeat()}
            />
        );
    }

    const borderStyle = timerBorder.getBorderStyle(!!isWinner, !!active, gameState);
    const { heightClass, widthClass, aspectStyle } = getSeatSizeClasses(fullHeight);

    const isBettingTurn =
        gameState === 'BETTING' &&
        !!bettingActorSeatId &&
        seat.id === bettingActorSeatId;
    const showGlow = !!isWinner || isBettingTurn;
    const glowRgb = isWinner
        ? '250, 204, 21'
        : timerBorder.isWarning
            ? '239, 68, 68'
            : '59, 130, 246';

    return (
        <motion.div
            id={`seat-${seat.id}`}
            className={`relative isolate flex ${heightClass} ${widthClass} flex-col rounded-xl bg-zinc-900/60 backdrop-blur-sm overflow-visible`}
            style={fullHeight ? { ...borderStyle, ...aspectStyle } : borderStyle}
        >
            {showGlow && <SeatTurnGlow seatId={seat.id} glowRgb={glowRgb} />}

            <div className="relative z-10 flex h-full w-full min-h-0 flex-col">
                <div className="group relative h-full w-full overflow-hidden rounded-xl bg-black">
                    {videoTrackRef ? (
                        isSelf ? (
                            <>
                                <div className="absolute inset-0">
                                    <VideoTrack trackRef={videoTrackRef} className="h-full w-full object-cover" />
                                </div>
                                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                                <div className="pointer-events-auto absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <BackgroundBlurToggle />
                                    <TrackToggle
                                        source={Track.Source.Microphone}
                                        showIcon
                                        className="rounded-md bg-white/90 text-xs font-medium text-black hover:bg-white"
                                        aria-label="Toggle microphone"
                                        title="Toggle microphone"
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="absolute inset-0">
                                    <ParticipantTile trackRef={videoTrackRef} className="h-full w-full">
                                        <VideoTrack trackRef={videoTrackRef} className="h-full w-full object-cover" />
                                    </ParticipantTile>
                                </div>
                                <ParticipantMuteButton
                                    tableId={tableId}
                                    playerId={playerId}
                                    canControlAudio={dealerCanControlAudio}
                                />
                            </>
                        )
                    ) : (
                        <div className="flex h-full items-center justify-center text-sm text-zinc-500 font-medium">
                            No Video
                        </div>
                    )}

                    {button && (
                        <div className="absolute top-2 left-2 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-black shadow-lg border border-gray-400/50">
                            BU
                        </div>
                    )}
                    {small && !button && (
                        <div className="absolute top-2 left-2 rounded-lg bg-blue-600 px-2 py-1 text-xs font-semibold text-white shadow-lg border border-green-500/30">
                            SB
                        </div>
                    )}
                    {big && !button && (
                        <div className="absolute top-2 left-2 rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white shadow-lg border border-red-500/50">
                            BB
                        </div>
                    )}
                </div>

                <div className="absolute bottom-0 left-0 right-0 px-2 pb-2 pt-1 bg-gradient-to-t from-black/50 via-black/30 to-transparent">
                    <div className="flex items-end justify-between">
                        <div className="flex flex-col gap-1 items-start">
                            {gameState === 'SHOWDOWN' && (seat.winAmount ?? 0) > 0 && (
                                <div className="w-fit rounded-full text-xs font-medium text-center shadow-lg bg-green-600/30 border border-green-400/50 px-3 py-1 text-green-300">
                                    <RollingNumber value={seat.winAmount ?? 0} prefix="+$" />
                                </div>
                            )}
                            {seat.seatStatus === 'all-in' && (
                                <div className="w-fit rounded-full text-xs font-medium text-center shadow-lg px-3 py-1 bg-yellow-600/30 border border-yellow-400/50 text-yellow-300">
                                    ALL-IN
                                </div>
                            )}
                            {seat.seatStatus === 'folded' && (
                                <div className="w-fit rounded-full text-xs font-medium text-center shadow-lg px-3 py-1 bg-zinc-600/30 border border-zinc-400/50 text-zinc-300">
                                    FOLDED
                                </div>
                            )}
                            {seat.seatStatus === 'eliminated' && (
                                <div className="w-fit rounded-full text-xs font-medium text-center shadow-lg px-3 py-1 bg-red-600/30 border border-red-400/50 text-red-300">
                                    ELIMINATED
                                </div>
                            )}
                            {seat.seatStatus === 'active' && gameState === 'BETTING' && seat.lastAction && (
                                <div
                                    className={`w-fit rounded-full text-xs font-medium text-center shadow-lg px-3 py-1 ${seat.lastAction === 'RAISE'
                                        ? 'bg-red-600/30 border border-red-400/50 text-red-300'
                                        : seat.lastAction === 'CALL'
                                            ? 'bg-blue-600/30 border border-blue-400/50 text-blue-300'
                                            : seat.lastAction === 'CHECK'
                                                ? 'bg-green-600/30 border border-green-400/50 text-green-300'
                                                : 'bg-zinc-600/30 border border-zinc-400/50 text-zinc-300'
                                        }`}
                                >
                                    {seat.lastAction}
                                </div>
                            )}
                            <div
                                className="rounded-full text-xs font-medium shadow-lg bg-green-600/30 border border-green-400/50 px-3 py-1 text-green-300 cursor-default overflow-hidden"
                                onMouseEnter={() => setTotalHovered(true)}
                                onMouseLeave={() => setTotalHovered(false)}
                            >
                                <div className="relative overflow-hidden">
                                    <motion.span
                                        className="block whitespace-nowrap"
                                        animate={{
                                            y: isTotalHovered ? '-100%' : '0%',
                                            opacity: isTotalHovered ? 0 : 1,
                                        }}
                                        transition={{ duration: 0.18, ease: 'easeOut' }}
                                    >
                                        {totalText}
                                    </motion.span>
                                    <motion.span
                                        className="absolute top-0 left-0 right-0 whitespace-nowrap"
                                        animate={{
                                            y: isTotalHovered ? '0%' : '100%',
                                            opacity: isTotalHovered ? 1 : 0,
                                        }}
                                        transition={{ duration: 0.18, ease: 'easeOut' }}
                                    >
                                        {blindsText}
                                    </motion.span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-1 flex-row-reverse">
                            {Array.from({ length: 2 }, (_, cardIndex) => {
                                const card = Array.isArray(seat.cards) ? seat.cards[cardIndex] : null;
                                return (
                                    <CardSlot
                                        key={`seat-${seat.id}-card-slot-${cardIndex}`}
                                        card={card}
                                        index={cardIndex}
                                        size={30}
                                        gameState={gameState}
                                        winningCards={seat.winningCards ?? undefined}
                                        seatId={seat.id}
                                        compact={true}
                                        seatStatus={seat.seatStatus}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>

                <AnimatePresence>
                    {seat.currentBet > 0 && (
                        <motion.div
                            className={`absolute top-1/2 transform -translate-y-1/2 z-20 pointer-events-none ${side === 'right' ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2'}`}
                            initial={{ scale: 0, opacity: 0, rotate: -180 }}
                            animate={{ scale: 1, opacity: 1, rotate: 0 }}
                            exit={{ scale: 0, opacity: 0, rotate: 180 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20, duration: 0.6 }}
                        >
                            <div className="relative">
                                <div className="absolute inset-0 rounded-full bg-black/30 blur-sm scale-95" />
                                <div className="relative rounded-full border-2 shadow-lg flex items-center justify-center bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 border-yellow-300 w-14 h-14">
                                    <div className="absolute inset-1 rounded-full border border-yellow-200/50" />
                                    <RollingNumber value={seat.currentBet} className="relative text-sm font-bold" prefix="$" />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {gameState === 'SHOWDOWN' && seat.handType && (
                    <div
                        className={`absolute top-1/2 transform -translate-y-1/2 z-20 pointer-events-none ${side === 'right'
                            ? 'left-0 -translate-x-1/2'
                            : 'right-0 translate-x-1/2'
                            }`}
                    >
                        <div className="relative">
                            <div className="absolute inset-0 bg-black/30 rounded-full blur-sm scale-95" />
                            <div
                                className={`relative px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center justify-center ${isWinner
                                    ? 'bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-black shadow-yellow-500/50'
                                    : 'bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 text-white'
                                    }`}
                            >
                                {seat.handType}
                            </div>
                        </div>
                    </div>
                )}

                <div className="absolute top-2 right-2">
                    <AnimatePresence>
                        {isWinner && (
                            <motion.div
                                aria-hidden
                                className="absolute -top-3 -left-2 z-20 pointer-events-none"
                                initial={{ y: 12, opacity: 0, scale: 0.5 }}
                                animate={{ y: 0, opacity: 1, scale: 1 }}
                                exit={{ y: 12, opacity: 0, scale: 0.5 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                            >
                                <motion.div
                                    animate={{ rotate: [-24, -12, -24] }}
                                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                                >
                                    <Crown
                                        className="h-5 w-5 text-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.7)]"
                                        fill="currentColor"
                                    />
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div
                        className={`relative z-10 rounded-lg px-3 py-1 text-xs font-semibold backdrop-blur-sm border ${isSelf
                            ? 'bg-emerald-600/20 border-emerald-400/50 text-emerald-200'
                            : 'bg-black/80 border-white/10 text-white'
                            }`}
                    >
                        {isSelf ? 'You' : (seat.player?.displayName ?? 'Player')}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
