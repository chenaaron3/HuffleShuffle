import { Bot, X } from 'lucide-react';
import * as React from 'react';
import { api } from '~/utils/api';

const BOT_USER_IDS = [
    'bot00000-0000-0000-0000-000000000000',
    'bot00000-0000-0000-0000-000000000001',
    'bot00000-0000-0000-0000-000000000002',
    'bot00000-0000-0000-0000-000000000003',
    'bot00000-0000-0000-0000-000000000004',
    'bot00000-0000-0000-0000-000000000005',
    'bot00000-0000-0000-0000-000000000006',
    'bot00000-0000-0000-0000-000000000007',
];

interface TableSetupParticipantsTabProps {
    tableId: string;
    isOpen: boolean;
    isActive: boolean;
}

export function TableSetupParticipantsTab({ tableId, isOpen, isActive }: TableSetupParticipantsTabProps) {
    const tableQuery = api.table.get.useQuery({ tableId }, { enabled: isOpen });

    const addBotMut = api.table.addBot.useMutation({
        onSuccess: () => {
            void tableQuery.refetch();
        },
    });
    const removeBotMut = api.table.removeBot.useMutation({
        onSuccess: () => {
            void tableQuery.refetch();
        },
    });
    const removePlayerMut = api.table.removePlayer.useMutation({
        onSuccess: () => {
            void tableQuery.refetch();
        },
    });

    const seatSlots = React.useMemo(() => {
        const seats = tableQuery.data?.seats ?? [];
        return Array.from({ length: 8 }, (_, index) => {
            const seat = seats.find((s) => s.seatNumber === index) ?? null;
            const playerId = seat?.playerId ?? null;
            return {
                seatNumber: index,
                seat: seat
                    ? {
                        playerId,
                        player: seat.player ?? null,
                        buyIn: seat.buyIn ?? 0,
                    }
                    : null,
                isBot: seat ? BOT_USER_IDS.includes(playerId ?? '') : false,
                isEmpty: !seat,
            };
        });
    }, [tableQuery.data?.seats]);

    const isJoinable = tableQuery.data?.isJoinable ?? false;
    const participantMutationsBusy =
        addBotMut.isPending || removeBotMut.isPending || removePlayerMut.isPending;

    const handleAddBot = React.useCallback(
        (seatNumber: number) => {
            addBotMut.mutate({ tableId, seatNumber });
        },
        [addBotMut, tableId],
    );

    const handleRemoveBot = React.useCallback(
        (seatNumber: number) => {
            removeBotMut.mutate({ tableId, seatNumber });
        },
        [removeBotMut, tableId],
    );

    const handleRemovePlayer = React.useCallback(
        (playerId: string) => {
            removePlayerMut.mutate({ tableId, playerId });
        },
        [removePlayerMut, tableId],
    );

    if (!isActive) {
        return null;
    }

    return (
        <div className="space-y-4">
            <div className="text-sm text-zinc-400">
                {!isJoinable && (
                    <div className="mb-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-yellow-400">
                        ⚠️ Participants can only be added/removed when the table is joinable (no active game).
                    </div>
                )}
                Manage table participants including real players and AI bots. You can kick players or add/remove bots when no game is active.
            </div>

            <div className="grid gap-3">
                {seatSlots.map(({ seatNumber, seat, isBot, isEmpty }) => (
                    <div
                        key={seatNumber}
                        className={`flex items-center justify-between rounded-lg border p-4 ${isBot
                            ? 'bg-blue-500/10 border-blue-500/30'
                            : isEmpty
                                ? 'bg-zinc-800/50 border-zinc-700/50'
                                : 'bg-green-500/10 border-green-500/30'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className={`flex h-10 w-10 items-center justify-center rounded-lg font-bold ${isBot ? 'bg-blue-500/20 text-blue-400' : isEmpty ? 'bg-zinc-700/50 text-zinc-400' : 'bg-green-500/20 text-green-400'
                                    }`}
                            >
                                {seatNumber + 1}
                            </div>
                            <div>
                                <div className="font-medium">
                                    {isBot ? `Bot ${seatNumber + 1}` : seat ? seat.player?.name ?? 'Player' : 'Empty Seat'}
                                </div>
                                <div className="text-xs text-zinc-400">
                                    {isBot ? 'AI Player' : seat ? `${seat.buyIn} chips` : 'Available'}
                                </div>
                            </div>
                        </div>

                        {isEmpty && isJoinable && (
                            <button
                                onClick={() => handleAddBot(seatNumber)}
                                disabled={participantMutationsBusy}
                                className="flex items-center gap-2 rounded-md border border-blue-500/50 bg-blue-500/20 px-4 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/30 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Bot className="h-4 w-4" />
                                Add Bot
                            </button>
                        )}

                        {isBot && isJoinable && (
                            <button
                                onClick={() => handleRemoveBot(seatNumber)}
                                disabled={participantMutationsBusy}
                                className="flex items-center gap-2 rounded-md border border-red-500/50 bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <X className="h-4 w-4" />
                                Remove
                            </button>
                        )}

                        {!isEmpty && !isBot && isJoinable && (
                            <button
                                onClick={() => {
                                    if (seat?.playerId) handleRemovePlayer(seat.playerId);
                                }}
                                disabled={removePlayerMut.isPending}
                                className="flex items-center gap-2 rounded-md border border-red-500/50 bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <X className="h-4 w-4" />
                                Kick
                            </button>
                        )}

                        {!isEmpty && !isBot && !isJoinable && (
                            <div className="px-4 py-2 text-xs text-zinc-500">Real player</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
