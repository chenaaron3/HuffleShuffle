import * as React from "react";
import { useTableStore } from "~/stores/table-store";
import { api } from "~/utils/api";

/**
 * Hook that manages the table query and automatically updates the Zustand store.
 * This hook should be used at the top level of the table page.
 *
 * @param tableId - The table ID to query
 * @returns The table query result with an updateSnapshot method for mutations
 */
export function useTableQuery(tableId: string | undefined) {
  const { setSnapshot } = useTableStore();

  const tableQuery = api.table.get.useQuery(
    { tableId: tableId ?? "" },
    { enabled: !!tableId },
  );

  // Update store when query data changes
  React.useEffect(() => {
    if (tableQuery.data) {
      setSnapshot(tableQuery.data);
    }
  }, [tableQuery.data, setSnapshot]);

  // Clear store when component unmounts or tableId changes
  React.useEffect(() => {
    return () => {
      if (!tableId) {
        setSnapshot(null);
      }
    };
  }, [tableId, setSnapshot]);

  return {
    ...tableQuery,
    // Expose a method to manually update the store (useful for mutations)
    updateSnapshot: setSnapshot,
  };
}
