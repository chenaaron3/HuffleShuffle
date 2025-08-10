import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { api } from '~/utils/api';

export default function LobbyPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { data: tables, refetch } = api.table.list.useQuery(undefined, { refetchOnWindowFocus: false });

    const isDealer = session?.user?.role === 'dealer';
    const createMutation = api.table.create.useMutation({
        onSuccess: async ({ tableId }) => {
            await refetch();
            void router.push(`/table/${tableId}`);
        },
    });

    const joinMutation = api.table.join.useMutation({
        onSuccess: ({ tableId }) => void router.push(`/table/${tableId}`),
    });

    const [form, setForm] = useState({ name: 'Table', smallBlind: 5, bigBlind: 10, buyIn: 200 });

    return (
        <>
            <Head>
                <title>Lobby - HuffleShuffle</title>
            </Head>
            <main className="min-h-screen bg-black text-white">
                <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-10 md:grid-cols-3">
                    <section className="md:col-span-2">
                        <h2 className="mb-4 text-2xl font-semibold">Available Tables</h2>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {(tables ?? []).map((t) => (
                                <div key={t.id} className="rounded-lg border border-white/10 bg-zinc-900/50 p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-medium">{t.name}</h3>
                                            <p className="text-sm text-zinc-400">Blinds {t.smallBlind}/{t.bigBlind}</p>
                                        </div>
                                        {isDealer ? (
                                            <Link href={`/table/${t.id}`} className="rounded-md bg-white px-3 py-2 text-sm font-medium text-black hover:bg-zinc-200">
                                                Manage
                                            </Link>
                                        ) : (
                                            <button
                                                onClick={() => joinMutation.mutate({ tableId: t.id, buyIn: form.buyIn })}
                                                className="rounded-md bg-white px-3 py-2 text-sm font-medium text-black hover:bg-zinc-200"
                                            >
                                                Join
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <aside className="space-y-6">
                        {isDealer ? (
                            <div className="rounded-lg border border-white/10 bg-zinc-900/50 p-4">
                                <h3 className="mb-3 text-lg font-medium">Create a Table</h3>
                                <div className="space-y-3">
                                    <label className="block text-sm text-zinc-300">
                                        Name
                                        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 outline-none ring-0" />
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <label className="block text-sm text-zinc-300">
                                            Small blind
                                            <input type="number" value={form.smallBlind}
                                                onChange={(e) => setForm({ ...form, smallBlind: Number(e.target.value) })}
                                                className="mt-1 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 outline-none ring-0" />
                                        </label>
                                        <label className="block text-sm text-zinc-300">
                                            Big blind
                                            <input type="number" value={form.bigBlind}
                                                onChange={(e) => setForm({ ...form, bigBlind: Number(e.target.value) })}
                                                className="mt-1 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 outline-none ring-0" />
                                        </label>
                                    </div>
                                    <button
                                        onClick={() => createMutation.mutate({ name: form.name, smallBlind: form.smallBlind, bigBlind: form.bigBlind })}
                                        className="w-full rounded-md bg-white px-4 py-2 font-medium text-black hover:bg-zinc-200"
                                    >
                                        Create Table
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-lg border border-white/10 bg-zinc-900/50 p-4">
                                <h3 className="mb-3 text-lg font-medium">Set Buy-In</h3>
                                <label className="block text-sm text-zinc-300">
                                    Amount
                                    <input type="number" value={form.buyIn}
                                        onChange={(e) => setForm({ ...form, buyIn: Number(e.target.value) })}
                                        className="mt-1 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 outline-none ring-0" />
                                </label>
                                <p className="mt-2 text-xs text-zinc-400">Choose the amount transferred from your wallet when joining.</p>
                            </div>
                        )}
                    </aside>
                </div>
            </main>
        </>
    );
}


