import { Loader2, SquareArrowLeft } from 'lucide-react';
import { useRouter } from 'next/router';
import { useIsDealerAtTable, useIsHandInProgress, useIsJoinable, useIsSpectator, useTableId } from '~/hooks/use-table-selectors';
import { cn } from '~/lib/utils';
import { api } from '~/utils/api';

interface LeaveTableButtonProps {
    compact?: boolean;
}

export function LeaveTableButton({ compact = false }: LeaveTableButtonProps) {
    const router = useRouter();
    const isDealerAtTable = useIsDealerAtTable();
    const isSpectator = useIsSpectator();
    const tableId = useTableId();
    const isJoinable = useIsJoinable();
    const isHandInProgress = useIsHandInProgress();

    const leaveMutation = api.table.leave.useMutation({
        onSuccess: () => {
            void router.push('/lobby');
        },
    });

    const dealerLeaveMutation = api.table.dealerLeave.useMutation({
        onSuccess: () => {
            void router.push('/lobby');
        },
    });

    const isLeaving = leaveMutation.isPending || dealerLeaveMutation.isPending;

    const handleLeaveTable = () => {
        if (isSpectator) {
            void router.push('/lobby');
            return;
        }
        if (isDealerAtTable) {
            dealerLeaveMutation.mutate({ tableId });
        } else {
            leaveMutation.mutate({ tableId });
        }
    };

    if (!isSpectator && (isDealerAtTable ? isHandInProgress : !isJoinable)) {
        return null;
    }

    return (
        <button
            onClick={handleLeaveTable}
            disabled={isLeaving}
            aria-label={isLeaving ? 'Leaving table' : 'Leave table'}
            title={isLeaving ? 'Leaving...' : compact ? 'Leave table' : 'Leave Table'}
            className={cn(
                'transition-all duration-200 hover:scale-105 shadow-lg bg-red-600/90 text-white font-semibold border border-red-500/50 backdrop-blur',
                compact
                    ? 'flex h-6 w-6 items-center justify-center rounded-md'
                    : 'rounded-lg px-4 py-2',
            )}
        >
            {compact ? (
                isLeaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                    <SquareArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                )
            ) : isLeaving ? (
                'Leaving...'
            ) : (
                'Leave Table'
            )}
        </button>
    );
}

