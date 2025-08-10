import { useSession } from 'next-auth/react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { GlowingEffect } from '~/components/ui/glowing-effect';
import { api } from '~/utils/api';

export default function TableView() {
    const router = useRouter();
    const { id } = router.query as { id?: string };
    const { data: session } = useSession();

    const tableQuery = api.table.get.useQuery({ tableId: id ?? '' }, { enabled: !!id, refetchInterval: 1500 });
    const action = api.table.action.useMutation({ onSuccess: () => tableQuery.refetch() });

    const snapshot = tableQuery.data;
    const seats = snapshot?.seats ?? [];

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
                            <SeatCard key={s.id} seat={s} index={i} small={i === smallBlindIdx} big={i === bigBlindIdx} />
                        ))}
                    </aside>

                    {/* Center stage */}
                    <section className="order-1 md:order-2 md:col-span-2">
                        <div className="aspect-video w-full rounded-lg border border-white/10 bg-zinc-900/50"></div>
                        <div className="relative mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-zinc-900/50 px-4 py-2">
                            <GlowingEffect disabled={false} blur={4} proximity={80} spread={24} className="rounded-lg" />
                            <div className="flex items-center gap-2">
                                {(snapshot?.game?.communityCards ?? []).map((c: string) => (
                                    <span key={c} className="rounded-md bg-white px-2 py-1 text-sm font-semibold text-black">{c}</span>
                                ))}
                            </div>
                            <div className="text-sm text-zinc-300">Pot: {snapshot?.game?.potTotal ?? 0}</div>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-3">
                            {session?.user?.role === 'dealer' ? (
                                <>
                                    <ActionBtn onClick={() => action.mutate({ tableId: id!, action: 'START_GAME' })}>Start Game</ActionBtn>
                                    <ActionBtn onClick={() => action.mutate({ tableId: id!, action: 'DEAL_CARD', params: { rank: 'A', suit: 's' } })}>Deal</ActionBtn>
                                    <ActionBtn onClick={() => action.mutate({ tableId: id!, action: 'RESET_TABLE' })}>Reset</ActionBtn>
                                </>
                            ) : (
                                <>
                                    <ActionBtn onClick={() => action.mutate({ tableId: id!, action: 'CHECK' })}>Check</ActionBtn>
                                    <ActionBtn onClick={() => action.mutate({ tableId: id!, action: 'RAISE', params: { amount: 20 } })}>Raise +20</ActionBtn>
                                    <ActionBtn onClick={() => action.mutate({ tableId: id!, action: 'FOLD' })}>Fold</ActionBtn>
                                </>
                            )}
                        </div>

                        <div className="mt-6 h-48 rounded-lg border border-white/10 bg-zinc-900/50 p-3 text-sm text-zinc-400">Chat coming soon…</div>
                    </section>

                    {/* Right rail seats */}
                    <aside className="order-3 flex flex-col gap-3">
                        {seats.slice(Math.ceil(seats.length / 2)).map((s: any, i: number) => (
                            <SeatCard key={s.id} seat={s} index={i + Math.ceil(seats.length / 2)} small={i + Math.ceil(seats.length / 2) === smallBlindIdx} big={i + Math.ceil(seats.length / 2) === bigBlindIdx} />
                        ))}
                    </aside>
                </div>
            </main>
        </>
    );
}

function ActionBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
    return (
        <button onClick={onClick} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200">
            {children}
        </button>
    );
}

function SeatCard({ seat, index, small, big }: { seat: any; index: number; small: boolean; big: boolean }) {
    return (
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-900/50 p-3">
            <div>
                <div className="text-sm font-medium">Seat {seat.seatNumber}</div>
                <div className="text-xs text-zinc-400">Buy-in: {seat.buyIn}</div>
            </div>
            <div className="flex items-center gap-2">
                {small && <span className="rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white">S</span>}
                {big && <span className="rounded bg-red-500 px-2 py-1 text-xs font-semibold text-white">B</span>}
            </div>
        </div>
    );
}


