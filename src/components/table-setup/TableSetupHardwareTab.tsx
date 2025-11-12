import * as React from 'react';
import { api } from '~/utils/api';

interface TableSetupHardwareTabProps {
    tableId: string;
    isOpen: boolean;
    isActive: boolean;
    onClose: () => void;
}

export interface TableSetupHardwareTabHandle {
    save: () => void;
    isSaving: boolean;
    canSave: boolean;
}

export const TableSetupHardwareTab = React.forwardRef<TableSetupHardwareTabHandle, TableSetupHardwareTabProps>(
    function TableSetupHardwareTabComponent({ tableId, isOpen, isActive, onClose }, ref) {
        const enabled = isOpen && isActive;

        const query = api.setup.get.useQuery({ tableId }, { enabled });
        const saveMut = api.setup.save.useMutation({ onSuccess: () => onClose() });

        const [dealerSerial, setDealerSerial] = React.useState('');
        const [dealerPublicKey, setDealerPublicKey] = React.useState('');
        const [scannerSerial, setScannerSerial] = React.useState('');
        const [scannerPublicKey, setScannerPublicKey] = React.useState('');
        const [handSerials, setHandSerials] = React.useState<string[]>(Array(8).fill(''));
        const [handPublicKeys, setHandPublicKeys] = React.useState<string[]>(Array(8).fill(''));
        const [dragIndex, setDragIndex] = React.useState<number | null>(null);

        React.useEffect(() => {
            if (!query.data || !enabled) return;
            setDealerSerial(query.data.dealerSerial ?? '');
            setScannerSerial(query.data.scannerSerial ?? '');

            const serials = (query.data.handSerials ?? Array(8).fill('')).slice(0, 8);
            setHandSerials(serials);

            const bySerial: Record<string, string> = {};
            (query.data.available ?? []).forEach((device: any) => {
                bySerial[device.serial] = device.publicKey ?? '';
            });

            setDealerPublicKey(bySerial[query.data.dealerSerial ?? ''] ?? '');
            setScannerPublicKey(bySerial[query.data.scannerSerial ?? ''] ?? '');
            setHandPublicKeys(serials.map((serial) => bySerial[serial] ?? ''));
        }, [query.data, enabled]);

        const handleHandSerialChange = React.useCallback((index: number, value: string) => {
            setHandSerials((prev) => {
                const next = [...prev];
                next[index] = value;
                return next;
            });
        }, []);

        const handleHandPublicKeyChange = React.useCallback((index: number, value: string) => {
            setHandPublicKeys((prev) => {
                const next = [...prev];
                next[index] = value;
                return next;
            });
        }, []);

        const handleHandReorder = React.useCallback((fromIndex: number, toIndex: number) => {
            setHandSerials((prev) => {
                const next = [...prev];
                const [moved] = next.splice(fromIndex, 1);
                next.splice(toIndex, 0, moved ?? '');
                return next;
            });
            setHandPublicKeys((prev) => {
                const next = [...prev];
                const [moved] = next.splice(fromIndex, 1);
                next.splice(toIndex, 0, moved ?? '');
                return next;
            });
        }, []);

        const handleDragStart = React.useCallback((index: number) => {
            setDragIndex(index);
        }, []);

        const handleDragOver = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();
        }, []);

        const handleDrop = React.useCallback((index: number) => {
            if (dragIndex === null || dragIndex === index) return;
            handleHandReorder(dragIndex, index);
            setDragIndex(null);
        }, [dragIndex, handleHandReorder]);

        const save = React.useCallback(() => {
            if (!enabled || !query.data) return;
            saveMut.mutate({
                tableId,
                dealerSerial,
                dealerPublicKey,
                scannerSerial,
                scannerPublicKey,
                handSerials,
                handPublicKeys,
            });
        }, [
            dealerPublicKey,
            dealerSerial,
            enabled,
            handPublicKeys,
            handSerials,
            saveMut,
            scannerPublicKey,
            scannerSerial,
            tableId,
        ]);

        const canSave = enabled && !!query.data && !saveMut.isPending;

        React.useImperativeHandle(
            ref,
            () => ({
                save,
                isSaving: saveMut.isPending,
                canSave,
            }),
            [canSave, save, saveMut.isPending],
        );

        if (!isActive) {
            return null;
        }

        return (
            <div className="grid gap-5">
                <section className="grid gap-2">
                    <div>
                        <div className="mb-1 text-sm text-zinc-300">Dealer Camera</div>
                        <input
                            value={dealerSerial}
                            onChange={(event) => setDealerSerial(event.target.value)}
                            className="w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 outline-none"
                            placeholder="Dealer Pi serial"
                        />
                    </div>
                </section>

                <section className="grid gap-2">
                    <div>
                        <div className="mb-1 text-sm text-zinc-300">Scanner</div>
                        <input
                            value={scannerSerial}
                            onChange={(event) => setScannerSerial(event.target.value)}
                            className="w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 outline-none"
                            placeholder="Scanner Pi serial"
                        />
                        <textarea
                            placeholder="Scanner Public Key (PEM)"
                            value={scannerPublicKey ?? ''}
                            onChange={(event) => setScannerPublicKey(event.target.value)}
                            className="w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-xs outline-none min-h-[80px]"
                            rows={3}
                        />
                    </div>
                </section>

                <section>
                    <div className="mb-2 text-sm text-zinc-300">Hand Cameras (drag to reorder)</div>
                    <div className="grid grid-cols-1 gap-3">
                        {handSerials.map((serial, index) => (
                            <div
                                key={index}
                                draggable
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={handleDragOver}
                                onDrop={() => handleDrop(index)}
                                className="flex items-start justify-between rounded-md border border-white/10 bg-black/40 px-3 py-2"
                            >
                                <div className="flex flex-1 items-start gap-3">
                                    <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded bg-white/10 text-xs">
                                        {index + 1}
                                    </span>
                                    <div className="flex-1">
                                        <input
                                            value={serial}
                                            onChange={(event) => handleHandSerialChange(index, event.target.value)}
                                            className="mb-2 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm outline-none"
                                            placeholder={`Hand camera #${index + 1} serial`}
                                        />
                                        <textarea
                                            placeholder="Hand Camera Public Key (PEM)"
                                            value={handPublicKeys[index] ?? ''}
                                            onChange={(event) => handleHandPublicKeyChange(index, event.target.value)}
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
        );
    },
);
