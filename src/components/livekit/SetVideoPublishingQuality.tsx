import { ParticipantEvent, Track, VideoQuality } from 'livekit-client';
import { useEffect } from 'react';

import { useRoomContext } from '@livekit/components-react';

import type { LocalTrackPublication, LocalVideoTrack } from 'livekit-client';

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
        console.log(room);
        if (!room) {
            return;
        }

        const logPublishingStats = async (track: LocalVideoTrack, publication: LocalTrackPublication) => {
            try {
                // Log track info
                const settings = track.mediaStreamTrack.getSettings();
                const constraints = track.mediaStreamTrack.getConstraints();
                console.log('[LiveKit] Publishing Stats - Track Info:', {
                    trackSid: publication.trackSid,
                    source: publication.source,
                    isMuted: publication.isMuted,
                    dimensions: {
                        width: settings.width,
                        height: settings.height,
                    },
                    frameRate: settings.frameRate,
                    constraints: {
                        width: constraints.width,
                        height: constraints.height,
                        frameRate: constraints.frameRate,
                    },
                });

                // Log encoding parameters if available
                if (track.sender) {
                    const params = track.sender.getParameters();
                    console.log('[LiveKit] Publishing Stats - Encoding Parameters:', {
                        encodings: params.encodings?.map((e) => ({
                            rid: e.rid,
                            maxBitrate: e.maxBitrate,
                            maxFramerate: e.maxFramerate,
                            scaleResolutionDownBy: e.scaleResolutionDownBy,
                            active: e.active,
                        })),
                        codecs: params.codecs,
                    });
                }

                // Log sender stats
                try {
                    const stats = await track.getSenderStats();
                    console.log('[LiveKit] Publishing Stats - Sender Stats:', stats.map((s) => ({
                        rid: s.rid,
                        frameWidth: s.frameWidth,
                        frameHeight: s.frameHeight,
                        framesPerSecond: s.framesPerSecond,
                        framesSent: s.framesSent,
                        targetBitrate: s.targetBitrate,
                        bytesSent: s.bytesSent,
                        packetsSent: s.packetsSent,
                        qualityLimitationReason: s.qualityLimitationReason,
                        qualityLimitationDurations: s.qualityLimitationDurations,
                        jitter: s.jitter,
                        packetsLost: s.packetsLost,
                        roundTripTime: s.roundTripTime,
                    })));
                } catch (err) {
                    console.error('[LiveKit] Failed to get sender stats:', err);
                }
            } catch (err) {
                console.error('[LiveKit] Failed to log publishing stats:', err);
            }
        };

        const tracksToMonitor = new Map<string, { track: LocalVideoTrack; publication: LocalTrackPublication }>();

        const setQualityOnPublication = async (publication: LocalTrackPublication) => {
            if (publication.source !== Track.Source.Camera) return;

            const track = publication.track as LocalVideoTrack | null;
            if (!track) return;

            try {
                // Only set quality limit if not skipping for dealer
                if (!skipForDealer) {
                    track.setPublishingQuality(quality);
                    console.log('[LiveKit] Set publishing quality to:', VideoQuality[quality]);
                } else {
                    console.log('[LiveKit] Skipping quality limit for dealer');
                }

                // Store track for periodic logging
                tracksToMonitor.set(publication.trackSid, { track, publication });

                // Log immediately
                await logPublishingStats(track, publication);
            } catch (err) {
                console.error('[LiveKit] Failed to set video publishing quality:', err);
            }
        };

        // Set quality on any already published camera tracks
        room.localParticipant.videoTrackPublications.forEach((publication) => {
            void setQualityOnPublication(publication as LocalTrackPublication);
        });

        const handleLocalTrackPublished = (publication: LocalTrackPublication) => {
            console.log('[LiveKit] Local track published:', {
                trackSid: publication.trackSid,
                source: publication.source,
                kind: publication.kind,
            });
            void setQualityOnPublication(publication);
        };

        const handleLocalTrackUnpublished = (publication: LocalTrackPublication) => {
            tracksToMonitor.delete(publication.trackSid);
        };

        room.localParticipant.on(ParticipantEvent.LocalTrackPublished, handleLocalTrackPublished);
        room.localParticipant.on(ParticipantEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);

        // Log stats every second for all active tracks
        const statsInterval = setInterval(() => {
            tracksToMonitor.forEach(({ track, publication }) => {
                void logPublishingStats(track, publication);
            });
        }, 1000);

        return () => {
            room.localParticipant.off(ParticipantEvent.LocalTrackPublished, handleLocalTrackPublished);
            room.localParticipant.off(ParticipantEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
            clearInterval(statsInterval);
            tracksToMonitor.clear();
        };
    }, [room, quality]);

    return null;
}

