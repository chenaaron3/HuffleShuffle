import { useSession } from 'next-auth/react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { CardImage } from '~/components/ui/card-img';
import { GlowingEffect } from '~/components/ui/glowing-effect';
import { api } from '~/utils/api';

import type { SeatWithPlayer } from '~/server/api/routers/table';
export default function TableView() {
    const router = useRouter();
    const { id } = router.query as { id?: string };
    const { data: session } = useSession();

    const tableQuery = api.table.get.useQuery({ tableId: id ?? '' }, { enabled: !!id });
    const action = api.table.action.useMutation({ onSuccess: () => tableQuery.refetch() });

    const [dealRank, setDealRank] = useState<string>('A');
    const [dealSuit, setDealSuit] = useState<string>('s');

    const snapshot = tableQuery.data;
    const seats = snapshot?.seats ?? [];
    const state: string | undefined = snapshot?.game?.state as any;
    const dealSeatId = state === 'DEAL_HOLE_CARDS' ? (snapshot?.game?.assignedSeatId ?? null) : null;
    const bettingActorSeatId = state === 'BETTING' ? (snapshot?.game?.assignedSeatId ?? null) : null;
    const currentUserSeatId = seats.find((s: any) => s.playerId === session?.user?.id)?.id ?? null;
    const highlightedSeatId = dealSeatId ?? bettingActorSeatId;

    const dealerSeatId = snapshot?.game?.dealerButtonSeatId ?? null;
    const dealerIdx = dealerSeatId ? seats.findIndex((s: any) => s.id === dealerSeatId) : -1;
    const smallBlindIdx = dealerIdx >= 0 ? (dealerIdx + 1) % seats.length : -1;
    const bigBlindIdx = dealerIdx >= 0 ? (dealerIdx + 2) % seats.length : -1;

    return (
        <>
            <Head>
                <title>Table - HuffleShuffle</title>
            </Head>
            <main className="min-h-screen bg-black text-white">
                <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-4">
                    {/* Left rail seats */}
                    <aside className="order-2 flex flex-col gap-3 md:order-1">
                        {seats.slice(0, Math.ceil(seats.length / 2)).map((s: any, i: number) => (
                            <SeatCard
                                key={s.id}
                                seat={s}
                                index={i}
                                small={i === smallBlindIdx}
                                big={i === bigBlindIdx}
                                active={!!highlightedSeatId && s.id === highlightedSeatId}
                            />
                        ))}
                    </aside>

                    {/* Center stage */}
                    <section className="order-1 md:order-2 md:col-span-2">
                        <div className="aspect-video w-full rounded-lg border border-white/10 bg-zinc-900/50"></div>
                        <div className="relative mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-zinc-900/50 px-4 py-2">
                            <GlowingEffect disabled={false} blur={4} proximity={80} spread={24} className="rounded-lg" />
                            <div className="flex items-center gap-2">
                                {(snapshot?.game?.communityCards ?? []).map((c: string) => (
                                    <CardImage key={c} code={c} size={36} />
                                ))}
                            </div>
                            <div className="text-sm text-zinc-300">Pot: {snapshot?.game?.potTotal ?? 0}</div>
                        </div>

                        <GameStatusBanner
                            isDealer={session?.user?.role === 'dealer'}
                            state={state}
                            seats={seats}
                            activeSeatId={highlightedSeatId}
                            bettingActorSeatId={bettingActorSeatId}
                            currentUserSeatId={currentUserSeatId}
                        />

                        <div className="mt-4 grid grid-cols-5 gap-3">
                            {session?.user?.role === 'dealer' ? (
                                <>
                                    <select
                                        aria-label="Rank"
                                        value={dealRank}
                                        onChange={(e) => setDealRank(e.target.value)}
                                        className="rounded-md bg-white px-2 py-2 text-sm font-medium text-black hover:bg-zinc-200"
                                    >
                                        {['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'].map((r) => (
                                            <option key={r} value={r}>{r}</option>
                                        ))}
                                    </select>
                                    <select
                                        aria-label="Suit"
                                        value={dealSuit}
                                        onChange={(e) => setDealSuit(e.target.value)}
                                        className="rounded-md bg-white px-2 py-2 text-sm font-medium text-black hover:bg-zinc-200"
                                    >
                                        {[
                                            { value: 's', label: 'Spades (s)' },
                                            { value: 'h', label: 'Hearts (h)' },
                                            { value: 'd', label: 'Diamonds (d)' },
                                            { value: 'c', label: 'Clubs (c)' },
                                        ].map((s) => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                    </select>
                                    <ActionBtn onClick={() => action.mutate({ tableId: id!, action: 'START_GAME' })}>Start Game</ActionBtn>
                                    <ActionBtn onClick={() => action.mutate({ tableId: id!, action: 'DEAL_CARD', params: { rank: dealRank, suit: dealSuit } })}>Deal</ActionBtn>
                                    <ActionBtn onClick={() => action.mutate({ tableId: id!, action: 'RESET_TABLE' })}>Reset</ActionBtn>
                                </>
                            ) : (
                                <>
                                    <ActionBtn disabled={state !== 'BETTING' || currentUserSeatId !== bettingActorSeatId} onClick={() => action.mutate({ tableId: id!, action: 'CHECK' })}>Check</ActionBtn>
                                    <ActionBtn disabled={state !== 'BETTING' || currentUserSeatId !== bettingActorSeatId} onClick={() => action.mutate({ tableId: id!, action: 'RAISE', params: { amount: 20 } })}>Raise +20</ActionBtn>
                                    <ActionBtn disabled={state !== 'BETTING' || currentUserSeatId !== bettingActorSeatId} onClick={() => action.mutate({ tableId: id!, action: 'FOLD' })}>Fold</ActionBtn>
                                </>
                            )}
                        </div>


                        <div className="mt-6 h-48 rounded-lg border border-white/10 bg-zinc-900/50 p-3 text-sm text-zinc-400">Chat coming soon…</div>
                    </section>

                    {/* Right rail seats */}
                    <aside className="order-3 flex flex-col gap-3">
                        {seats.slice(Math.ceil(seats.length / 2)).map((s: any, i: number) => (
                            <SeatCard
                                key={s.id}
                                seat={s}
                                index={i + Math.ceil(seats.length / 2)}
                                small={i + Math.ceil(seats.length / 2) === smallBlindIdx}
                                big={i + Math.ceil(seats.length / 2) === bigBlindIdx}
                                active={!!highlightedSeatId && s.id === highlightedSeatId}
                            />
                        ))}
                    </aside>
                </div>
            </main>
        </>
    );
}

function ActionBtn({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
    return (
        <button onClick={onClick} disabled={disabled} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60">
            {children}
        </button>
    );
}

function SeatCard({ seat, index, small, big, active }: { seat: SeatWithPlayer; index: number; small: boolean; big: boolean; active?: boolean }) {
    return (
        <div className="flex items-center justify-between rounded-lg border bg-zinc-900/50 p-3"
            style={{ borderColor: active ? 'rgb(234 179 8 / 0.5)' : 'rgb(255 255 255 / 0.1)' }}>
            <div>
                <div className="text-sm font-medium">{seat.player?.name ?? 'Player'}</div>
                <div className="text-xs text-zinc-400">Total Chips: {seat.buyIn} chips</div>
                <div className="text-xs text-zinc-400">Current Bet: {seat.currentBet} chips</div>
                {Array.isArray(seat.cards) && seat.cards.length > 0 && (
                    <div className="mt-2 flex gap-1">
                        {seat.cards.map((c: string) => (
                            <CardImage key={c} code={c} />
                        ))}
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2">
                {active && <span className="rounded bg-yellow-500/90 px-2 py-1 text-xs font-semibold text-black">Next</span>}
                {small && <span className="rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white">S</span>}
                {big && <span className="rounded bg-red-500 px-2 py-1 text-xs font-semibold text-white">B</span>}
            </div>
        </div>
    );
}

function GameStatusBanner({ isDealer, state, seats, activeSeatId, bettingActorSeatId, currentUserSeatId }: { isDealer: boolean; state?: string; seats: any[]; activeSeatId: string | null; bettingActorSeatId?: string | null; currentUserSeatId?: string | null }) {
    if (!state) return null;
    const dealing = ['DEAL_HOLE_CARDS', 'DEAL_FLOP', 'DEAL_TURN', 'DEAL_RIVER'].includes(state);
    const betting = state === 'BETTING';
    if (!dealing && !betting) return null;

    let label = '' as string;
    if (state === 'DEAL_HOLE_CARDS') {
        const seat = seats.find((s: any) => s.id === activeSeatId);
        label = seat ? `Deal next hole card to ${seat.player?.name ?? 'a player'}` : 'Deal next hole card';
    } else if (state === 'DEAL_FLOP') {
        label = 'Deal the flop';
    } else if (state === 'DEAL_TURN') {
        label = 'Deal the turn';
    } else if (state === 'DEAL_RIVER') {
        label = 'Deal the river';
    } else if (betting) {
        const seat = seats.find((s: any) => s.id === bettingActorSeatId);
        const who = seat ? `${seat.player?.name ?? 'a player'}` : 'a player';
        const yourTurn = currentUserSeatId && bettingActorSeatId && currentUserSeatId === bettingActorSeatId;
        label = yourTurn ? 'Your turn to act' : `${who}'s turn to act`;
    }

    const isDealerBanner = dealing;
    const bannerText = isDealerBanner
        ? (isDealer ? `Your action: ${label}` : `Waiting for dealer: ${label}`)
        : label;
    const bannerClass = dealing
        ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200'
        : 'border-sky-500/30 bg-sky-500/10 text-sky-200';

    return (
        <div className={`mt-3 flex items-center gap-3 rounded-lg border px-4 py-2 ${bannerClass}`}>
            <span className={`h-2 w-2 animate-pulse rounded-full ${dealing ? 'bg-yellow-400' : 'bg-sky-400'}`} />
            <span className="text-sm">{bannerText}</span>
        </div>
    );
}

