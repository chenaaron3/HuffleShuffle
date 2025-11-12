import { Clock, Settings, Users } from 'lucide-react';
import * as React from 'react';
import { TableSetupBlindsTab } from '~/components/table-setup/TableSetupBlindsTab';
import { TableSetupHardwareTab } from '~/components/table-setup/TableSetupHardwareTab';
import { TableSetupParticipantsTab } from '~/components/table-setup/TableSetupParticipantsTab';

import type {
    TableSetupHardwareTabHandle,
} from '~/components/table-setup/TableSetupHardwareTab';
type Tab = 'hardware' | 'participants' | 'blinds';

export function TableSetupModal({
    tableId,
    open,
    onClose,
}: {
    tableId: string;
    open: boolean;
    onClose: () => void;
}) {
    const [activeTab, setActiveTab] = React.useState<Tab>('participants');
    const hardwareRef = React.useRef<TableSetupHardwareTabHandle | null>(null);

    React.useEffect(() => {
        if (!open) return;
        setActiveTab('participants');
    }, [open]);

    if (!open) return null;

    const handleSaveHardware = () => {
        hardwareRef.current?.save();
    };

    const hardwareCanSave = hardwareRef.current?.canSave ?? false;
    const hardwareSaving = hardwareRef.current?.isSaving ?? false;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="flex w-full max-w-3xl max-h-[90vh] flex-col overflow-hidden rounded-lg bg-zinc-900 text-white shadow-lg">
                <div className="sticky top-0 z-10 border-b border-white/10 bg-zinc-900/95 backdrop-blur">
                    <div className="flex items-center justify-between px-4 py-3">
                        <h3 className="text-lg font-semibold">Table Setup</h3>
                        <button onClick={onClose} className="text-sm text-zinc-300 hover:text-white">
                            Close
                        </button>
                    </div>
                    <div className="flex gap-1 px-4 pb-2">
                        <button
                            onClick={() => setActiveTab('hardware')}
                            className={`flex items-center gap-2 rounded-t-lg px-4 py-2 transition-colors ${activeTab === 'hardware'
                                ? 'bg-zinc-800 text-white border-b-2 border-blue-500'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                                }`}
                        >
                            <Settings className="h-4 w-4" />
                            <span className="text-sm font-medium">Hardware</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('participants')}
                            className={`flex items-center gap-2 rounded-t-lg px-4 py-2 transition-colors ${activeTab === 'participants'
                                ? 'bg-zinc-800 text-white border-b-2 border-blue-500'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                                }`}
                        >
                            <Users className="h-4 w-4" />
                            <span className="text-sm font-medium">Participants</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('blinds')}
                            className={`flex items-center gap-2 rounded-t-lg px-4 py-2 transition-colors ${activeTab === 'blinds'
                                ? 'bg-zinc-800 text-white border-b-2 border-blue-500'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                                }`}
                        >
                            <Clock className="h-4 w-4" />
                            <span className="text-sm font-medium">Blinds</span>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <TableSetupHardwareTab
                        ref={hardwareRef}
                        tableId={tableId}
                        isOpen={open}
                        isActive={activeTab === 'hardware'}
                        onClose={onClose}
                    />
                    <TableSetupParticipantsTab
                        tableId={tableId}
                        isOpen={open}
                        isActive={activeTab === 'participants'}
                    />
                    <TableSetupBlindsTab tableId={tableId} isOpen={open} isActive={activeTab === 'blinds'} />
                </div>

                <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-white/10 bg-zinc-900/95 px-4 py-3 backdrop-blur">
                    <button
                        onClick={onClose}
                        className="rounded-md border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
                    >
                        Cancel
                    </button>
                    {activeTab === 'hardware' && (
                        <button
                            onClick={handleSaveHardware}
                            disabled={!hardwareCanSave || hardwareSaving}
                            className="rounded-md bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {hardwareSaving ? 'Saving…' : 'Save'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
