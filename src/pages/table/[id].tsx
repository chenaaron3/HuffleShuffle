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
    useBettingActorSeatId, useCurrentSeat, useCurrentUserSeatId, useGameState, useIsDealerRole,
    useMaxBet, useOriginalSeats, usePaddedSeats, useTableSnapshot
} from '~/hooks/use-table-selectors';
import { api } from '~/utils/api';
import { rsaDecryptBase64 } from '~/utils/crypto';
import { disconnectPusherClient, getPusherClient } from '~/utils/pusher-client';
import { SIGNALS } from '~/utils/signal-constants';

import { LiveKitRoom, RoomAudioRenderer, StartAudio } from '@livekit/components-react';

export default function TableView() {
    const router = useRouter();
    const { id } = router.query as { id?: string };
    const { data: session } = useSession();
    const { enabled: backgroundBlurEnabled } = useBackgroundBlur();
    const isDealerRole = useIsDealerRole();

    // Use the hook that manages query and updates store
    const tableQuery = useTableQuery(id);
    const updateSnapshot = tableQuery.updateSnapshot;

    // Early return if no table ID
    if (!id) {
        return (
            <>
                <Head>
                    <title>Table Not Found - HuffleShuffle</title>
                </Head>
                <main className="flex min-h-screen items-center justify-center bg-black text-white">
                    <div className="text-zinc-400">Table not found</div>
                </main>
            </>
        );
    }

    // Early return if table query is loading or has no data
    // This ensures useTableId() will always return a valid string in child components
    if (tableQuery.isLoading || !tableQuery.data?.table?.id) {
        return (
            <>
                <Head>
                    <title>Loading Table - HuffleShuffle</title>
                </Head>
                <main className="flex min-h-screen items-center justify-center bg-black text-white">
                    <div className="text-zinc-400">Loading table...</div>
                </main>
            </>
        );
    }

    const tableIdStr = id;

    const [showSetup, setShowSetup] = React.useState<boolean>(false);

    // Use selector hooks for computed values
    const snapshot = useTableSnapshot();
    const seats = usePaddedSeats(); // For rendering (includes nulls for empty seats)
    const originalSeats = useOriginalSeats(); // For calculations (only actual seats)
    const state = useGameState();
    const bettingActorSeatId = useBettingActorSeatId();
    const currentUserSeatId = useCurrentUserSeatId(session?.user?.id);
    const currentSeat = useCurrentSeat(session?.user?.id);
    const [handRoomName, setHandRoomName] = React.useState<string | null>(null);

    // --- Event feed managed by hook ---
    const { events, refreshEvents: refreshEventFeed } = useTableEvents({ tableId: id });

    // Use selector hooks for computed values
    const maxBet = useMaxBet();

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
                        <AutoBackgroundBlur enabled={!isDealerRole && backgroundBlurEnabled} />
                        <div className="absolute z-10 right-0 flex max-w-7xl items-center gap-3 px-4">
                            <StartAudio label="Enable Audio" />
                            {isDealerRole && (
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
                                            side="left"
                                        />

                                        {/* Center area with dealer cam and player controls */}
                                        <div className="flex flex-1 flex-col items-center gap-3">
                                            {/* Dealer Camera with Community Cards Overlay */}
                                            <DealerCamera />

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
                                            side="right"
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
                                                hidePlayerBettingControls={true}
                                            />
                                        </div>
                                    </div>
                                ),
                                betting: (
                                    <MobileBettingView
                                        handRoomName={handRoomName}
                                        quickAction={quickAction}
                                        onQuickActionChange={setQuickAction}
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
            {isDealerRole && (
                <TableSetupModal tableId={tableIdStr} open={showSetup} onClose={() => setShowSetup(false)} />
            )}
            {/* <MediaPermissionsModal isPlayer={isPlayer ?? false} /> */}
        </>
    );
}
