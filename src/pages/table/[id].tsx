import { useSession } from 'next-auth/react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import * as React from 'react';
import { TableAnimation } from '~/components/TableAnimation';
import { TableSetupModal } from '~/components/TableSetupModal';
import { DealerCamera } from '~/components/ui/dealer-camera';
import { EventFeed } from '~/components/ui/event-feed';
import { HandCamera } from '~/components/ui/hand-camera';
import { SeatSection } from '~/components/ui/seat-section';
import { useTableEvents } from '~/hooks/use-table-events';
import { api } from '~/utils/api';
import { rsaDecryptBase64 } from '~/utils/crypto';
import { disconnectPusherClient, getPusherClient } from '~/utils/pusher-client';

import { LiveKitRoom, RoomAudioRenderer, StartAudio } from '@livekit/components-react';

import type { SeatWithPlayer } from '~/server/api/routers/table';
export default function TableView() {
    const router = useRouter();
    const { id } = router.query as { id?: string };
    const tableIdStr = id ?? '';
    const { data: session } = useSession();

    const tableQuery = api.table.get.useQuery({ tableId: id ?? '' }, { enabled: !!id });
    const [snapshot, setSnapshot] = React.useState(tableQuery.data);

    // Update snapshot when tableQuery data changes
    React.useEffect(() => {
        if (tableQuery.data) {
            setSnapshot(tableQuery.data);
        }
    }, [tableQuery.data]);

    const action = api.table.action.useMutation({
        onSuccess: (data) => {
            // Update snapshot directly with returned gameplay state
            if (data) {
                setSnapshot(data);
            }
        },
        onError: (error) => {
            console.error('Action failed:', error);
            // Could add toast notification here
        }
    });

    const leaveMutation = api.table.leave.useMutation({
        onSuccess: () => {
            // Redirect to lobby after successfully leaving
            void router.push('/lobby');
        },
    });

    const [showSetup, setShowSetup] = React.useState<boolean>(false);

    // Create padded seats array on client side - array index matches seat number
    const paddedSeats = React.useMemo(() => {
        if (!snapshot?.table?.maxSeats || !snapshot?.seats) return [];

        const maxSeats = snapshot.table.maxSeats;
        return Array.from({ length: maxSeats }, (_, index) => {
            const seat = snapshot.seats.find(s => s.seatNumber === index);
            return seat || null;
        });
    }, [snapshot?.table?.maxSeats, snapshot?.seats]);

    const seats = paddedSeats; // For rendering (includes nulls for empty seats)
    const originalSeats = snapshot?.seats ?? []; // For calculations (only actual seats)

    const state: string | undefined = snapshot?.game?.state as any;
    const dealSeatId = state === 'DEAL_HOLE_CARDS' ? (snapshot?.game?.assignedSeatId ?? null) : null;
    const bettingActorSeatId = state === 'BETTING' ? (snapshot?.game?.assignedSeatId ?? null) : null;
    const currentUserSeatId = originalSeats.find((s: SeatWithPlayer) => s.playerId === session?.user?.id)?.id ?? null;
    const highlightedSeatId = dealSeatId ?? bettingActorSeatId;

    const currentSeat = originalSeats.find((s: SeatWithPlayer) => s.playerId === session?.user?.id) as SeatWithPlayer | undefined;
    const [handRoomName, setHandRoomName] = React.useState<string | null>(null);

    // --- Event feed managed by hook ---
    const { events } = useTableEvents({ tableId: id, activeGameId: snapshot?.game?.id ?? null });

    // Memoize winning cards calculation to prevent unnecessary re-renders
    const allWinningCards = React.useMemo(() => {
        const winningCards = new Set<string>();
        if (state === 'SHOWDOWN') {
            originalSeats.forEach((seat: SeatWithPlayer) => {
                if (Array.isArray(seat.winningCards)) {
                    seat.winningCards.forEach((card: string) => {
                        winningCards.add(card);
                    });
                }
            });
        }
        return Array.from(winningCards);
    }, [state, originalSeats]);

    // Memoize pot total calculation to prevent unnecessary re-renders
    const totalPot = React.useMemo(() => {
        return (snapshot?.game?.potTotal ?? 0);
    }, [snapshot?.game?.potTotal, originalSeats]);

    // Memoize active player name calculation to prevent unnecessary re-renders
    const activePlayerName = React.useMemo(() => {
        if (state === 'BETTING') {
            return originalSeats.find((s: SeatWithPlayer) => s.id === bettingActorSeatId)?.player?.name ?? undefined;
        }
        return undefined;
    }, [state, originalSeats, bettingActorSeatId]);

    // Memoize maximum bet calculation to prevent unnecessary re-renders
    const maxBet = React.useMemo(() => {
        return Math.max(...originalSeats.filter(s => s.isActive).map(s => s.currentBet), 0);
    }, [originalSeats]);
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

    // Force refresh when game state changes to SHOWDOWN to fix card display
    React.useEffect(() => {
        if (state === 'SHOWDOWN') {
            // Small delay to ensure backend has updated
            const timer = setTimeout(() => {
                void tableQuery.refetch();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [state]); // Removed tableQuery dependency

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
    }, [id]); // Removed tableQuery dependency

    // Cleanup Pusher connection on unmount
    React.useEffect(() => {
        return () => {
            disconnectPusherClient();
        };
    }, []);

    const dealerSeatId = snapshot?.game?.dealerButtonSeatId ?? null;
    const dealerSeat = dealerSeatId ? seats.find((s: SeatWithPlayer | null) => s?.id === dealerSeatId) : null;
    const dealerSeatNumber = dealerSeat?.seatNumber ?? -1;

    // Find the next occupied seats for blinds (not just next seat numbers)
    const findNextOccupiedSeat = (startSeatNumber: number): number => {
        if (startSeatNumber < 0) return -1;

        const totalSeats = snapshot?.table?.maxSeats ?? 8;
        for (let i = 1; i < totalSeats; i++) {
            const nextSeatNumber = (startSeatNumber + i) % totalSeats;
            if (seats[nextSeatNumber] !== null) {
                return nextSeatNumber;
            }
        }
        return -1; // No occupied seats found
    };

    const smallBlindSeatNumber = findNextOccupiedSeat(dealerSeatNumber);
    const bigBlindSeatNumber = smallBlindSeatNumber >= 0 ? findNextOccupiedSeat(smallBlindSeatNumber) : -1;

    // Array indices now match seat numbers since array is padded
    const smallBlindIdx = smallBlindSeatNumber;
    const bigBlindIdx = bigBlindSeatNumber;

    function getDealtSet() {
        const dealt = new Set<string>();
        if (snapshot?.game?.communityCards) {
            snapshot.game.communityCards.forEach((c) => dealt.add(c));
        }
        originalSeats.forEach((s: SeatWithPlayer) => {
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
                {/* Table Status Indicator */}
                {canRenderLivekit ? (
                    <LiveKitRoom
                        token={livekit.data!.token}
                        serverUrl={livekit.data!.serverUrl}
                        connectOptions={{ autoSubscribe: true }}
                        video={true}
                        audio={true}
                    >
                        <RoomAudioRenderer />
                        <div className="absolute z-10 right-0 flex max-w-7xl items-center gap-3 px-4">
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
                        {/* Improved 8-seat layout with centered hand camera */}
                        <div className="flex h-full gap-4 px-4 py-4">
                            {/* Left side seats (4, 3, 2, 1) */}
                            <SeatSection
                                key={`left-${snapshot?.game?.id}`}
                                seats={seats.slice(0, 4)}
                                highlightedSeatId={highlightedSeatId}
                                smallBlindIdx={smallBlindIdx}
                                bigBlindIdx={bigBlindIdx}
                                myUserId={session?.user?.id ?? null}
                                side="left"
                                gameState={state}
                            />

                            {/* Center area with dealer cam and player controls */}
                            <div className="flex flex-1 flex-col items-center gap-6">
                                {/* Dealer Camera with Community Cards Overlay */}
                                <DealerCamera
                                    communityCards={snapshot?.game?.communityCards ?? []}
                                    potTotal={totalPot}
                                    gameStatus={state}
                                    activePlayerName={activePlayerName}
                                    winningCards={allWinningCards}
                                    isDealer={session?.user?.role === 'dealer'}
                                    isJoinable={snapshot?.isJoinable ?? false}
                                    currentUserSeatId={currentUserSeatId}
                                    bettingActorSeatId={bettingActorSeatId}
                                    isLoading={action.isPending || leaveMutation.isPending}
                                    currentBet={currentSeat?.currentBet ?? 0}
                                    playerBalance={currentSeat?.buyIn ?? 0}
                                    bigBlind={snapshot?.table?.bigBlind ?? 20}
                                    maxBet={maxBet}
                                    onAction={(actionType, params) => {
                                        if (actionType === 'LEAVE') {
                                            leaveMutation.mutate({ tableId: id! });
                                        } else {
                                            action.mutate({ tableId: id!, action: actionType as any, params });
                                        }
                                    }}
                                    onDealCard={(rank, suit) => {
                                        action.mutate({ tableId: id!, action: 'DEAL_CARD', params: { rank, suit } });
                                    }}
                                    onRandomCard={() => {
                                        const code = pickRandomUndealt();
                                        if (!code) return;
                                        action.mutate({ tableId: id!, action: 'DEAL_CARD', params: { rank: code[0], suit: code[1] } });
                                    }}
                                    onLeaveTable={() => leaveMutation.mutate({ tableId: id! })}
                                    isLeaving={leaveMutation.isPending}
                                />

                                {/* Hand area: grid layout -> [1fr auto 1fr]; camera centered by auto column */}
                                <div className="grid w-full grid-cols-[1fr_auto_1fr] items-start gap-3">
                                    <div className="min-w-0">
                                        <EventFeed events={events} seats={originalSeats as any} />
                                    </div>
                                    <HandCamera
                                        tableId={tableIdStr}
                                        roomName={handRoomName}
                                    />
                                    <div />
                                </div>
                            </div>

                            {/* Right side seats (5, 6, 7, 8) */}
                            <SeatSection
                                key={`right-${snapshot?.game?.id}`}
                                seats={seats.slice(4, 8)}
                                highlightedSeatId={highlightedSeatId}
                                smallBlindIdx={smallBlindIdx}
                                bigBlindIdx={bigBlindIdx}
                                myUserId={session?.user?.id ?? null}
                                side="right"
                                gameState={state}
                            />
                        </div>
                        <TableAnimation
                            seats={originalSeats}
                            gameState={state ?? ''}
                        />
                    </LiveKitRoom>
                ) : (
                    <div className="flex min-h-screen items-center justify-center">
                        <div className="text-zinc-400">Connecting to table audio/video…</div>
                    </div>
                )}
            </main>
            {session?.user?.role === 'dealer' && (
                <TableSetupModal tableId={tableIdStr} open={showSetup} onClose={() => setShowSetup(false)} />
            )}
        </>
    );
}
