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

    const baseBigBlind = tableQuery.data?.table?.bigBlind ?? 10;
    const defaultBotBuyIn = baseBigBlind * 20;

    const [botBuyInInput, setBotBuyInInput] = React.useState('');
    React.useEffect(() => {
        if (!isOpen || !tableQuery.data?.table) return;
        setBotBuyInInput(String(tableQuery.data.table.bigBlind * 20));
    }, [isOpen, tableId, tableQuery.data?.table?.bigBlind]);

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

    const parsedBotBuyIn = Number.parseInt(botBuyInInput, 10);
    const resolvedBotBuyIn =
        Number.isFinite(parsedBotBuyIn) && parsedBotBuyIn > 0 ? parsedBotBuyIn : defaultBotBuyIn;
    const botBuyInInvalid =
        botBuyInInput.trim() !== '' &&
        (!Number.isFinite(parsedBotBuyIn) || parsedBotBuyIn <= 0);

    const handleAddBot = React.useCallback(
        (seatNumber: number) => {
            const buyIn = resolvedBotBuyIn;
            addBotMut.mutate({ tableId, seatNumber, buyIn });
        },
        [addBotMut, tableId, resolvedBotBuyIn],
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

            <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/40 p-4">
                <label
                    htmlFor="bot-buy-in"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-400"
                >
                    Bot buy-in (chips)
                </label>
                <input
                    id="bot-buy-in"
                    type="number"
                    min={1}
                    step={1}
                    value={botBuyInInput}
                    onChange={(e) => setBotBuyInInput(e.target.value)}
                    disabled={!isJoinable}
                    className="w-full max-w-xs rounded-md border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="mt-1.5 text-xs text-zinc-500">
                    Chips each bot gets when added. Default matches 20× big blind ({defaultBotBuyIn} with current blinds).
                </p>
                {botBuyInInvalid && (
                    <p className="mt-1 text-xs text-red-400">Enter a whole number greater than zero.</p>
                )}
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
                                disabled={participantMutationsBusy || botBuyInInvalid}
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
