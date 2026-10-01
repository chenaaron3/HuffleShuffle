import { AnimatePresence, motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { QuickActions } from '~/components/table/betting/quick-actions';
import { ShowHandControl } from '~/components/table/betting/show-hand-control';
import { VerticalRaiseControls } from '~/components/table/betting/vertical-raise-controls';
import {
    useCanVolunteerShow,
    useCurrentSeat,
    useGameState,
    useIsDealerAtTable,
    useIsPlayerTurn,
} from '~/hooks/use-table-selectors';
import { cn } from '~/lib/utils';

import type { QuickActionType } from '~/components/table/betting/quick-actions';

interface MobileActionControlsProps {
    quickAction: QuickActionType;
    onQuickActionChange: (action: QuickActionType) => void;
    fill?: boolean;
}

export function MobileActionControls({
    quickAction,
    onQuickActionChange,
    fill = false,
}: MobileActionControlsProps) {
    const { data: session } = useSession();
    const userId = session?.user?.id;
    const gameStatus = useGameState();
    const isDealer = useIsDealerAtTable();
    const isPlayerTurn = useIsPlayerTurn(userId);
    const currentSeat = useCurrentSeat(userId);
    const canVolunteerShow = useCanVolunteerShow(userId);
    const fillClass = fill ? 'w-full' : undefined;
    const showRaise = isPlayerTurn;
    const showHand = !showRaise && gameStatus === 'SHOWDOWN' && canVolunteerShow;
    const showQuick = !showRaise && !showHand && !isDealer && !!currentSeat;

    return (
        <AnimatePresence mode="wait" initial={false}>
            {showRaise ? (
                <motion.div
                    key="raise"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className={cn(fill && 'w-full')}
                >
                    <VerticalRaiseControls compact className={fillClass} />
                </motion.div>
            ) : showHand ? (
                <motion.div
                    key="show-hand"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className={cn(fill && 'w-full')}
                >
                    <ShowHandControl compact className={fillClass} />
                </motion.div>
            ) : showQuick ? (
                <motion.div
                    key="quick-actions"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className={cn(fill && 'w-full')}
                >
                    <QuickActions
                        compact
                        className={fillClass}
                        value={quickAction}
                        onChange={onQuickActionChange}
                        disabled={false}
                        gameState={gameStatus}
                        isMyTurn={false}
                    />
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
}
