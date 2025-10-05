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
                className="flex items-center justify-center shadow-2xl w-64 h-40 rounded-xl border border-zinc-600/50 bg-zinc-900/50 backdrop-blur"
            >
                {/* This means the player doesn't have the local RSA key. They need to rejoin from the same device */}
                <div className="text-sm text-zinc-500 font-medium text-center">Unable to see your hand</div>
            </div>
        );
    }

    return (
        <div
            className="rounded-xl overflow-hidden shadow-2xl w-64 h-auto border border-zinc-500/50 bg-zinc-900/50 backdrop-blur"
        >
            <HandCameraView tableId={tableId} roomName={roomName} />
        </div>
    );
}

function HandCameraView({ tableId, roomName }: { tableId: string; roomName: string }) {
    // Get token for the hand camera room using roomName override
    const tokenQuery = api.table.livekitToken.useQuery({ tableId, roomName }, { enabled: !!tableId && !!roomName });
    if (!tokenQuery.data) return <NullState />;;

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
        return <NullState />;
    }

    return (
        <div className="w-full h-full">
            <ParticipantTile trackRef={cameraTrack}>
                <VideoTrack trackRef={cameraTrack} />
            </ParticipantTile>
        </div>
    );
}

function NullState() {
    return (
        <div className="flex items-center justify-center text-sm font-medium w-full h-40 text-zinc-400">
            Loading Your Hand...
        </div>
    );
}