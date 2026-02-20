import { useTableQuery } from "~/hooks/use-table-query";
import { useTableId } from "~/hooks/use-table-selectors";
import { api } from "~/utils/api";

type TableAction =
  | "START_GAME"
  | "DEAL_CARD"
  | "RESET_TABLE"
  | "RAISE"
  | "FOLD"
  | "CHECK"
  | "DEAL_RANDOM"
  | "VOLUNTEER_SHOW";

interface MutateOptions {
  onSuccess?: () => void;
}

/**
 * Hook that provides a mutation function for table actions.
 * Handles onSuccess/onError internally and updates the Zustand store.
 *
 * @returns The action mutation with mutate function and loading state
 */
export function useActions() {
  const tableId = useTableId();
  const tableQuery = useTableQuery(tableId);
  const updateSnapshot = tableQuery.updateSnapshot;

  const actionMutation = api.table.action.useMutation({
    onSuccess: (data) => {
      if (data) {
        updateSnapshot(data);
      }
    },
    onError: (error) => {
      console.error("Action failed:", error);
    },
  });

  return {
    mutate: (action: TableAction, params?: any, options?: MutateOptions) => {
      actionMutation.mutate(
        { tableId, action, params },
        { onSuccess: options?.onSuccess },
      );
    },
    isPending: actionMutation.isPending,
  };
}
