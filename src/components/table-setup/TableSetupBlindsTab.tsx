import * as React from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
    Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle
} from '~/components/ui/card';
import { api } from '~/utils/api';

function formatDuration(seconds: number): string {
    const value = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const secs = value % 60;
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
    return parts.join(' ');
}

interface TableSetupBlindsTabProps {
    tableId: string;
    isOpen: boolean;
    isActive: boolean;
}

export function TableSetupBlindsTab({ tableId, isOpen, isActive }: TableSetupBlindsTabProps) {
    const tableQuery = api.table.get.useQuery({ tableId }, { enabled: isOpen });

    const startBlindTimerMut = api.blinds.start.useMutation({
        onSuccess: () => {
            void tableQuery.refetch();
        },
    });
    const resetBlindTimerMut = api.blinds.reset.useMutation({
        onSuccess: () => {
            void tableQuery.refetch();
        },
    });
    const setBlindStepMut = api.blinds.setInterval.useMutation({
        onSuccess: () => {
            void tableQuery.refetch();
        },
    });

    const blinds = tableQuery.data?.blinds;
    const baseSmallBlind = tableQuery.data?.table?.smallBlind ?? 0;
    const baseBigBlind = tableQuery.data?.table?.bigBlind ?? 0;

    const [stepMinutes, setStepMinutes] = React.useState<string>('10');
    const [tick, setTick] = React.useState(0);

    React.useEffect(() => {
        if (!blinds) return;
        const minutes = blinds.stepSeconds / 60;
        const rounded = minutes % 1 === 0 ? minutes.toFixed(0) : minutes.toFixed(2);
        setStepMinutes(rounded);
    }, [blinds]);

    const isTimerRunning = Boolean(blinds?.startedAt);
    const elapsedSeconds = blinds?.elapsedSeconds ?? 0;
    const stepSeconds = blinds?.stepSeconds ?? 0;

    React.useEffect(() => {
        if (!isTimerRunning) {
            setTick(0);
            return;
        }
        const interval = setInterval(() => {
            setTick((prev) => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [isTimerRunning]);

    const liveElapsedSeconds = isTimerRunning ? elapsedSeconds + tick : elapsedSeconds;

    let secondsUntilNextIncrease: number | null = null;
    if (isTimerRunning && stepSeconds > 0) {
        const remainder = liveElapsedSeconds % stepSeconds;
        secondsUntilNextIncrease = remainder === 0 ? stepSeconds : stepSeconds - remainder;
    }

    const progressPercent =
        isTimerRunning && stepSeconds > 0 && secondsUntilNextIncrease !== null
            ? Math.min(
                100,
                Math.floor(((stepSeconds - secondsUntilNextIncrease) / stepSeconds) * 100),
            )
            : 0;

    const parsedMinutes = Number(stepMinutes);
    const stepMinutesInvalid = Number.isNaN(parsedMinutes) || parsedMinutes <= 0;

    const effectiveSmallBlind = blinds?.effectiveSmallBlind ?? baseSmallBlind;
    const effectiveBigBlind = blinds?.effectiveBigBlind ?? baseBigBlind;

    const handleIntervalUpdate = React.useCallback(() => {
        if (stepMinutesInvalid) return;
        const seconds = Math.max(1, Math.round(parsedMinutes * 60));
        setBlindStepMut.mutate({ tableId, stepSeconds: seconds });
    }, [parsedMinutes, setBlindStepMut, stepMinutesInvalid, tableId]);

    const anyTimerPending = startBlindTimerMut.isPending || resetBlindTimerMut.isPending;

    if (!isActive) {
        return null;
    }

    return (
        <div className="space-y-4">
            <Card className="border-zinc-700/60 bg-zinc-950/60">
                <CardHeader className="space-y-1">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base text-zinc-100">Blind Timer</CardTitle>
                        <Badge variant={isTimerRunning ? 'secondary' : 'outline'}>
                            {isTimerRunning ? 'Running' : 'Stopped'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm text-zinc-300 md:grid-cols-3">
                    <div className="rounded-md border border-zinc-700/50 bg-zinc-900/60 p-3">
                        <div className="text-xs uppercase tracking-wide text-zinc-500">Multiplier</div>
                        <div className="text-2xl font-semibold text-emerald-300">
                            {blinds?.multiplier ?? 1}×
                        </div>
                    </div>
                    <div className="rounded-md border border-zinc-700/50 bg-zinc-900/60 p-3">
                        <div className="text-xs uppercase tracking-wide text-zinc-500">Small / Big</div>
                        <div className="text-lg font-semibold text-zinc-100">
                            {effectiveSmallBlind} / {effectiveBigBlind}
                        </div>
                    </div>
                    <div className="rounded-md border border-zinc-700/50 bg-zinc-900/60 p-3">
                        <div className="text-xs uppercase tracking-wide text-zinc-500">Elapsed</div>
                        <span className="text-lg font-semibold text-zinc-100">
                            {formatDuration(liveElapsedSeconds)}
                        </span>
                    </div>
                    <div className="md:col-span-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="uppercase tracking-wide text-zinc-500">
                                {isTimerRunning && secondsUntilNextIncrease !== null
                                    ? `Next increase in ${formatDuration(secondsUntilNextIncrease)}`
                                    : 'Timer not running'}
                            </span>
                            {isTimerRunning && progressPercent > 0 && (
                                <span className="text-zinc-400">{progressPercent}%</span>
                            )}
                        </div>
                        {isTimerRunning && stepSeconds > 0 ? (
                            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-1000 ease-out"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        ) : (
                            <div className="h-2 w-full rounded-full bg-zinc-800" />
                        )}
                    </div>
                </CardContent>
                <CardFooter className="flex justify-center">
                    {isTimerRunning ? (
                        <Button
                            variant="destructive"
                            onClick={() => resetBlindTimerMut.mutate({ tableId })}
                            disabled={anyTimerPending}
                            className="w-full max-w-xs bg-red-500 hover:bg-red-400"
                        >
                            {resetBlindTimerMut.isPending ? 'Stopping…' : 'Stop Timer'}
                        </Button>
                    ) : (
                        <Button
                            onClick={() => startBlindTimerMut.mutate({ tableId })}
                            disabled={anyTimerPending}
                            className="w-full max-w-xs bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                        >
                            {startBlindTimerMut.isPending ? 'Starting…' : 'Start Timer'}
                        </Button>
                    )}
                </CardFooter>
            </Card>

            <Card className="border-zinc-700/60 bg-zinc-950/60">
                <CardHeader>
                    <CardTitle className="text-base text-zinc-100">Adjust Interval</CardTitle>
                    <CardDescription>
                        Configure how many minutes each blind level lasts before doubling.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 md:flex-row md:items-end">
                    <div className="flex-1">
                        <label
                            htmlFor="blind-interval"
                            className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-400"
                        >
                            Minutes per level
                        </label>
                        <input
                            id="blind-interval"
                            type="number"
                            min={0.5}
                            step={0.5}
                            value={stepMinutes}
                            onChange={(event) => setStepMinutes(event.target.value)}
                            className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                        />
                        {stepMinutesInvalid && (
                            <p className="mt-1 text-xs text-red-400">Enter a value greater than zero.</p>
                        )}
                    </div>
                    <Button
                        onClick={handleIntervalUpdate}
                        disabled={stepMinutesInvalid || setBlindStepMut.isPending}
                        className="md:w-auto"
                    >
                        {setBlindStepMut.isPending ? 'Updating…' : 'Update Interval'}
                    </Button>
                </CardContent>
                <CardFooter className="text-xs text-zinc-500">
                    Current base blinds: {baseSmallBlind} / {baseBigBlind}. Interval updates take effect
                    immediately.
                </CardFooter>
            </Card>
        </div>
    );
}
