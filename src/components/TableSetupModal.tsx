import * as React from 'react';
import { api } from '~/utils/api';

export function TableSetupModal({ tableId, open, onClose }: { tableId: string; open: boolean; onClose: () => void }) {
    const [dealerSerial, setDealerSerial] = React.useState('');
    const [dealerPublicKey, setDealerPublicKey] = React.useState('');
    const [scannerSerial, setScannerSerial] = React.useState('');
    const [scannerPublicKey, setScannerPublicKey] = React.useState('');
    const [hand, setHand] = React.useState<string[]>(Array(8).fill(''));
    const [handPub, setHandPub] = React.useState<string[]>(Array(8).fill(''));
    const [dragIndex, setDragIndex] = React.useState<number | null>(null);

    const query = api.setup.get.useQuery({ tableId }, { enabled: open && !!tableId });
    const saveMut = api.setup.save.useMutation({ onSuccess: () => onClose() });

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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-lg bg-zinc-900 text-white shadow-lg flex flex-col">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-zinc-900/95 px-4 py-3 backdrop-blur">
                    <h3 className="text-lg font-semibold">Table Setup</h3>
                    <button onClick={onClose} className="text-sm text-zinc-300 hover:text-white">Close</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
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
                </div>
                <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-white/10 bg-zinc-900/95 px-4 py-3 backdrop-blur">
                    <button onClick={onClose} className="rounded-md border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10">Cancel</button>
                    <button
                        onClick={() => saveMut.mutate({ tableId, dealerSerial, dealerPublicKey, scannerSerial, scannerPublicKey, handSerials: hand, handPublicKeys: handPub })}
                        className="rounded-md bg-white px-3 py-2 text-sm font-medium text-black hover:bg-zinc-200"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

