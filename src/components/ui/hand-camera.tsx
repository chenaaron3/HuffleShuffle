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
            <div
                className="flex items-center justify-center shadow-2xl"
                style={{
                    width: 256,
                    height: 160,
                    borderRadius: 14,
                    border: '1px solid rgba(63,63,70,0.5)',
                    backgroundColor: 'rgba(24,24,27,0.5)',
                    backdropFilter: 'blur(8px)'
                }}
            >
                <div className="text-sm text-zinc-500 font-medium">No hand camera</div>
            </div>
        );
    }

    return (
        <div
            className="rounded-xl overflow-hidden shadow-2xl"
            style={{
                width: 256,
                height: "fit-content",
                border: '1px solid rgba(113,113,122,0.5)',
                backgroundColor: 'rgba(24,24,27,0.5)',
                backdropFilter: 'blur(8px)'
            }}
        >
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
            <div
                className="flex items-center justify-center text-xs"
                style={{ width: '100%', height: 160, color: 'rgb(161,161,170)' }}
            >
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
