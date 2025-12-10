import { useSession } from 'next-auth/react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import * as React from 'react';
import { AutoBackgroundBlur } from '~/components/livekit/AutoBackgroundBlur';
import { TableAnimation } from '~/components/TableAnimation';
import { TableSetupModal } from '~/components/TableSetupModal';
import { DealerCamera } from '~/components/ui/dealer-camera';
import { EventFeed } from '~/components/ui/event-feed';
import { HandCamera } from '~/components/ui/hand-camera';
import { MediaPermissionsModal } from '~/components/ui/media-permissions-modal';
import { MobileBettingView, MobileTableLayout } from '~/components/ui/mobile';
import { QuickActions } from '~/components/ui/quick-actions';
import { SeatSection } from '~/components/ui/seat-section';
import { useBackgroundBlur } from '~/hooks/use-background-blur';
import { useBlindIncreaseToast } from '~/hooks/use-blind-increase-toast';
import { useDealerCardSound } from '~/hooks/use-dealer-card-sound';
import { useDealerTimer } from '~/hooks/use-dealer-timer';
import { useQuickActions } from '~/hooks/use-quick-actions';
import { useTableEvents } from '~/hooks/use-table-events';
import { useTableQuery } from '~/hooks/use-table-query';
import {
    useActivePlayerName, useBettingActorSeatId, useBlindSeatNumbers, useCommunityCards,
    useCurrentSeat, useCurrentUserSeatId, useDealSeatId, useGameState, useHighlightedSeatId,
    useMaxBet, useOriginalSeats, usePaddedSeats, useTableSnapshot, useTotalPot, useWinningCards
} from '~/hooks/use-table-selectors';
import { api } from '~/utils/api';
import { generateRsaKeyPairForTable, rsaDecryptBase64 } from '~/utils/crypto';
import { disconnectPusherClient, getPusherClient } from '~/utils/pusher-client';
import { SIGNALS } from '~/utils/signal-constants';

import { LiveKitRoom, RoomAudioRenderer, StartAudio } from '@livekit/components-react';

