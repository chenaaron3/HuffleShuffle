import { AnimatePresence, motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { DealerFeed } from '~/components/table/camera/dealer-feed';
import { useTurnNotificationSound } from '~/hooks/use-turn-notification-sound';
import {
    useCanVolunteerShow,
    useCurrentSeat,
    useGameState,
    useIsDealerRole,
    useIsPlayerTurn,
} from '~/hooks/use-table-selectors';

import { QuickActions } from '~/components/table/betting/quick-actions';
import { ShowHandControl } from '~/components/table/betting/show-hand-control';
import { VerticalRaiseControls } from '~/components/table/betting/vertical-raise-controls';

import { MobileSeatOverlay } from './seat-overlay';

import type { QuickActionType } from '~/components/table/betting/quick-actions';

interface MobileTableViewProps {
    quickAction: QuickActionType;
    onQuickActionChange: (action: QuickActionType) => void;
    handRoomName: string | null;
}

export function MobileTableView({
    quickAction,
    onQuickActionChange,
    handRoomName,
}: MobileTableViewProps) {
    const { data: session } = useSession();
    const userId = session?.user?.id;
    const gameStatus = useGameState();
    const isDealer = useIsDealerRole();
    const isPlayerTurn = useIsPlayerTurn(userId);
    const currentSeat = useCurrentSeat(userId);
    const canVolunteerShow = useCanVolunteerShow(userId);

    useTurnNotificationSound();

    return (
        <div className="relative h-full w-full">
            <DealerFeed compactDealerActions>
                <AnimatePresence mode="wait">
                    {!isDealer && currentSeat && (
                        <motion.div
                            key="quick-actions"
                            className="absolute right-2 bottom-2 z-30"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                        >
                            <QuickActions
                                compact
                                value={quickAction}
                                onChange={onQuickActionChange}
                                disabled={false}
                                gameState={gameStatus}
                                isMyTurn={isPlayerTurn}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                    {isPlayerTurn && (
                        <motion.div
                            key="controls"
                            layoutId="mobile-raise-controls"
                            className="absolute right-2 bottom-2"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                        >
                            <VerticalRaiseControls compact />
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                    {gameStatus === 'SHOWDOWN' && canVolunteerShow && (
                        <motion.div
                            key="show-hand"
                            layoutId="mobile-show-hand-controls"
                            className="absolute right-2 bottom-2"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                        >
                            <ShowHandControl compact />
                        </motion.div>
                    )}
                </AnimatePresence>
            </DealerFeed>
            <MobileSeatOverlay handRoomName={handRoomName} />
        </div>
    );
}
