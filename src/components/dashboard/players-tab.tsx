import { type ColumnDef, type PaginationState } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable } from "~/components/dashboard/data-table";
import { DASHBOARD_PAGE_SIZE } from "~/components/dashboard/constants";
import { api } from "~/utils/api";

type PlayerRow = {
  id: string;
  displayName: string;
  email: string;
  balance: number;
};

interface PlayersTabProps {
  pagination: PaginationState;
  onPaginationChange: (pagination: PaginationState) => void;
}

export function PlayersTab({ pagination, onPaginationChange }: PlayersTabProps) {
  const page = pagination.pageIndex + 1;
  const { data, isLoading } = api.dashboard.listPlayers.useQuery({
    page,
    pageSize: DASHBOARD_PAGE_SIZE,
  });

  const columns = useMemo<ColumnDef<PlayerRow>[]>(
    () => [
      { accessorKey: "displayName", header: "Display name" },
      { accessorKey: "email", header: "Email" },
      {
        accessorKey: "id",
        header: "Player ID",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-zinc-400">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "balance",
        header: "Balance",
        cell: ({ getValue }) => getValue<number>().toLocaleString(),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={data?.rows ?? []}
      totalCount={data?.totalCount ?? 0}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      isLoading={isLoading}
      emptyMessage="No players found."
    />
  );
}
