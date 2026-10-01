import { Track } from 'livekit-client';
import { BackgroundBlurToggle } from '~/components/table/media/background-blur-toggle';
import { ParticipantMuteButton } from '~/components/table/media/participant-mute-button';

import { TrackToggle } from '@livekit/components-react';

import type { SeatWithPlayer } from '~/server/api/table/types';

interface MobileSeatMediaControlsProps {
    seat: SeatWithPlayer;
    tableId: string;
    myUserId: string | null | undefined;
    dealerCanControlAudio: boolean;
    layout?: 'column' | 'row';
}

export function MobileSeatMediaControls({
    seat,
    tableId,
    myUserId,
    dealerCanControlAudio,
    layout = 'column',
}: MobileSeatMediaControlsProps) {
    const playerId = seat.player?.id ?? null;
    const isSelf = !!myUserId && playerId === myUserId;

    return (
        <div className={layout === 'row' ? 'flex items-center gap-1.5' : 'flex flex-col items-center gap-0.5'}>
            {isSelf ? (
                <>
                    <BackgroundBlurToggle compact className="bg-black/50" />
                    <TrackToggle
                        source={Track.Source.Microphone}
                        showIcon
                        className="hs-square-media-btn flex h-6 w-6 items-center justify-center overflow-hidden rounded-md bg-white/90 text-xs font-medium text-black hover:bg-white"
                        aria-label="Toggle microphone"
                        title="Toggle microphone"
                    />
                </>
            ) : (
                <ParticipantMuteButton
                    tableId={tableId}
                    playerId={playerId}
                    canControlAudio={dealerCanControlAudio}
                    variant="standalone"
                />
            )}
        </div>
    );
}
