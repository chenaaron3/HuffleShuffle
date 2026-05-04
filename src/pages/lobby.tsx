import { Lock, Unlock } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import {
    Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from '~/components/ui/dialog';
import { useIsDealerRole } from '~/hooks/use-table-selectors';
import { MAX_SEATS_PER_TABLE } from '~/server/db/schema';
import { api } from '~/utils/api';
import { generateRsaKeyPairForTable } from '~/utils/crypto';

/** Chips deducted from wallet and seated stack when a player joins from the lobby. */
const DEFAULT_JOIN_CHIPS = 1000;

export default function LobbyPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { data: tables, refetch } = api.table.list.useQuery(undefined, { refetchOnWindowFocus: false });

    // Check if user has an existing seat
    const { data: existingSeat } = api.table.checkExistingSeat.useQuery(undefined, {
        enabled: status === 'authenticated',
    });

    const isDealer = useIsDealerRole();
    const createMutation = api.table.create.useMutation({
        onSuccess: async ({ tableId }) => {
            await refetch();
            void router.push(`/table/${tableId}`);
        },
    });

    const dealerJoinMutation = api.table.dealerJoin.useMutation({
        onSuccess: ({ tableId }) => void router.push(`/table/${tableId}`),
        onError: (error) => {
            console.error('Failed to join table as dealer:', error);
            alert(error.message);
        },
    });

    const setTableDeleteLockMutation = api.table.setTableDeleteLock.useMutation({
        onSuccess: async () => {
            await refetch();
        },
        onError: (error) => {
            console.error(error);
            alert(error.message);
        },
    });

    const updateDisplayNameMutation = api.user.updateDisplayName.useMutation();

    const joinMutation = api.table.join.useMutation({
        onSuccess: ({ tableId }) => {
            setPendingJoinTableId(null);
            void router.push(`/table/${tableId}`);
        },
        onError: (error) => {
            console.error(error);
            alert(error.message);
        },
    });

    const joinFlowPending =
        updateDisplayNameMutation.isPending || joinMutation.isPending;

    const [form, setForm] = useState({ name: 'Table', smallBlind: 5, bigBlind: 10, maxSeats: MAX_SEATS_PER_TABLE });
    const [pendingJoinTableId, setPendingJoinTableId] = useState<string | null>(null);
    const [joinDisplayName, setJoinDisplayName] = useState('');

    // Redirect to table if user has an existing seat
    useEffect(() => {
        if (existingSeat?.hasSeat && existingSeat.tableId) {
            void router.push(`/table/${existingSeat.tableId}`);
        }
    }, [existingSeat, router]);

    const createTable = <div className="rounded-lg border border-white/10 bg-zinc-900/50 p-4">
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
            <label className="mt-3 block text-sm text-zinc-300">
                Max seats
                <input type="number" min="2" max={MAX_SEATS_PER_TABLE} value={form.maxSeats}
                    onChange={(e) => setForm({ ...form, maxSeats: Number(e.target.value) })}
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 outline-none ring-0" />
            </label>
            <button
                onClick={() => createMutation.mutate({ name: form.name, smallBlind: form.smallBlind, bigBlind: form.bigBlind, maxSeats: form.maxSeats })}
                className="w-full rounded-md bg-white px-4 py-2 font-medium text-black hover:bg-zinc-200"
            >
                Create Table
            </button>
        </div>
    </div>;

    return (
        <>
            <Head>
                <title>Lobby - HuffleShuffle</title>
            </Head>
            <main className="min-h-screen bg-black text-white">
                <div className="mx-auto max-w-6xl px-6 py-10">
                    <section>
                        <h2 className="mb-4 text-2xl font-semibold">Available Tables</h2>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {(tables ?? []).map((t) => (
                                <div key={t.id} className="rounded-lg border border-white/10 bg-zinc-900/50 p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <h3 className="text-lg font-medium">{t.name}</h3>
                                                {isDealer ? (
                                                    <button
                                                        type="button"
                                                        aria-label={
                                                            t.isLocked
                                                                ? 'Unlock database delete protection for this table'
                                                                : 'Lock database delete protection for this table'
                                                        }
                                                        title={
                                                            t.isLocked
                                                                ? 'Allow deleting this table row in Drizzle Studio / SQL'
                                                                : 'Block deleting this table row until lock is removed'
                                                        }
                                                        onClick={() =>
                                                            setTableDeleteLockMutation.mutate({
                                                                tableId: t.id,
                                                                locked: !t.isLocked,
                                                            })
                                                        }
                                                        disabled={setTableDeleteLockMutation.isPending}
                                                        className={`-m-1 shrink-0 rounded-md p-1 outline-none transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 ${t.isLocked
                                                            ? 'text-amber-400/90'
                                                            : 'text-zinc-500 hover:text-zinc-300'
                                                            }`}
                                                    >
                                                        {t.isLocked ? (
                                                            <Unlock className="size-[1.125rem]" strokeWidth={2} aria-hidden />
                                                        ) : (
                                                            <Lock className="size-[1.125rem]" strokeWidth={2} aria-hidden />
                                                        )}
                                                    </button>
                                                ) : null}
                                            </div>
                                            <p className="text-sm text-zinc-400">Blinds {t.smallBlind}/{t.bigBlind}</p>
                                            <p className="text-xs text-zinc-500">
                                                {t.playerCount}/{t.maxSeats} players
                                                {t.isJoinable ? (
                                                    <span className="ml-2 text-green-400">• Joinable</span>
                                                ) : (
                                                    <span className="ml-2 text-red-400">• Game in progress</span>
                                                )}
                                            </p>
                                        </div>
                                        {isDealer ? (
                                            <button
                                                onClick={() => dealerJoinMutation.mutate({ tableId: t.id })}
                                                disabled={!t.isJoinable || dealerJoinMutation.isPending}
                                                className={`rounded-md px-3 py-2 text-sm font-medium ${t.isJoinable
                                                    ? "bg-white text-black hover:bg-zinc-200"
                                                    : "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                                                    }`}
                                            >
                                                {dealerJoinMutation.isPending ? "Joining..." : "Join Table"}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    if (!t.isJoinable || t.availableSeats === 0) return;
                                                    const defaultName =
                                                        session?.user?.displayName?.trim() ||
                                                        (session?.user?.name ?? '').trim() ||
                                                        'Player';
                                                    setJoinDisplayName(defaultName);
                                                    setPendingJoinTableId(t.id);
                                                }}
                                                disabled={!t.isJoinable || t.availableSeats === 0}
                                                className={`rounded-md px-3 py-2 text-sm font-medium ${t.isJoinable && t.availableSeats > 0
                                                    ? "bg-white text-black hover:bg-zinc-200"
                                                    : "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                                                    }`}
                                            >
                                                {!t.isJoinable ? "Game Active" : t.availableSeats === 0 ? "Full" : "Join"}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div >
            </main >
            <Dialog
                open={!!pendingJoinTableId}
                onOpenChange={(open) => {
                    if (!open && !joinFlowPending) setPendingJoinTableId(null);
                }}
            >
                <DialogContent
                    className="mx-4 max-h-[min(90vh,calc(100%-2rem))] overflow-y-auto sm:mx-auto"
                    onPointerDownOutside={(e) => {
                        if (joinFlowPending) e.preventDefault();
                    }}
                    onEscapeKeyDown={(e) => {
                        if (joinFlowPending) e.preventDefault();
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>Join table</DialogTitle>
                        <DialogDescription>
                            Your display name is saved to your profile and shown at your seat.
                        </DialogDescription>
                    </DialogHeader>
                    <label className="mt-4 block text-sm text-zinc-300">
                        Display name
                        <input
                            value={joinDisplayName}
                            onChange={(e) => setJoinDisplayName(e.target.value)}
                            className="mt-1 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 outline-none ring-0"
                            autoComplete="username"
                            autoFocus
                            maxLength={255}
                            disabled={joinFlowPending}
                        />
                    </label>
                    <div className="mt-6 flex justify-end gap-2">
                        <DialogClose asChild>
                            <button
                                type="button"
                                className="rounded-md px-4 py-2 text-sm text-zinc-300 hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50"
                                disabled={joinFlowPending}
                            >
                                Cancel
                            </button>
                        </DialogClose>
                        <button
                            type="button"
                            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={joinFlowPending || !joinDisplayName.trim()}
                            onClick={async () => {
                                const name = joinDisplayName.trim();
                                if (!name || !pendingJoinTableId) return;
                                try {
                                    await updateDisplayNameMutation.mutateAsync({
                                        displayName: name,
                                    });
                                    const { publicKeyPem } =
                                        await generateRsaKeyPairForTable(pendingJoinTableId);
                                    joinMutation.mutate({
                                        tableId: pendingJoinTableId,
                                        buyIn: DEFAULT_JOIN_CHIPS,
                                        userPublicKey: publicKeyPem,
                                    });
                                } catch (err) {
                                    console.error(err);
                                    alert(
                                        err instanceof Error ? err.message : 'Failed to update display name',
                                    );
                                }
                            }}
                        >
                            {joinFlowPending ? 'Joining…' : 'Join'}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}