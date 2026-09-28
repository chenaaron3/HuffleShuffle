import { AnimatePresence, motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import {
    useCanVolunteerShow,
    useGameState,
    useIsPlayerTurn,
} from '~/hooks/use-table-selectors';

import { ShowHandControl } from '~/components/table/betting/show-hand-control';
import { VerticalRaiseControls } from '~/components/table/betting/vertical-raise-controls';
import { DealerFeed } from '~/components/table/camera/dealer-feed';
import { TurnIndicator } from '~/components/table/feed/turn-indicator';
import { LeaveTableButton } from '~/components/table/leave-table-button';

export function DealerCamera() {
    const { data: session } = useSession();
    const userId = session?.user?.id;
    const gameStatus = useGameState();
    const isPlayerTurn = useIsPlayerTurn(userId);
    const canVolunteerShow = useCanVolunteerShow(userId);

    return (
        <DealerFeed>
            <div className="absolute bottom-4 left-4 z-50 flex flex-col items-start gap-2">
                <TurnIndicator />
                <LeaveTableButton />
            </div>

            <AnimatePresence mode="wait">
                {isPlayerTurn && (
                    <motion.div
                        key="controls"
                        layoutId="raise-controls"
                        className="absolute right-4 bottom-3"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                    >
                        <VerticalRaiseControls />
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
                {gameStatus === 'SHOWDOWN' && canVolunteerShow && (
                    <motion.div
                        key="show-hand"
                        layoutId="show-hand-controls"
                        className="absolute right-4 bottom-3"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                    >
                        <ShowHandControl />
                    </motion.div>
                )}
            </AnimatePresence>
        </DealerFeed>
    );
}
