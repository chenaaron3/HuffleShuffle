import '@livekit/components-styles';

import { Track } from 'livekit-client';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import * as React from 'react';
import { TableSetupModal } from '~/components/TableSetupModal';
import { ActionButtons } from '~/components/ui/action-buttons';
import { CardImage } from '~/components/ui/card-img';
import { DealerCamera } from '~/components/ui/dealer-camera';
import { GlowingEffect } from '~/components/ui/glowing-effect';
import { HandCamera } from '~/components/ui/hand-camera';
import { SeatCard as SeatCardUI } from '~/components/ui/seat-card';
import { SeatSection } from '~/components/ui/seat-section';
import { api } from '~/utils/api';
import { rsaDecryptBase64 } from '~/utils/crypto';
import { disconnectPusherClient, getPusherClient } from '~/utils/pusher-client';

import {
    LiveKitRoom, ParticipantTile, RoomAudioRenderer, StartAudio, TrackToggle, useLocalParticipant,
    useParticipantTracks, useRoomContext, useTracks, VideoTrack
} from '@livekit/components-react';

import type { SeatWithPlayer } from '~/server/api/routers/table';
export default function TableView() {
    const router = useRouter();
    const { id } = router.query as { id?: string };
    const tableIdStr = id ?? '';
    const { data: session } = useSession();

    const tableQuery = api.table.get.useQuery({ tableId: id ?? '' }, { enabled: !!id });
    const action = api.table.action.useMutation();

    const [dealRank, setDealRank] = React.useState<string>('A');
    const [dealSuit, setDealSuit] = React.useState<string>('s');
    const [showSetup, setShowSetup] = React.useState<boolean>(false);

    const snapshot = tableQuery.data;
    const seats = snapshot?.seats ?? [];
    const state: string | undefined = snapshot?.game?.state as any;
    const dealSeatId = state === 'DEAL_HOLE_CARDS' ? (snapshot?.game?.assignedSeatId ?? null) : null;
    const bettingActorSeatId = state === 'BETTING' ? (snapshot?.game?.assignedSeatId ?? null) : null;
    const currentUserSeatId = seats.find((s: any) => s.playerId === session?.user?.id)?.id ?? null;
    const highlightedSeatId = dealSeatId ?? bettingActorSeatId;

    const currentSeat = seats.find((s: any) => s.playerId === session?.user?.id) as any | undefined;
    const [handRoomName, setHandRoomName] = React.useState<string | null>(null);
    React.useEffect(() => {
        (async () => {
            if (!id || !currentSeat?.encryptedUserNonce) return;
            try {
                const roomName = await rsaDecryptBase64(id, currentSeat.encryptedUserNonce);
                console.log('roomName', roomName);
                setHandRoomName(roomName);
            } catch (e) {
                console.error('Error decrypting hand room name', e);
            }
        })();
    }, [id, currentSeat?.encryptedUserNonce]);

    // Pusher subscription for real-time table updates
    React.useEffect(() => {
        if (!id) return;

        const pusher = getPusherClient();
        if (!pusher) return;

        const channel = pusher.subscribe(id);

        channel.bind('table-updated', () => {
            console.log('Table update received, refetching data...');
            void tableQuery.refetch();
        });

        return () => {
            channel.unbind_all();
            pusher.unsubscribe(id);
        };
    }, [id, tableQuery]);

    // Cleanup Pusher connection on unmount
    React.useEffect(() => {
        return () => {
            disconnectPusherClient();
        };
    }, []);

    const dealerSeatId = snapshot?.game?.dealerButtonSeatId ?? null;
    const dealerIdx = dealerSeatId ? seats.findIndex((s: any) => s.id === dealerSeatId) : -1;
    const smallBlindIdx = dealerIdx >= 0 ? (dealerIdx + 1) % seats.length : -1;
    const bigBlindIdx = dealerIdx >= 0 ? (dealerIdx + 2) % seats.length : -1;

    function getDealtSet() {
        const dealt = new Set<string>();
        if (snapshot?.game?.communityCards) {
            snapshot.game.communityCards.forEach((c) => dealt.add(c));
        }
        seats.forEach((s: any) => {
            (s.cards ?? []).forEach((c: string) => dealt.add(c));
        });
        return dealt;
    }

    function pickRandomUndealt(): string | null {
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
        const suits = ['s', 'h', 'd', 'c'];
        const dealt = getDealtSet();
        const deck: string[] = [];
        for (const r of ranks) for (const s of suits) deck.push(`${r}${s}`);
        const remaining = deck.filter((c) => !dealt.has(c));
        if (remaining.length === 0) return null;
        const idx = Math.floor(Math.random() * remaining.length);
        return remaining[idx] as string;
    }

    // LiveKit: fetch token when tableId is known and user is part of the table
    const livekit = api.table.livekitToken.useQuery(
        { tableId: id ?? '' },
        { enabled: !!id && !!session?.user?.id }
    );

    const canRenderLivekit = Boolean(id && livekit.data?.token && livekit.data?.serverUrl);

    return (
        <>
            <Head>
                <title>Table - HuffleShuffle</title>
            </Head>
            <main className="h-screen bg-black text-white overflow-hidden">
                {canRenderLivekit ? (
                    <LiveKitRoom
                        token={livekit.data!.token}
                        serverUrl={livekit.data!.serverUrl}
                        connectOptions={{ autoSubscribe: true }}
                        video={true}
                        audio={true}
                    >
                        <RoomAudioRenderer />
                        <div className="mx-auto mt-4 flex max-w-7xl items-center gap-3 px-4">
                            <StartAudio label="Enable Audio" />
                            {session?.user?.role === 'dealer' && (
                                <button
                                    onClick={() => setShowSetup(true)}
                                    className="ml-auto rounded-md bg-white px-3 py-2 text-sm font-medium text-black hover:bg-zinc-200"
                                >
                                    Settings
                                </button>
                            )}
                        </div>
                        {/* New 8-seat rectangular layout */}
                        <div className="flex h-full gap-4 px-4 py-4">
                            {/* Left side seats (4, 3, 2, 1) */}
                            <SeatSection
                                seats={seats.slice(0, 4)}
                                highlightedSeatId={highlightedSeatId}
                                smallBlindIdx={smallBlindIdx}
                                bigBlindIdx={bigBlindIdx}
                                myUserId={session?.user?.id ?? null}
                                side="left"
                            />

                            {/* Center area with dealer cam and controls */}
                            <div className="flex flex-1 flex-col items-center gap-4">
                                {/* Game Status Banner - Above Dealer */}
                                <GameStatusBanner
                                    isDealer={session?.user?.role === 'dealer'}
                                    state={state}
                                    seats={seats}
                                    activeSeatId={highlightedSeatId}
                                    bettingActorSeatId={bettingActorSeatId}
                                    currentUserSeatId={currentUserSeatId}
                                />

                                {/* Dealer Camera with Community Cards Overlay */}
                                <DealerCamera
                                    communityCards={snapshot?.game?.communityCards ?? []}
                                    potTotal={snapshot?.game?.potTotal ?? 0}
                                />

                                {/* Hand Camera and Action Buttons Row */}
                                <div className="flex w-full items-center justify-between gap-4">
                                    {/* Hand Camera - Left */}
                                    <HandCamera
                                        tableId={tableIdStr}
                                        roomName={handRoomName}
                                    />

                                    {/* Action Buttons - Center */}
                                    <ActionButtons
                                        isDealer={session?.user?.role === 'dealer'}
                                        state={state}
                                        currentUserSeatId={currentUserSeatId}
                                        bettingActorSeatId={bettingActorSeatId}
                                        onAction={(actionType, params) => action.mutate({ tableId: id!, action: actionType as any, params })}
                                        onDealCard={(rank, suit) => action.mutate({ tableId: id!, action: 'DEAL_CARD', params: { rank, suit } })}
                                        onRandomCard={() => {
                                            const code = pickRandomUndealt();
                                            if (!code) return;
                                            action.mutate({ tableId: id!, action: 'DEAL_CARD', params: { rank: code[0], suit: code[1] } });
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Right side seats (5, 6, 7, 8) */}
                            <SeatSection
                                seats={seats.slice(4, 8)}
                                highlightedSeatId={highlightedSeatId}
                                smallBlindIdx={smallBlindIdx}
                                bigBlindIdx={bigBlindIdx}
                                myUserId={session?.user?.id ?? null}
                                side="right"
                            />
                        </div>
                    </LiveKitRoom>
                ) : (
                    <div className="flex min-h-screen items-center justify-center">
                        <div className="text-zinc-400">Connecting to table audio/video…</div>
                    </div>
                )}
                {handRoomName && (
                    <div className="fixed bottom-4 right-4 z-40 w-[360px] max-w-[40vw]">
                        <HandCameraView tableId={tableIdStr} roomName={handRoomName} />
                    </div>
                )}
            </main>
            {session?.user?.role === 'dealer' && (
                <TableSetupModal tableId={tableIdStr} open={showSetup} onClose={() => setShowSetup(false)} />
            )}
        </>
    );
}

function ActionBtn({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
    return (
        <button onClick={onClick} disabled={disabled} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60">
            {children}
        </button>
    );
}


function GameStatusBanner({ isDealer, state, seats, activeSeatId, bettingActorSeatId, currentUserSeatId }: { isDealer: boolean; state?: string; seats: SeatWithPlayer[]; activeSeatId: string | null; bettingActorSeatId?: string | null; currentUserSeatId?: string | null }) {
    if (!state) return null;
    const dealing = ['DEAL_HOLE_CARDS', 'DEAL_FLOP', 'DEAL_TURN', 'DEAL_RIVER'].includes(state);
    const betting = state === 'BETTING';
    if (!dealing && !betting) return null;

    let label = '' as string;
    if (state === 'DEAL_HOLE_CARDS') {
        const seat = seats.find((s: any) => s.id === activeSeatId);
        const seatIdx = seats.findIndex((s: any) => s.id === activeSeatId);
        label = seat ? `Deal next hole card to ${seat.player?.name ?? 'a player'} at seat ${seatIdx + 0}` : 'Deal next hole card';
    } else if (state === 'DEAL_FLOP') {
        label = 'Deal the flop';
    } else if (state === 'DEAL_TURN') {
        label = 'Deal the turn';
    } else if (state === 'DEAL_RIVER') {
        label = 'Deal the river';
    } else if (betting) {
        const seat = seats.find((s: any) => s.id === bettingActorSeatId);
        const who = seat ? `${seat.player?.name ?? 'a player'}` : 'a player';
        const yourTurn = currentUserSeatId && bettingActorSeatId && currentUserSeatId === bettingActorSeatId;
        label = yourTurn ? 'Your turn to act' : `${who}'s turn to act`;
    }

    const isDealerBanner = dealing;
    const bannerText = isDealerBanner
        ? (isDealer ? `Your action: ${label}` : `Waiting for dealer: ${label}`)
        : label;
    const bannerClass = dealing
        ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200'
        : 'border-sky-500/30 bg-sky-500/10 text-sky-200';

    return (
        <div className={`mt-3 flex items-center gap-3 rounded-lg border px-4 py-2 ${bannerClass}`}>
            <span className={`h-2 w-2 animate-pulse rounded-full ${dealing ? 'bg-yellow-400' : 'bg-sky-400'}`} />
            <span className="text-sm">{bannerText}</span>
        </div>
    );
}

function DealerCenterVideo() {
    const tracks = useTracks([Track.Source.Camera]);
    const dealerRef = tracks.find((t) => t.participant.identity === 'dealer-camera');
    if (!dealerRef) return null;
    return (
        <div className="mb-3 w-full overflow-hidden rounded-lg bg-black aspect-video">
            <ParticipantTile trackRef={dealerRef}>
                <VideoTrack trackRef={dealerRef} />
            </ParticipantTile>
        </div>
    );
}

function HandCameraView({ tableId, roomName }: { tableId: string; roomName: string }) {
    // Get token for the hand camera room using roomName override
    const tokenQuery = api.table.livekitToken.useQuery({ tableId, roomName }, { enabled: !!tableId && !!roomName });
    if (!tokenQuery.data) return null;
    return (
        <div className="w-full max-w-2xl mx-auto overflow-hidden rounded-lg border border-white/10 bg-black">
            <LiveKitRoom token={tokenQuery.data.token} serverUrl={tokenQuery.data.serverUrl} connectOptions={{ autoSubscribe: true }}>
                <RoomAudioRenderer />
                <HandCameraVideoContent />
            </LiveKitRoom>
        </div>
    );
}

function HandCameraVideoContent() {
    const tracks = useTracks([Track.Source.Camera]);
    const cameraTrack = tracks[0];
    if (!cameraTrack) {
        return (
            <div className="aspect-video flex items-center justify-center text-xs text-zinc-400">
                Waiting to see your hand...
            </div>
        );
    }
    return (
        <div className="aspect-video">
            <ParticipantTile trackRef={cameraTrack}>
                <VideoTrack trackRef={cameraTrack} />
            </ParticipantTile>
        </div>
    );
}