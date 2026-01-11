import { ParticipantEvent, Track, VideoQuality } from 'livekit-client';
import { useEffect } from 'react';

import { useRoomContext } from '@livekit/components-react';

import type { LocalTrackPublication, LocalVideoTrack } from 'livekit-client';

type SetVideoPublishingQualityProps = {
    quality: VideoQuality;
};

/**
 * Sets the publishing quality for the local participant's camera stream.
 * This controls the quality at which the user's video is published to other participants.
 */
export function SetVideoPublishingQuality({ quality }: SetVideoPublishingQualityProps) {
    const room = useRoomContext();

    useEffect(() => {
        console.log(room);
        if (!room) {
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
            void setQualityOnPublication(publication as LocalTrackPublication);
        });

        const handleLocalTrackPublished = (publication: LocalTrackPublication) => {
            console.log('local track published', publication);
            void setQualityOnPublication(publication);
        };

        room.localParticipant.on(ParticipantEvent.LocalTrackPublished, handleLocalTrackPublished);

        return () => {
            room.localParticipant.off(ParticipantEvent.LocalTrackPublished, handleLocalTrackPublished);
        };
    }, [room, quality]);

    return null;
}

