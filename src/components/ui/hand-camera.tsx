import { Track } from 'livekit-client';
import { api } from '~/utils/api';

import {
    LiveKitRoom, ParticipantTile, RoomAudioRenderer, useTracks, VideoTrack
} from '@livekit/components-react';

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
            <HandCameraView tableId={tableId} roomName={roomName} />
        </div>
    );
}

function HandCameraView({ tableId, roomName }: { tableId: string; roomName: string }) {
    // Get token for the hand camera room using roomName override
    const tokenQuery = api.table.livekitToken.useQuery({ tableId, roomName }, { enabled: !!tableId && !!roomName });
    if (!tokenQuery.data) return null;

    return (
        <LiveKitRoom
            token={tokenQuery.data.token}
            serverUrl={tokenQuery.data.serverUrl}
            connectOptions={{ autoSubscribe: true }}
        >
            <RoomAudioRenderer />
            <HandCameraVideoContent />
        </LiveKitRoom>
    );
}

function HandCameraVideoContent() {
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
