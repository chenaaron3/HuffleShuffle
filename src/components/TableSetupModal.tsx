import * as React from 'react';
import { api } from '~/utils/api';

export function TableSetupModal({ tableId, open, onClose }: { tableId: string; open: boolean; onClose: () => void }) {
    const [dealerSerial, setDealerSerial] = React.useState('');
    const [scannerSerial, setScannerSerial] = React.useState('');
    const [hand, setHand] = React.useState<string[]>(Array(8).fill(''));
    const [dragIndex, setDragIndex] = React.useState<number | null>(null);

    const query = api.setup.get.useQuery({ tableId }, { enabled: open && !!tableId });
    const saveMut = api.setup.save.useMutation({ onSuccess: () => onClose() });

    React.useEffect(() => {
        if (query.data) {
            setDealerSerial(query.data.dealerSerial ?? '');
            setScannerSerial(query.data.scannerSerial ?? '');
            setHand((query.data.handSerials ?? Array(8).fill('')).slice(0, 8));
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-2xl rounded-lg bg-zinc-900 p-4 text-white shadow-lg">
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Table Setup</h3>
                    <button onClick={onClose} className="text-sm text-zinc-300 hover:text-white">Close</button>
                </div>
                <div className="grid gap-4">
                    <label className="block text-sm">
                        <span className="mb-1 block text-zinc-300">Dealer Camera</span>
                        <input value={dealerSerial} onChange={(e) => setDealerSerial(e.target.value)} className="w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 outline-none" />
                    </label>
                    <label className="block text-sm">
                        <span className="mb-1 block text-zinc-300">Scanner</span>
                        <input value={scannerSerial} onChange={(e) => setScannerSerial(e.target.value)} className="w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 outline-none" />
                    </label>
                    <div>
                        <div className="mb-2 text-sm text-zinc-300">Hand Cameras (drag to reorder)</div>
                        <div className="grid grid-cols-1 gap-2">
                            {hand.map((s, idx) => (
                                <div
                                    key={idx}
                                    draggable
                                    onDragStart={() => onDragStart(idx)}
                                    onDragOver={onDragOver}
                                    onDrop={() => onDrop(idx)}
                                    className="flex items-center justify-between rounded-md border border-white/10 bg-black/40 px-3 py-2"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-white/10 text-xs">{idx + 1}</span>
                                        <input
                                            value={s}
                                            onChange={(e) => {
                                                const next = hand.slice();
                                                next[idx] = e.target.value;
                                                setHand(next);
                                            }}
                                            className="rounded-md border border-white/10 bg-black/50 px-3 py-1 text-sm outline-none"
                                        />
                                    </div>
                                    <span className="cursor-move text-xs text-zinc-400">Drag</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="mt-2 flex justify-end gap-2">
                        <button onClick={onClose} className="rounded-md border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10">Cancel</button>
                        <button
                            onClick={() => saveMut.mutate({ tableId, dealerSerial, scannerSerial, handSerials: hand })}
                            className="rounded-md bg-white px-3 py-2 text-sm font-medium text-black hover:bg-zinc-200"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

