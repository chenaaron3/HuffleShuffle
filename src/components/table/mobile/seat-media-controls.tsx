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
}

export function MobileSeatMediaControls({
    seat,
    tableId,
    myUserId,
    dealerCanControlAudio,
}: MobileSeatMediaControlsProps) {
    const playerId = seat.player?.id ?? null;
    const isSelf = !!myUserId && playerId === myUserId;

    return (
        <div className="flex items-center gap-1">
            {isSelf ? (
                <>
                    <BackgroundBlurToggle className="h-8 bg-black/50 px-1.5" />
                    <TrackToggle
                        source={Track.Source.Microphone}
                        showIcon
                        className="flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-xs font-medium text-black hover:bg-white"
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
