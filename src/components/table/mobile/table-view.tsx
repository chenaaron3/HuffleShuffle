import { DealerFeed } from '~/components/table/camera/dealer-feed';
import { useTurnNotificationSound } from '~/hooks/use-turn-notification-sound';

import { MobileActionControls } from './action-controls';
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
    useTurnNotificationSound();

    return (
        <div className="relative h-full w-full">
            <DealerFeed compact>
                <div
                    className="absolute z-30"
                    style={{
                        right: 'max(0.5rem, env(safe-area-inset-right))',
                        bottom: 'max(0.5rem, env(safe-area-inset-bottom))',
                    }}
                >
                    <MobileActionControls
                        quickAction={quickAction}
                        onQuickActionChange={onQuickActionChange}
                    />
                </div>
            </DealerFeed>
            <MobileSeatOverlay
                handRoomName={handRoomName}
                quickAction={quickAction}
                onQuickActionChange={onQuickActionChange}
            />
        </div>
    );
}
