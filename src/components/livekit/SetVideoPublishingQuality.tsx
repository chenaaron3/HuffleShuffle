import { ParticipantEvent, Track } from 'livekit-client';
import { useEffect } from 'react';

import { useRoomContext } from '@livekit/components-react';

import type { LocalTrackPublication, LocalVideoTrack, VideoQuality } from 'livekit-client';

type SetVideoPublishingQualityProps = {
    quality: VideoQuality;
    skipForDealer?: boolean;
};

/**
 * Sets the publishing quality for the local participant's camera stream.
 * This controls the quality at which the user's video is published to other participants.
 */
export function SetVideoPublishingQuality({ quality, skipForDealer = false }: SetVideoPublishingQualityProps) {
    const room = useRoomContext();

    useEffect(() => {
        if (!room || skipForDealer) {
            return;
        }

        const setQualityOnPublication = (publication: LocalTrackPublication) => {
            if (publication.source !== Track.Source.Camera) return;

            const track = publication.track as LocalVideoTrack | null;
            if (!track) return;

            try {
                track.setPublishingQuality(quality);
            } catch (err) {
                console.error('[LiveKit] Failed to set video publishing quality:', err);
            }
        };

        // Set quality on any already published camera tracks
        room.localParticipant.videoTrackPublications.forEach((publication) => {
            setQualityOnPublication(publication);
        });

        const handleLocalTrackPublished = (publication: LocalTrackPublication) => {
            setQualityOnPublication(publication);
        };

        room.localParticipant.on(ParticipantEvent.LocalTrackPublished, handleLocalTrackPublished);

        return () => {
            room.localParticipant.off(ParticipantEvent.LocalTrackPublished, handleLocalTrackPublished);
        };
    }, [room, quality, skipForDealer]);

    return null;
}

