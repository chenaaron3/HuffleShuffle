import { useState } from 'react';

type GameAction = "RESET_TABLE" | "START_GAME" | "DEAL_CARD" | "RAISE" | "FOLD" | "CHECK";

interface ActionButtonsProps {
    isDealer: boolean;
    state?: string;
    currentUserSeatId?: string | null;
    bettingActorSeatId?: string | null;
    onAction: (action: GameAction, params?: any) => void;
    onDealCard?: (rank: string, suit: string) => void;
    onRandomCard?: () => void;
}

export function ActionButtons({
    isDealer,
    state,
    currentUserSeatId,
    bettingActorSeatId,
    onAction,
    onDealCard,
    onRandomCard
}: ActionButtonsProps) {
    const [dealRank, setDealRank] = useState<string>('A');
    const [dealSuit, setDealSuit] = useState<string>('s');

    const isPlayerTurn = state === 'BETTING' && currentUserSeatId === bettingActorSeatId;
    const isDealing = ['DEAL_HOLE_CARDS', 'DEAL_FLOP', 'DEAL_TURN', 'DEAL_RIVER'].includes(state || '');

    if (isDealer) {
        return (
            <div className="flex flex-wrap items-center justify-center gap-3">
                {/* Deal Card Controls */}
                {isDealing && (
                    <>
                        <select
                            aria-label="Rank"
                            value={dealRank}
                            onChange={(e) => setDealRank(e.target.value)}
                            className="rounded-md bg-white px-3 py-2 text-sm font-medium text-black hover:bg-zinc-200"
                        >
                            {['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'].map((r) => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                        <select
                            aria-label="Suit"
                            value={dealSuit}
                            onChange={(e) => setDealSuit(e.target.value)}
                            className="rounded-md bg-white px-3 py-2 text-sm font-medium text-black hover:bg-zinc-200"
                        >
                            {[
                                { value: 's', label: '♠' },
                                { value: 'h', label: '♥' },
                                { value: 'd', label: '♦' },
                                { value: 'c', label: '♣' },
                            ].map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                    </>
                )}

                {/* Game Control Buttons */}
                <ActionButton
                    onClick={() => onAction('START_GAME')}
                    className="bg-green-600 hover:bg-green-700"
                >
                    Start Game
                </ActionButton>

                {onDealCard && (
                    <ActionButton
                        onClick={() => onDealCard(dealRank, dealSuit)}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        Deal Card
                    </ActionButton>
                )}

                {onRandomCard && (
                    <ActionButton
                        onClick={onRandomCard}
                        className="bg-purple-600 hover:bg-purple-700"
                    >
                        Random
                    </ActionButton>
                )}
            </div>
        );
    }

    // Player Action Buttons
    return (
        <div className="flex items-center justify-center gap-4">
            <ActionButton
                disabled={!isPlayerTurn}
                onClick={() => onAction('CHECK')}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Check
            </ActionButton>

            <ActionButton
                disabled={!isPlayerTurn}
                onClick={() => onAction('RAISE', { amount: 20 })}
                className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Raise +20
            </ActionButton>

            <ActionButton
                disabled={!isPlayerTurn}
                onClick={() => onAction('FOLD')}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Fold
            </ActionButton>
        </div>
    );
}

function ActionButton({
    onClick,
    children,
    disabled,
    className = ""
}: {
    onClick: () => void;
    children: React.ReactNode;
    disabled?: boolean;
    className?: string;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white transition-colors ${className}`}
        >
            {children}
        </button>
    );
}
