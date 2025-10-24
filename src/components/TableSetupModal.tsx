import { Bot, Settings, X } from 'lucide-react';
import * as React from 'react';
import { api } from '~/utils/api';

type Tab = 'hardware' | 'bots';

// Bot user IDs (must match server-side constants)
const BOT_USER_IDS = [
    "bot00000-0000-0000-0000-000000000000",
    "bot00000-0000-0000-0000-000000000001",
    "bot00000-0000-0000-0000-000000000002",
    "bot00000-0000-0000-0000-000000000003",
    "bot00000-0000-0000-0000-000000000004",
    "bot00000-0000-0000-0000-000000000005",
    "bot00000-0000-0000-0000-000000000006",
    "bot00000-0000-0000-0000-000000000007",
];

export function TableSetupModal({ tableId, open, onClose }: { tableId: string; open: boolean; onClose: () => void }) {
    const [activeTab, setActiveTab] = React.useState<Tab>('hardware');
    const [dealerSerial, setDealerSerial] = React.useState('');
    const [dealerPublicKey, setDealerPublicKey] = React.useState('');
    const [scannerSerial, setScannerSerial] = React.useState('');
    const [scannerPublicKey, setScannerPublicKey] = React.useState('');
    const [hand, setHand] = React.useState<string[]>(Array(8).fill(''));
    const [handPub, setHandPub] = React.useState<string[]>(Array(8).fill(''));
    const [dragIndex, setDragIndex] = React.useState<number | null>(null);

    const query = api.setup.get.useQuery({ tableId }, { enabled: open && !!tableId });
    const saveMut = api.setup.save.useMutation({ onSuccess: () => onClose() });

    const tableQuery = api.table.get.useQuery({ tableId }, { enabled: open && !!tableId });
    const addBotMut = api.table.addBot.useMutation({
        onSuccess: () => {
            void tableQuery.refetch();
        }
    });
    const removeBotMut = api.table.removeBot.useMutation({
        onSuccess: () => {
            void tableQuery.refetch();
        }
    });

    React.useEffect(() => {
        if (query.data) {
            setDealerSerial(query.data.dealerSerial ?? '');
            setScannerSerial(query.data.scannerSerial ?? '');
            setHand((query.data.handSerials ?? Array(8).fill('')).slice(0, 8));
            const bySerial: Record<string, string> = {};
            (query.data.available ?? []).forEach((d: any) => { bySerial[d.serial] = d.publicKey ?? ''; });
            setDealerPublicKey(bySerial[query.data.dealerSerial ?? ''] ?? '');
            setScannerPublicKey(bySerial[query.data.scannerSerial ?? ''] ?? '');
            setHandPub((query.data.handSerials ?? Array(8).fill('')).slice(0, 8).map((s: string) => bySerial[s] ?? ''));
        }
    }, [query.data]);

    if (!open) return null;

    function onDragStart(idx: number) { setDragIndex(idx); }
    function onDragOver(e: React.DragEvent<HTMLDivElement>) { e.preventDefault(); }
    function onDrop(idx: number) {
        if (dragIndex === null || dragIndex === idx) return;
        const next = hand.slice();
        const [moved] = next.splice(dragIndex, 1);
        next.splice(idx, 0, moved ?? '');
        setHand(next);
        setDragIndex(null);
    }

    const isBot = (userId: string | null | undefined) => {
        if (!userId) return false;
        return BOT_USER_IDS.includes(userId);
    };

    // Create array of all 8 seat slots with bot status
    const seatSlots = Array.from({ length: 8 }, (_, index) => {
        const seat = tableQuery.data?.seats.find(s => s.seatNumber === index);
        return {
            seatNumber: index,
            seat,
            isBot: seat ? isBot(seat.playerId) : false,
            isEmpty: !seat,
        };
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-lg bg-zinc-900 text-white shadow-lg flex flex-col">
                <div className="sticky top-0 z-10 border-b border-white/10 bg-zinc-900/95 backdrop-blur">
                    <div className="flex items-center justify-between px-4 py-3">
                        <h3 className="text-lg font-semibold">Table Setup</h3>
                        <button onClick={onClose} className="text-sm text-zinc-300 hover:text-white">Close</button>
                    </div>
                    {/* Tabs */}
                    <div className="flex gap-1 px-4 pb-2">
                        <button
                            onClick={() => setActiveTab('hardware')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors ${activeTab === 'hardware'
                                ? 'bg-zinc-800 text-white border-b-2 border-blue-500'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                                }`}
                        >
                            <Settings className="w-4 h-4" />
                            <span className="text-sm font-medium">Hardware</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('bots')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors ${activeTab === 'bots'
                                ? 'bg-zinc-800 text-white border-b-2 border-blue-500'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                                }`}
                        >
                            <Bot className="w-4 h-4" />
                            <span className="text-sm font-medium">Bots</span>
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">{activeTab === 'hardware' && (
                    <div className="grid gap-5">
                        <section className="grid gap-2">
                            <div>
                                <div className="mb-1 text-sm text-zinc-300">Dealer Camera</div>
                                <input value={dealerSerial} onChange={(e) => setDealerSerial(e.target.value)} className="w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 outline-none" placeholder="Dealer Pi serial" />
                            </div>
                        </section>
                        <section className="grid gap-2">
                            <div>
                                <div className="mb-1 text-sm text-zinc-300">Scanner</div>
                                <input value={scannerSerial} onChange={(e) => setScannerSerial(e.target.value)} className="w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 outline-none" placeholder="Scanner Pi serial" />
                                <textarea
                                    placeholder="Scanner Public Key (PEM)"
                                    value={scannerPublicKey ?? ''}
                                    onChange={(e) => setScannerPublicKey(e.target.value)}
                                    className="w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-xs outline-none min-h-[80px]"
                                    rows={3}
                                />
                            </div>
                        </section>
                        <section>
                            <div className="mb-2 text-sm text-zinc-300">Hand Cameras (drag to reorder)</div>
                            <div className="grid grid-cols-1 gap-3">
                                {hand.map((s, idx) => (
                                    <div
                                        key={idx}
                                        draggable
                                        onDragStart={() => onDragStart(idx)}
                                        onDragOver={onDragOver}
                                        onDrop={() => onDrop(idx)}
                                        className="flex items-start justify-between rounded-md border border-white/10 bg-black/40 px-3 py-2"
                                    >
                                        <div className="flex flex-1 items-start gap-3">
                                            <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded bg-white/10 text-xs">{idx + 1}</span>
                                            <div className="flex-1">
                                                <input
                                                    value={s}
                                                    onChange={(e) => {
                                                        const next = hand.slice();
                                                        next[idx] = e.target.value;
                                                        setHand(next);
                                                    }}
                                                    className="mb-2 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm outline-none"
                                                    placeholder={`Hand camera #${idx + 1} serial`}
                                                />
                                                <textarea
                                                    placeholder="Hand Camera Public Key (PEM)"
                                                    value={handPub[idx] ?? ''}
                                                    onChange={(e) => {
                                                        const next = handPub.slice();
                                                        next[idx] = e.target.value;
                                                        setHandPub(next);
                                                    }}
                                                    className="w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-xs outline-none min-h-[80px]"
                                                    rows={3}
                                                />
                                            </div>
                                        </div>
                                        <span className="ml-3 cursor-move select-none text-xs text-zinc-400">Drag</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                )}

                    {activeTab === 'bots' && (
                        <div className="space-y-4">
                            <div className="text-sm text-zinc-400">
                                {!tableQuery.data?.isJoinable && (
                                    <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
                                        ⚠️ Bots can only be added/removed when the table is joinable (no active game).
                                    </div>
                                )}
                                Manage AI bots for testing and practice. Bots will automatically check/call during betting rounds.
                            </div>

                            <div className="grid gap-3">
                                {seatSlots.map(({ seatNumber, seat, isBot, isEmpty }) => (
                                    <div
                                        key={seatNumber}
                                        className={`flex items-center justify-between p-4 rounded-lg border ${isBot
                                            ? 'bg-blue-500/10 border-blue-500/30'
                                            : isEmpty
                                                ? 'bg-zinc-800/50 border-zinc-700/50'
                                                : 'bg-green-500/10 border-green-500/30'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg font-bold ${isBot ? 'bg-blue-500/20 text-blue-400' : isEmpty ? 'bg-zinc-700/50 text-zinc-400' : 'bg-green-500/20 text-green-400'
                                                }`}>
                                                {seatNumber + 1}
                                            </div>
                                            <div>
                                                <div className="font-medium">
                                                    {isBot ? `Bot ${seatNumber + 1}` : seat ? (seat.player?.name ?? 'Player') : 'Empty Seat'}
                                                </div>
                                                <div className="text-xs text-zinc-400">
                                                    {isBot ? 'AI Player' : seat ? `${seat.buyIn} chips` : 'Available'}
                                                </div>
                                            </div>
                                        </div>

                                        {isEmpty && tableQuery.data?.isJoinable && (
                                            <button
                                                onClick={() => addBotMut.mutate({ tableId, seatNumber })}
                                                disabled={addBotMut.isPending || removeBotMut.isPending}
                                                className="flex items-center gap-2 rounded-md bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 px-4 py-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Bot className="w-4 h-4" />
                                                Add Bot
                                            </button>
                                        )}

                                        {isBot && tableQuery.data?.isJoinable && (
                                            <button
                                                onClick={() => removeBotMut.mutate({ tableId, seatNumber })}
                                                disabled={addBotMut.isPending || removeBotMut.isPending}
                                                className="flex items-center gap-2 rounded-md bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <X className="w-4 h-4" />
                                                Remove
                                            </button>
                                        )}

                                        {!isEmpty && !isBot && (
                                            <div className="text-xs text-zinc-500 px-4 py-2">
                                                Real player
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-white/10 bg-zinc-900/95 px-4 py-3 backdrop-blur">
                    <button onClick={onClose} className="rounded-md border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10">Cancel</button>
                    {activeTab === 'hardware' && (
                        <button
                            onClick={() => saveMut.mutate({ tableId, dealerSerial, dealerPublicKey, scannerSerial, scannerPublicKey, handSerials: hand, handPublicKeys: handPub })}
                            className="rounded-md bg-white px-3 py-2 text-sm font-medium text-black hover:bg-zinc-200"
                        >
                            Save
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

