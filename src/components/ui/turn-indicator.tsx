import { useEffect, useRef } from 'react';
import { useSoundEffects } from '~/components/providers/SoundProvider';

interface TurnIndicatorProps {
    gameStatus?: string;
    isJoinable?: boolean;
    isDealer: boolean;
    isPlayerTurn: boolean;
    isDealerTurn: boolean;
    activePlayerName?: string;
}

export function TurnIndicator({
    gameStatus,
    isJoinable,
    isDealer,
    isPlayerTurn,
    isDealerTurn,
    activePlayerName,
}: TurnIndicatorProps) {
    const { play } = useSoundEffects();
    const isViewerTurn = isDealer && isDealerTurn || !isDealer && isPlayerTurn;
    const previousViewerTurn = useRef(isViewerTurn);

    useEffect(() => {
        if (!gameStatus || isJoinable) {
            previousViewerTurn.current = isViewerTurn;
            return;
        }

        const wasViewerTurn = previousViewerTurn.current;
        if (!wasViewerTurn && isViewerTurn) {
            play('turnNotification');
        }

        previousViewerTurn.current = isViewerTurn;
    }, [gameStatus, isJoinable, isViewerTurn, play]);

    // Only show when a game is in progress and the table isn't joinable
    if (!gameStatus || isJoinable) {
        return null;
    }

    const containerColorClasses = isViewerTurn
        ? 'bg-green-600/90 border border-green-500/50'
        : 'bg-blue-600/90 border border-blue-500/50';
    const pulseDotColor = isViewerTurn ? 'bg-green-200' : 'bg-blue-200';

    return (
        <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 rounded-xl px-4 py-3 backdrop-blur-sm shadow-lg transition-all duration-300 ${isViewerTurn ? 'scale-105' : ''} ${containerColorClasses}`}>
            <div className="flex items-center gap-2">
                <span className={`${isViewerTurn ? 'h-3 w-3' : 'h-2 w-2'} animate-pulse rounded-full transition-all duration-300 ${pulseDotColor}`} />
                <span className="text-sm font-semibold text-white">
                    {isDealerTurn && 'Dealing cards...'}
                    {activePlayerName && `${isPlayerTurn ? 'Your' : activePlayerName + "'s"} turn`}
                </span>
            </div>
        </div>
    );
}


