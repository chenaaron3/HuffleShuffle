import '@livekit/components-styles';

import { Track } from 'livekit-client';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import * as React from 'react';
import { TableSetupModal } from '~/components/TableSetupModal';
import { CardImage } from '~/components/ui/card-img';
import { GlowingEffect } from '~/components/ui/glowing-effect';
import { SeatCard as SeatCardUI } from '~/components/ui/seat-card';
import { api } from '~/utils/api';
import { rsaDecryptBase64 } from '~/utils/crypto';

import {
    LiveKitRoom, ParticipantTile, RoomAudioRenderer, StartAudio, TrackToggle, useLocalParticipant,
    useParticipantTracks, useRoomContext, useTracks, VideoTrack
} from '@livekit/components-react';

import type { SeatWithPlayer } from '~/server/api/routers/table';
import { useEffect, useState } from 'react';
export default function TableView() {
    const router = useRouter();
    const { id } = router.query as { id?: string };
    const tableIdStr = id ?? '';
    const { data: session } = useSession();

    const tableQuery = api.table.get.useQuery({ tableId: id ?? '' }, { enabled: !!id, });
    const action = api.table.action.useMutation({ onSuccess: () => tableQuery.refetch() });

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
    const [handRoomName, setHandRoomName] = useState<string | null>(null);
    useEffect(() => {
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
            <main className="min-h-screen bg-black text-white">
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
                        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-4">
                            {/* Wrap middle and side rails in LiveKitRoom so SeatCard can access participants */}
                            <aside className="order-2 flex flex-col gap-3 md:order-1">
                                {seats.slice(0, Math.ceil(seats.length / 2)).map((s: any, i: number) => (
                                    <SeatCardUI
                                        key={s.id}
                                        seat={s}
                                        index={i}
                                        small={i === smallBlindIdx}
                                        big={i === bigBlindIdx}
                                        active={!!highlightedSeatId && s.id === highlightedSeatId}
                                        myUserId={session?.user?.id ?? null}
                                    />
                                ))}
                            </aside>

                            {/* Center stage */}
                            <section className="order-1 md:order-2 md:col-span-2">
                                <DealerCenterVideo />
                                {/* Hand camera moved to floating bottom-right */}
                                <div className="relative mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-zinc-900/50 px-5 py-4">
                                    <GlowingEffect disabled={false} blur={4} proximity={80} spread={24} className="rounded-lg" />
                                    <div className="flex items-center gap-4">
                                        {(snapshot?.game?.communityCards ?? []).map((c: string) => (
                                            <CardImage key={c} code={c} size={120} />
                                        ))}
                                    </div>
                                    <div className="text-base text-zinc-200">Pot: {snapshot?.game?.potTotal ?? 0}</div>
                                </div>

                                <GameStatusBanner
                                    isDealer={session?.user?.role === 'dealer'}
                                    state={state}
                                    seats={seats}
                                    activeSeatId={highlightedSeatId}
                                    bettingActorSeatId={bettingActorSeatId}
                                    currentUserSeatId={currentUserSeatId}
                                />

                                {/* LiveKit room wraps the whole table layout so SeatCards can access participants */}

                                <div className="mt-4 grid grid-cols-5 gap-3">
                                    {session?.user?.role === 'dealer' ? (
                                        <>
                                            <select
                                                aria-label="Rank"
                                                value={dealRank}
                                                onChange={(e) => setDealRank(e.target.value)}
                                                className="rounded-md bg-white px-2 py-2 text-sm font-medium text-black hover:bg-zinc-200"
                                            >
                                                {['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'].map((r) => (
                                                    <option key={r} value={r}>{r}</option>
                                                ))}
                                            </select>
                                            <select
                                                aria-label="Suit"
                                                value={dealSuit}
                                                onChange={(e) => setDealSuit(e.target.value)}
                                                className="rounded-md bg-white px-2 py-2 text-sm font-medium text-black hover:bg-zinc-200"
                                            >
                                                {[
                                                    { value: 's', label: 'Spades (s)' },
                                                    { value: 'h', label: 'Hearts (h)' },
                                                    { value: 'd', label: 'Diamonds (d)' },
                                                    { value: 'c', label: 'Clubs (c)' },
                                                ].map((s) => (
                                                    <option key={s.value} value={s.value}>{s.label}</option>
                                                ))}
                                            </select>
                                            <ActionBtn onClick={() => action.mutate({ tableId: id!, action: 'START_GAME' })}>Start Game</ActionBtn>
                                            <ActionBtn onClick={() => action.mutate({ tableId: id!, action: 'DEAL_CARD', params: { rank: dealRank, suit: dealSuit } })}>Deal</ActionBtn>
                                            <ActionBtn onClick={() => {
                                                const code = pickRandomUndealt();
                                                console.log('code', code);
                                                if (!code) return;
                                                action.mutate({ tableId: id!, action: 'DEAL_CARD', params: { rank: code[0], suit: code[1] } });
                                            }}>Random</ActionBtn>
                                        </>
                                    ) : (
                                        <>
                                            <ActionBtn disabled={state !== 'BETTING' || currentUserSeatId !== bettingActorSeatId} onClick={() => action.mutate({ tableId: id!, action: 'CHECK' })}>Check</ActionBtn>
                                            <ActionBtn
                                                disabled={state !== 'BETTING' || currentUserSeatId !== bettingActorSeatId}
                                                onClick={() => {
                                                    const activeSeats = (seats as any[]).filter((s: any) => s.isActive);
                                                    const maxBet = activeSeats.length ? Math.max(...activeSeats.map((s: any) => s.currentBet ?? 0)) : 0;
                                                    const amount = maxBet + 20;
                                                    action.mutate({ tableId: id!, action: 'RAISE', params: { amount } });
                                                }}
                                            >
                                                Raise +20
                                            </ActionBtn>
                                            <ActionBtn disabled={state !== 'BETTING' || currentUserSeatId !== bettingActorSeatId} onClick={() => action.mutate({ tableId: id!, action: 'FOLD' })}>Fold</ActionBtn>
                                        </>
                                    )}
                                </div>

                                {/* Dealer video and chat removed for now */}
                            </section>

                            {/* Right rail seats */}
                            <aside className="order-3 flex flex-col gap-3">
                                {seats.slice(Math.ceil(seats.length / 2)).map((s: any, i: number) => (
                                    <SeatCardUI
                                        key={s.id}
                                        seat={s}
                                        index={i + Math.ceil(seats.length / 2)}
                                        small={i + Math.ceil(seats.length / 2) === smallBlindIdx}
                                        big={i + Math.ceil(seats.length / 2) === bigBlindIdx}
                                        active={!!highlightedSeatId && s.id === highlightedSeatId}
                                        myUserId={session?.user?.id ?? null}
                                    />
                                ))}
                            </aside>
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
                Waiting for hand camera...
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