import { ParticipantEvent, Track } from 'livekit-client';
import { useEffect, useRef } from 'react';

import { useRoomContext } from '@livekit/components-react';
import { BackgroundBlur, supportsBackgroundProcessors } from '@livekit/track-processors';

import type { LocalTrackPublication, LocalVideoTrack, TrackPublication } from 'livekit-client';
type AutoBackgroundBlurProps = {
    blurRadius?: number;
    enabled?: boolean;
};

/**
 * Automatically applies the LiveKit background blur processor to the local participant's camera stream.
 * Blur is enabled as soon as the camera track is published and re-applied if the track restarts.
 */
export function AutoBackgroundBlur({ blurRadius = 50, enabled = true }: AutoBackgroundBlurProps) {
    const room = useRoomContext();
    const processorRef = useRef<ReturnType<typeof BackgroundBlur> | null>(null);
    const appliedPublications = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!enabled) {
            return;
        }
        if (typeof window === 'undefined') {
            return;
        }
        if (!room) {
            return;
        }
        if (!supportsBackgroundProcessors()) {
            console.warn('[LiveKit] Background processors are not supported in this browser.');
            return;
        }

        let isCancelled = false;

        const ensureProcessor = () => {
            if (!processorRef.current) {
                processorRef.current = BackgroundBlur(blurRadius);
            } else {
                void processorRef.current.updateTransformerOptions({ blurRadius });
            }
            return processorRef.current;
        };

        const applyBlurToPublication = async (publication: LocalTrackPublication) => {
            if (isCancelled) return;
            if (publication.source !== Track.Source.Camera) return;

            const track = publication.track as LocalVideoTrack | null;
            if (!track) return;

            const processor = ensureProcessor();
            if (!processor) return;

            try {
                // Avoid re-applying to the same publication when nothing changed.
                if (!appliedPublications.current.has(publication.trackSid)) {
                    await track.setProcessor(processor, true);
                    appliedPublications.current.add(publication.trackSid);
                } else {
                    // Track may have restarted; ensure processor stays attached and blur radius updates.
                    if (track.getProcessor() !== processor) {
                        await track.setProcessor(processor, true);
                    } else {
                        void processor.updateTransformerOptions({ blurRadius });
                    }
                }
            } catch (err) {
                console.error('[LiveKit] Failed to apply background blur processor:', err);
            }
        };

        // Apply blur to any already published camera tracks (covers initial join).
        room.localParticipant.videoTrackPublications.forEach((publication) => {
            void applyBlurToPublication(publication as LocalTrackPublication);
        });

        const handleLocalTrackPublished = (publication: LocalTrackPublication) => {
            void applyBlurToPublication(publication);
        };

        const handleTrackUnpublished = (publication: TrackPublication) => {
            if (publication.source !== Track.Source.Camera) return;
            appliedPublications.current.delete(publication.trackSid);
        };

        room.localParticipant.on(ParticipantEvent.LocalTrackPublished, handleLocalTrackPublished);
        room.localParticipant.on(ParticipantEvent.LocalTrackUnpublished, handleTrackUnpublished);

        return () => {
            isCancelled = true;
            room.localParticipant.off(ParticipantEvent.LocalTrackPublished, handleLocalTrackPublished);
            room.localParticipant.off(ParticipantEvent.LocalTrackUnpublished, handleTrackUnpublished);

            const processor = processorRef.current;
            if (processor) {
                room.localParticipant.videoTrackPublications.forEach((publication) => {
                    const track = publication.track as LocalVideoTrack | null;
                    if (!track) return;

                    if (track.getProcessor() === processor) {
                        void track.stopProcessor(true).catch((err) => {
                            console.warn('[LiveKit] Failed to stop background processor during cleanup:', err);
                        });
                    }
                });

                void processor.destroy().catch((err) => {
                    console.warn('[LiveKit] Failed to destroy background processor during cleanup:', err);
                });
            }

            processorRef.current = null;
            appliedPublications.current.clear();
        };
    }, [room, blurRadius, enabled]);

    return null;
}

