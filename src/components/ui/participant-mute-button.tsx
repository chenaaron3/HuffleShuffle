import { RemoteParticipant, Track } from 'livekit-client';
import { Mic, MicOff } from 'lucide-react';
import * as React from 'react';
import { useInteractionStore } from '~/stores/interaction-store';
import { api } from '~/utils/api';

import { useTracks } from '@livekit/components-react';

interface ParticipantMuteButtonProps {
    tableId: string;
    playerId: string | null;
    /** Dealers mute server-side for everyone; other users mute locally for themselves only. */
    canControlAudio?: boolean;
}

/**
 * Hover overlay mute button for another player's seat tile.
 *
 * - Dealer: toggles a server-side mute on the player's published track.
 * - Player: toggles a local-only mute (RemoteParticipant volume), affecting
 *   nobody else and resetting on page refresh.
 *
 * Renders nothing when the player has no audio track.
 */
export function ParticipantMuteButton({ tableId, playerId, canControlAudio }: ParticipantMuteButtonProps) {
    const audioRefs = useTracks([Track.Source.Microphone]);
    const audioTrackRef = playerId ? audioRefs.find(
        (t) => t.participant.identity === playerId && t.source === Track.Source.Microphone
    ) : null;
    const audioPublication = audioTrackRef?.publication ?? null;
    const isAudioMuted = audioPublication ? audioPublication.isMuted : true;
    const remoteParticipant = audioTrackRef?.participant;

    const { mutate: mutateAudioMute, isPending: isMuting } = api.table.setParticipantAudioMuted.useMutation();

    // Local-only mute: silences this player for the local user without affecting anyone else
    const isLocallyMuted = useInteractionStore((s) => (playerId ? !!s.locallyMutedPlayerIds[playerId] : false));
    const toggleLocalMute = useInteractionStore((s) => s.toggleLocalMute);

    React.useEffect(() => {
        if (!(remoteParticipant instanceof RemoteParticipant)) return;
        remoteParticipant.setVolume(isLocallyMuted ? 0 : 1);
    }, [remoteParticipant, isLocallyMuted]);

    const handleDealerToggleMute = React.useCallback(() => {
        if (!playerId || !audioPublication) return;
        mutateAudioMute({
            tableId,
            playerId,
            muted: !isAudioMuted,
        });
    }, [audioPublication, isAudioMuted, mutateAudioMute, playerId, tableId]);

    const handleToggleLocalMute = React.useCallback(() => {
        if (!playerId) return;
        toggleLocalMute(playerId);
    }, [playerId, toggleLocalMute]);

    if (!playerId || !audioPublication) return null;

    // Muted icon shows when the player is muted at the source OR locally by this user
    const displayAudioMuted = isAudioMuted || isLocallyMuted;
    const buttonClasses = (canControlAudio ? isAudioMuted : displayAudioMuted)
        ? 'bg-red-500/90 text-white hover:bg-red-500 disabled:bg-red-500/60 disabled:text-white/70'
        : 'bg-white/90 text-black hover:bg-white disabled:bg-white/60 disabled:text-black/50';

    const label = canControlAudio
        ? (isAudioMuted ? 'Unmute player microphone' : 'Mute player microphone')
        : (isLocallyMuted ? 'Unmute player for me' : 'Mute player for me');

    return (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30">
            <button
                type="button"
                onClick={canControlAudio ? handleDealerToggleMute : handleToggleLocalMute}
                disabled={canControlAudio ? isMuting : false}
                className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-colors ${buttonClasses}`}
                aria-label={label}
                title={label}
            >
                {(canControlAudio ? isAudioMuted : displayAudioMuted) ? (
                    <MicOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                    <Mic className="h-4 w-4" aria-hidden="true" />
                )}
            </button>
        </div>
    );
}
