import { CardSlot } from '~/components/table/cards/card-slot';
import { TextHoverEffect } from '~/components/effects/text-hover-effect';

import { getSeatSizeClasses } from './seat-size-classes';

interface EmptySeatCardProps {
    seatNumber: number;
    fullHeight?: boolean;
    canMoveSeat?: boolean;
    isMoving: boolean;
    onMoveSeat: () => void;
}

export function EmptySeatCard({
    seatNumber,
    fullHeight = false,
    canMoveSeat,
    isMoving,
    onMoveSeat,
}: EmptySeatCardProps) {
    const { heightClass, widthClass, aspectStyle } = getSeatSizeClasses(fullHeight);

    return (
        <div
            className={`group relative flex ${heightClass} ${widthClass} flex-col rounded-xl border border-dashed border-zinc-500/50 bg-zinc-900/30 backdrop-blur overflow-hidden`}
            style={aspectStyle}
        >
            <div
                onClick={onMoveSeat}
                className={`relative h-full w-full overflow-hidden rounded-xl border bg-zinc-800/60 ${isMoving
                    ? 'border-zinc-400/60 cursor-wait'
                    : canMoveSeat
                        ? 'border-zinc-500/40 group-hover:border-zinc-300/70 cursor-pointer'
                        : 'border-zinc-500/40'
                    }`}
            >
                {isMoving ? (
                    <div className="flex h-full items-center justify-center text-sm font-medium text-zinc-300">
                        Moving…
                    </div>
                ) : (
                    <>
                        <div className="flex h-full items-center justify-center w-full">
                            <div className="w-full h-20">
                                <TextHoverEffect
                                    text="EMPTY"
                                    duration={0.3}
                                    id={`empty-seat-${seatNumber}`}
                                />
                            </div>
                        </div>
                        {canMoveSeat && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-sm font-semibold text-white bg-white/10 border border-white/20 rounded-md px-3 py-1 backdrop-blur-sm">
                                    Move Here
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 px-2 pb-2 pt-1 bg-gradient-to-t from-black/50 via-black/30 to-transparent">
                <div className="flex items-end justify-between">
                    <div className="flex flex-col gap-1 items-start">
                        <div className="rounded-full text-xs font-medium w-fit border border-zinc-700/50 px-3 py-1 bg-zinc-700/40 text-zinc-400">
                            Seat {seatNumber + 1}
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <CardSlot card={null} index={0} size={30} />
                        <CardSlot card={null} index={1} size={30} />
                    </div>
                </div>
            </div>
        </div>
    );
}
