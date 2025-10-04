import * as React from 'react';
import { CardImage } from '~/components/ui/card-img';
import { gameEvents } from '~/server/db/schema';

import type { SeatWithPlayer } from '~/server/api/routers/table';
type EventRow = typeof gameEvents.$inferSelect;

function formatTime(dateStr: string | Date): string {
    try {
        const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
        return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
        return '';
    }
}

function seatName(seatId: string | undefined | null, seats: SeatWithPlayer[]): string {
    if (!seatId) return 'Unknown';
    const s = seats.find((x) => x.id === seatId);
    return s?.player?.name ?? (typeof s?.seatNumber === 'number' ? `Seat ${s.seatNumber + 1}` : 'Unknown');
}

export function EventFeed({
    events,
    seats,
}: {
    events: EventRow[];
    seats: SeatWithPlayer[];
}) {
    return (
        <div className="rounded-xl overflow-hidden shadow-2xl w-full h-40 border border-zinc-600/50 bg-zinc-900/50 backdrop-blur">
            <div className="h-full w-full overflow-y-auto">
                <ul className="divide-y divide-zinc-800">
                    {events.map((ev) => (
                        <li key={ev.id} className="px-2 py-1 text-xs text-zinc-200">
                            <div className="flex items-start gap-2">
                                <span className="text-[10px] text-zinc-500 min-w-[46px]">[{formatTime(ev.createdAt as any)}]</span>
                                <div className="flex-1">
                                    <EventLine ev={ev} seats={seats} />
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

function EventLine({ ev, seats }: { ev: EventRow; seats: SeatWithPlayer[] }) {
    const t = ev.type;
    const d: any = ev.details ?? {};

    if (t === 'FLOP' || t === 'TURN' || t === 'RIVER') {
        const cards: string[] = Array.isArray(d.communityAll) ? d.communityAll : [];
        const label = t === 'FLOP' ? 'The Flop:' : t === 'TURN' ? 'The Turn:' : 'The River:';
        return (
            <div className="flex items-center gap-1">
                <span className="font-semibold text-zinc-100">{label}</span>
                <div className="flex items-center gap-1">
                    {cards.map((c) => (
                        <CardImage key={c} code={c} size={18} compact className="rounded" />
                    ))}
                </div>
            </div>
        );
    }

    if (t === 'START_GAME') {
        const name = seatName(d.dealerButtonSeatId, seats);
        return (
            <span className="text-zinc-300">New hand starts. Dealer: <span className="font-medium text-zinc-100">{name}</span></span>
        );
    }

    if (t === 'END_GAME') {
        const winners: Array<{ seatId: string; amount?: number }> = Array.isArray(d.winners) ? d.winners : [];
        if (!winners.length) return <span className="text-zinc-300">Hand ended.</span>;
        return (
            <span className="text-zinc-300">
                Hand ended. Winners:{' '}
                {winners.map((w, i) => (
                    <span key={w.seatId}>
                        {i > 0 ? ', ' : ''}
                        <span className="font-medium text-zinc-100">{seatName(w.seatId, seats)}</span>
                        {typeof w.amount === 'number' ? ` +${w.amount}` : ''}
                    </span>
                ))}
            </span>
        );
    }

    if (t === 'RAISE') {
        const name = seatName(d.seatId, seats);
        const amt = typeof d.total === 'number' ? d.total : undefined;
        return (
            <span>
                <span className="font-medium text-red-400">{name}</span> raises{typeof amt === 'number' ? ` ${amt}` : ''}
            </span>
        );
    }

    if (t === 'CALL') {
        const name = seatName(d.seatId, seats);
        return (
            <span>
                <span className="font-medium text-zinc-100">{name}</span> calls
            </span>
        );
    }

    if (t === 'CHECK') {
        const name = seatName(d.seatId, seats);
        return (
            <span>
                <span className="font-medium text-zinc-100">{name}</span> checks
            </span>
        );
    }

    if (t === 'FOLD') {
        const name = seatName(d.seatId, seats);
        return (
            <span>
                <span className="font-medium text-zinc-100">{name}</span> folds
            </span>
        );
    }

    // Fallback
    return <span className="text-zinc-300">{t}</span>;
}


