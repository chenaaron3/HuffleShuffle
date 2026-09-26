import { Track } from 'livekit-client';
import { api } from '~/utils/api';

import {
    LiveKitRoom, ParticipantTile, RoomAudioRenderer, useTracks, VideoTrack
} from '@livekit/components-react';

interface HandCameraProps {
    tableId: string;
    roomName: string | null;
    compact?: boolean;
}

export function HandCamera({ tableId, roomName, compact = false }: HandCameraProps) {
    const frameClass = compact
        ? 'flex h-20 w-44 items-center justify-center overflow-hidden rounded-lg border border-zinc-500/50 bg-zinc-900/80 shadow-xl'
        : 'flex w-64 h-40 items-center justify-center shadow-2xl rounded-xl border border-zinc-600/50 bg-zinc-900/50 backdrop-blur';

    if (!roomName) {
        return (
            <div className={frameClass}>
                {/* This means the player doesn't have the local RSA key. They need to rejoin from the same device */}
                <div className={`font-medium text-center text-zinc-500 ${compact ? 'px-2 text-[10px] leading-tight' : 'text-sm'}`}>
                    Unable to see your hand
                </div>
            </div>
        );
    }

    return (
        <div className={compact
            ? 'h-20 w-44 overflow-hidden rounded-lg border border-zinc-500/50 bg-zinc-900/80 shadow-xl'
            : 'rounded-xl overflow-hidden shadow-2xl w-64 h-auto border border-zinc-500/50 bg-zinc-900/50 backdrop-blur'
        }>
            <HandCameraView tableId={tableId} roomName={roomName} compact={compact} />
        </div>
    );
}

function HandCameraView({ tableId, roomName, compact = false }: { tableId: string; roomName: string; compact?: boolean }) {
    // Get token for the hand camera room using roomName override
    const tokenQuery = api.table.livekitToken.useQuery({ tableId, roomName }, { enabled: !!tableId && !!roomName });
    if (!tokenQuery.data) return <NullState compact={compact} />;

    return (
        <LiveKitRoom
            token={tokenQuery.data.token}
            serverUrl={tokenQuery.data.serverUrl}
            connectOptions={{ autoSubscribe: true }}
        >
            <RoomAudioRenderer />
            <HandCameraVideoContent compact={compact} />
        </LiveKitRoom>
    );
}

function HandCameraVideoContent({ compact = false }: { compact?: boolean }) {
    const tracks = useTracks([Track.Source.Camera]);
    const cameraTrack = tracks[0];

    if (!cameraTrack) {
        return <NullState compact={compact} />;
    }

    return (
        <div className="w-full h-full">
            <ParticipantTile trackRef={cameraTrack}>
                <VideoTrack trackRef={cameraTrack} className="h-full w-full object-cover" />
            </ParticipantTile>
        </div>
    );
}

function NullState({ compact = false }: { compact?: boolean }) {
    return (
        <div className={`flex items-center justify-center font-medium w-full text-zinc-400 ${compact ? 'h-full text-[10px]' : 'h-40 text-sm'}`}>
            Loading Your Hand...
        </div>
    );
}