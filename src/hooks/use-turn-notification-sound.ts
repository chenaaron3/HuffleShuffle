import { useSession } from 'next-auth/react';
import { useEffect, useRef } from 'react';
import { useSoundEffects } from '~/components/providers/SoundProvider';
import {
    useGameState, useIsDealerRole, useIsHandInProgress, useIsPlayerTurn
} from '~/hooks/use-table-selectors';

const DEALER_TURN_STATES = ['DEAL_HOLE_CARDS', 'DEAL_FLOP', 'DEAL_TURN', 'DEAL_RIVER'];

/**
 * Plays the turn notification when it becomes this viewer's turn.
 * Used by the desktop turn chip and the mobile overlay (which hides that chip).
 */
export function useTurnNotificationSound() {
    const { data: session } = useSession();
    const userId = session?.user?.id;
    const gameStatus = useGameState();
    const isHandInProgress = useIsHandInProgress();
    const isDealer = useIsDealerRole();
    const isPlayerTurn = useIsPlayerTurn(userId);
    const isDealerTurn = DEALER_TURN_STATES.includes(gameStatus ?? '');
    const { play } = useSoundEffects();
    const isViewerTurn = (isDealer && isDealerTurn) || (!isDealer && isPlayerTurn);
    const previousViewerTurn = useRef(isViewerTurn);

    useEffect(() => {
        if (!gameStatus || !isHandInProgress) {
            previousViewerTurn.current = isViewerTurn;
            return;
        }

        if (!previousViewerTurn.current && isViewerTurn) {
            play('turnNotification');
        }

        previousViewerTurn.current = isViewerTurn;
    }, [gameStatus, isHandInProgress, isViewerTurn, play]);
}
