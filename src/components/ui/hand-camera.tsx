import { Track } from 'livekit-client';

import { ParticipantTile, useTracks, VideoTrack } from '@livekit/components-react';

interface HandCameraProps {
    tableId: string;
    roomName: string | null;
}

export function HandCamera({ tableId, roomName }: HandCameraProps) {
    if (!roomName) {
        return (
            <div className="w-48 h-32 rounded-lg border border-white/10 bg-black flex items-center justify-center">
                <div className="text-xs text-zinc-400">No hand camera</div>
            </div>
        );
    }

    return (
        <div className="w-48 h-32 rounded-lg border border-white/10 bg-black overflow-hidden">
            <HandCameraContent />
        </div>
    );
}

function HandCameraContent() {
    const tracks = useTracks([Track.Source.Camera]);
    const cameraTrack = tracks[0];

    if (!cameraTrack) {
        return (
            <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">
                Waiting to see your hand...
            </div>
        );
    }

    return (
        <div className="w-full h-full">
            <ParticipantTile trackRef={cameraTrack}>
                <VideoTrack trackRef={cameraTrack} />
            </ParticipantTile>
        </div>
    );
}
