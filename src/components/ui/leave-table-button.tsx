import { useRouter } from 'next/router';
import { useIsDealerRole, useIsJoinable, useTableId } from '~/hooks/use-table-selectors';
import { api } from '~/utils/api';

export function LeaveTableButton() {
    const router = useRouter();
    const isDealerRole = useIsDealerRole();
    const tableId = useTableId();
    const isJoinable = useIsJoinable();

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
        if (!tableId) {
            console.error('Cannot leave table: tableId is missing');
            return;
        }
        if (isDealerRole) {
            dealerLeaveMutation.mutate({ tableId });
        } else {
            leaveMutation.mutate({ tableId });
        }
    };

    if (!isJoinable) {
        return null;
    }

    return (
        <div className="absolute bottom-4 left-4">
            <button
                onClick={handleLeaveTable}
                disabled={isLeaving}
                className="transition-all duration-200 hover:scale-105 shadow-lg bg-red-600/90 text-white font-semibold px-4 py-2 rounded-lg border border-red-500/50 backdrop-blur"
            >
                {isLeaving ? 'Leaving...' : 'Leave Table'}
            </button>
        </div>
    );
}