export default function TableView() {
    const router = useRouter();
    const { id } = router.query as { id?: string };
    const tableIdStr = id ?? '';
    const { data: session } = useSession();
    const { enabled: backgroundBlurEnabled } = useBackgroundBlur();
    const isDealerRole = session?.user?.role === 'dealer';
    const isPlayer = session?.user?.role === 'player';

    // Use the hook that manages query and updates store
    const tableQuery = useTableQuery(id);
    const updateSnapshot = tableQuery.updateSnapshot;

    const action = api.table.action.useMutation({
        onSuccess: (data) => {
            // Update store with returned gameplay state
            if (data) {
                updateSnapshot(data);
            }
        },
        onError: (error) => {
            console.error('Action failed:', error);
            // Could add toast notification here
        }
    });

    const utils = api.useUtils();
    const changeSeat = api.table.changeSeat.useMutation({
        onSuccess: (data) => {
            if (data) {
                // Update store and cache
                updateSnapshot(data);
                utils.table.get.setData({ tableId: id ?? '' }, data);
            }
        },
        onError: (error) => {
            console.error('Change seat failed:', error);
        },
        onSettled: () => {
            setMovingSeat(null);
        }
    });

    const leaveMutation = api.table.leave.useMutation({
        onSuccess: () => {
            // Redirect to lobby after successfully leaving
            void router.push('/lobby');
        },
    });

    const dealerLeaveMutation = api.table.dealerLeave.useMutation({
        onSuccess: () => {
            // Redirect to lobby after successfully leaving
            void router.push('/lobby');
        },
    });

    const [showSetup, setShowSetup] = React.useState<boolean>(false);
    const [movingSeat, setMovingSeat] = React.useState<number | null>(null);

    // Use selector hooks for computed values
    const snapshot = useTableSnapshot();
    const seats = usePaddedSeats(); // For rendering (includes nulls for empty seats)
    const originalSeats = useOriginalSeats(); // For calculations (only actual seats)
    const state = useGameState();
    const dealSeatId = useDealSeatId();
    const bettingActorSeatId = useBettingActorSeatId();
    const highlightedSeatId = useHighlightedSeatId();
    const currentUserSeatId = useCurrentUserSeatId(session?.user?.id);
    const currentSeat = useCurrentSeat(session?.user?.id);
    const [handRoomName, setHandRoomName] = React.useState<string | null>(null);

    // --- Event feed managed by hook ---
    const { events, refreshEvents: refreshEventFeed } = useTableEvents({ tableId: id });

    // Use selector hooks for computed values
    const allWinningCards = useWinningCards();
    const totalPot = useTotalPot();
    const activePlayerName = useActivePlayerName();
    const maxBet = useMaxBet();
    const { smallBlindIdx, bigBlindIdx, dealerButtonIdx } = useBlindSeatNumbers();

    // --- Quick actions hook ---
    const { quickAction, setQuickAction } = useQuickActions({
        tableId: id,
        currentSeat,
        gameState: state,
        bettingActorSeatId,
        maxBet,
    });

    // --- Dealer timer hook ---
    const isDealerAtTable = isDealerRole && snapshot?.table?.dealerId === session?.user?.id;
    useDealerTimer({
        tableId: id ?? '',
        gameState: state,
        assignedSeatId: bettingActorSeatId,
        turnStartTime: snapshot?.game?.turnStartTime ?? null,
        isDealer: !!isDealerAtTable,
    });

    // --- Dealer card sound hook ---
    useDealerCardSound({
        isDealer: !!isDealerAtTable,
    });

    // --- Blind increase toast hook ---
    useBlindIncreaseToast();
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
    }, [state]);

    // Pusher subscription for real-time table updates
    React.useEffect(() => {
        if (!id) return;

        const pusher = getPusherClient();
        if (!pusher) return;

        const channel = pusher.subscribe(id);

        channel.bind(SIGNALS.TABLE_UPDATED, async () => {
            console.log('Table update received, refetching data...');
            tableQuery.refetch();
            refreshEventFeed();
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

    const communityCards = useCommunityCards();

    function getDealtSet() {
        const dealt = new Set<string>();
        if (communityCards.length > 0) {
            communityCards.forEach((c) => dealt.add(c));
        }
        originalSeats.forEach((s) => {
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

    // Shared seat section props for reuse in desktop and mobile layouts
    const seatSectionProps = {
        highlightedSeatId,
        smallBlindIdx,
        bigBlindIdx,
        dealerButtonIdx,
        myUserId: session?.user?.id ?? null,
        gameState: state,
        canMoveSeat: Boolean(snapshot?.isJoinable && currentUserSeatId),
        movingSeatNumber: movingSeat,
        turnStartTime: snapshot?.game?.turnStartTime ?? null,
        tableId: tableIdStr,
        dealerCanControlAudio: isDealerAtTable,
        onMoveSeat: async (seatNumber: number) => {
            if (!id || movingSeat !== null) return;
            try {
                setMovingSeat(seatNumber);
                const { publicKeyPem } = await generateRsaKeyPairForTable(id);
                await changeSeat.mutateAsync({ tableId: id, toSeatNumber: seatNumber, userPublicKey: publicKeyPem });
            } catch (e) {
                console.error('Failed to generate keypair for seat move', e);
                setMovingSeat(null);
            }
        },
    };

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
                        <AutoBackgroundBlur enabled={!isDealerRole && backgroundBlurEnabled} />
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

                        <MobileTableLayout
                            desktopContent={
                                <>
                                    {/* Desktop: Improved 8-seat layout with centered hand camera */}
                                    <div className="flex h-full gap-4 px-4 py-4">
                                        {/* Left side seats (4, 3, 2, 1) */}
                                        <SeatSection
                                            key={`left-${tableIdStr}`}
                                            seats={seats.slice(0, 4)}
                                            side="left"
                                            {...seatSectionProps}
                                        />

                                        {/* Center area with dealer cam and player controls */}
                                        <div className="flex flex-1 flex-col items-center gap-3">
                                            {/* Dealer Camera with Community Cards Overlay */}
                                            <DealerCamera
                                                communityCards={communityCards}
                                                potTotal={totalPot}
                                                gameStatus={state}
                                                activePlayerName={activePlayerName}
                                                winningCards={allWinningCards}
                                                dealerUserId={snapshot?.table?.dealerId ?? undefined}
                                                blinds={snapshot?.blinds ?? undefined}
                                                isDealer={isDealerRole}
                                                isJoinable={snapshot?.isJoinable ?? false}
                                                currentUserSeatId={currentUserSeatId}
                                                bettingActorSeatId={bettingActorSeatId}
                                                isLoading={action.isPending || leaveMutation.isPending || dealerLeaveMutation.isPending}
                                                currentBet={currentSeat?.currentBet ?? 0}
                                                playerBalance={currentSeat?.buyIn ?? 0}
                                                bigBlind={snapshot?.game?.effectiveBigBlind}
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
                                                onLeaveTable={() => {
                                                    if (session?.user?.role === 'dealer') {
                                                        dealerLeaveMutation.mutate({ tableId: id! });
                                                    } else {
                                                        leaveMutation.mutate({ tableId: id! });
                                                    }
                                                }}
                                                isLeaving={leaveMutation.isPending || dealerLeaveMutation.isPending}
                                            />

                                            {/* Hand area: flex layout with centered camera and quick actions */}
                                            <div className="flex w-full items-start gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <EventFeed events={events} seats={originalSeats as any} />
                                                </div>
                                                <div className="flex gap-3 items-center">
                                                    <HandCamera
                                                        tableId={tableIdStr}
                                                        roomName={handRoomName}
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0 h-full">
                                                    {currentSeat && (
                                                        <QuickActions
                                                            value={quickAction}
                                                            onChange={setQuickAction}
                                                            disabled={bettingActorSeatId === currentSeat.id}
                                                            gameState={state}
                                                            isMyTurn={bettingActorSeatId === currentSeat.id}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right side seats (5, 6, 7, 8) */}
                                        <SeatSection
                                            key={`right-${tableIdStr}`}
                                            seats={seats.slice(4, 8)}
                                            side="right"
                                            {...seatSectionProps}
                                        />
                                    </div>
                                    <TableAnimation
                                        seats={originalSeats}
                                        gameState={state ?? ''}
                                    />
                                </>
                            }
                            mobileContent={{
                                dealer: (
                                    <div className="h-full w-full flex items-center justify-center p-2">
                                        <div className="w-full h-full max-w-full max-h-full flex items-center justify-center">
                                            <DealerCamera
                                                communityCards={communityCards}
                                                potTotal={totalPot}
                                                gameStatus={state}
                                                activePlayerName={activePlayerName}
                                                winningCards={allWinningCards}
                                                dealerUserId={snapshot?.table?.dealerId ?? undefined}
                                                blinds={snapshot?.blinds ?? undefined}
                                                isDealer={isDealerRole}
                                                isJoinable={snapshot?.isJoinable ?? false}
                                                currentUserSeatId={currentUserSeatId}
                                                bettingActorSeatId={bettingActorSeatId}
                                                isLoading={action.isPending || leaveMutation.isPending || dealerLeaveMutation.isPending}
                                                currentBet={currentSeat?.currentBet ?? 0}
                                                playerBalance={currentSeat?.buyIn ?? 0}
                                                bigBlind={snapshot?.game?.effectiveBigBlind}
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
                                                onLeaveTable={() => {
                                                    if (session?.user?.role === 'dealer') {
                                                        dealerLeaveMutation.mutate({ tableId: id! });
                                                    } else {
                                                        leaveMutation.mutate({ tableId: id! });
                                                    }
                                                }}
                                                isLeaving={leaveMutation.isPending || dealerLeaveMutation.isPending}
                                                hidePlayerBettingControls={true}
                                            />
                                        </div>
                                    </div>
                                ),
                                betting: (
                                    <MobileBettingView
                                        seats={seats}
                                        seatSectionProps={seatSectionProps}
                                        tableId={tableIdStr}
                                        gameState={state}
                                        communityCards={communityCards}
                                        winningCards={allWinningCards}
                                        totalPot={totalPot}
                                        currentSeat={currentSeat ?? null}
                                        currentUserSeatId={currentUserSeatId}
                                        bettingActorSeatId={bettingActorSeatId}
                                        handRoomName={handRoomName}
                                        effectiveBigBlind={snapshot?.game?.effectiveBigBlind}
                                        maxBet={maxBet}
                                        quickAction={quickAction}
                                        onQuickActionChange={setQuickAction}
                                        onAction={(actionType, params) => {
                                            action.mutate({ tableId: id!, action: actionType as any, params });
                                        }}
                                    />
                                ),
                            }}
                        />
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
            {/* <MediaPermissionsModal isPlayer={isPlayer ?? false} /> */}
        </>
    );
}
