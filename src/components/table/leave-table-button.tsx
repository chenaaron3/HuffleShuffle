import { useRouter } from 'next/router';
import { useIsDealerRole, useIsHandInProgress, useIsJoinable, useTableId } from '~/hooks/use-table-selectors';
import { cn } from '~/lib/utils';
import { api } from '~/utils/api';

interface LeaveTableButtonProps {
    compact?: boolean;
}

export function LeaveTableButton({ compact = false }: LeaveTableButtonProps) {
    const router = useRouter();
    const isDealerRole = useIsDealerRole();
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
        if (isDealerRole) {
            dealerLeaveMutation.mutate({ tableId });
        } else {
            leaveMutation.mutate({ tableId });
        }
    };

    if (isDealerRole ? isHandInProgress : !isJoinable) {
        return null;
    }

    return (
        <div className={compact ? undefined : 'absolute bottom-4 left-4'}>
            <button
                onClick={handleLeaveTable}
                disabled={isLeaving}
                className={cn(
                    'transition-all duration-200 hover:scale-105 shadow-lg bg-red-600/90 text-white font-semibold border border-red-500/50 backdrop-blur',
                    compact ? 'rounded-md px-2 py-1 text-xs' : 'rounded-lg px-4 py-2',
                )}
            >
                {isLeaving ? 'Leaving...' : compact ? 'Leave' : 'Leave Table'}
            </button>
        </div>
    );
}

