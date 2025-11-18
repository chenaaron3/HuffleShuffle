import * as React from "react";
import { useTableStore } from "~/stores/table-store";
import { api } from "~/utils/api";

import type { QuickActionType } from "~/components/ui/quick-actions";
import type { SeatWithPlayer } from "~/server/api/routers/table";

interface UseQuickActionsParams {
  tableId: string | undefined;
  currentSeat: SeatWithPlayer | undefined;
  gameState: string | undefined;
  bettingActorSeatId: string | null;
  maxBet: number;
}

/**
 * Hook that manages quick action state and automatically executes actions
 * when it's the player's turn during betting.
 */
export function useQuickActions({
  tableId,
  currentSeat,
  gameState,
  bettingActorSeatId,
  maxBet,
}: UseQuickActionsParams) {
  const [quickAction, setQuickAction] = React.useState<QuickActionType>(null);
  const { setSnapshot } = useTableStore();

  const action = api.table.action.useMutation({
    onSuccess: (data) => {
      // Update store with returned gameplay state
      if (data) {
        setSnapshot(data);
      }
    },
    onError: (error) => {
      console.error("Quick action failed:", error);
    },
  });

  // Execute quick action when it's the player's turn
  React.useEffect(() => {
    if (!quickAction || !currentSeat || gameState !== "BETTING") return;

    const isMyTurn = bettingActorSeatId === currentSeat.id;
    if (!isMyTurn) return;

    const myCurrentBet = currentSeat.currentBet ?? 0;
    const canCheck = myCurrentBet === maxBet;

    // Execute the quick action
    const executeQuickAction = () => {
      if (quickAction === "fold") {
        action.mutate({ tableId: tableId!, action: "FOLD", params: {} });
        setQuickAction(null);
      } else if (quickAction === "check" && canCheck) {
        action.mutate({ tableId: tableId!, action: "CHECK", params: {} });
        setQuickAction(null);
      } else if (quickAction === "check-fold") {
        if (canCheck) {
          action.mutate({ tableId: tableId!, action: "CHECK", params: {} });
        } else {
          action.mutate({ tableId: tableId!, action: "FOLD", params: {} });
        }
        setQuickAction(null);
      }
      // For 'check' when can't check, do nothing (wait for manual action)
    };

    // Small delay to ensure turn has fully started
    const timer = setTimeout(executeQuickAction, 100);
    return () => clearTimeout(timer);
  }, [
    quickAction,
    currentSeat,
    gameState,
    bettingActorSeatId,
    maxBet,
    tableId,
    action,
    setSnapshot,
  ]);

  return {
    quickAction,
    setQuickAction,
    isLoading: action.isPending,
  };
}
