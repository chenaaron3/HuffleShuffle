import { type ColumnDef, type PaginationState } from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable, formatDateTime } from "~/components/dashboard/data-table";
import { DASHBOARD_PAGE_SIZE } from "~/components/dashboard/constants";
import { api } from "~/utils/api";

type GameRow = {
  id: string;
  createdAt: Date;
  state: string;
  potTotal: number;
  communityCards: string[];
};

interface HandsTabProps {
  pagination: PaginationState;
  onPaginationChange: (pagination: PaginationState) => void;
}

function GameEventsSubRow({ gameId }: { gameId: string }) {
  const { data, isLoading } = api.dashboard.listGameEvents.useQuery({ gameId });

  if (isLoading) {
    return <p className="text-sm text-zinc-400">Loading events…</p>;
  }

  if (!data?.events.length) {
    return <p className="text-sm text-zinc-400">No events recorded.</p>;
  }

  return (
    <ul className="space-y-1 border-l border-white/10 pl-4">
      {data.events.map((event) => (
        <li key={event.id} className="text-sm text-zinc-300">
          <span className="font-medium text-white">{event.type}</span>
          <span className="mx-2 text-zinc-500">·</span>
          <span className="text-zinc-400">{formatDateTime(event.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}

export function HandsTab({ pagination, onPaginationChange }: HandsTabProps) {
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const page = pagination.pageIndex + 1;
  const { data, isLoading } = api.dashboard.listGames.useQuery({
    page,
    pageSize: DASHBOARD_PAGE_SIZE,
  });

  const columns = useMemo<ColumnDef<GameRow>[]>(
    () => [
      {
        id: "expand",
        header: "",
        cell: ({ row }) => {
          const isExpanded = expandedGameId === row.original.id;
          return (
            <button
              type="button"
              aria-label={isExpanded ? "Collapse game events" : "Expand game events"}
              onClick={() =>
                setExpandedGameId(isExpanded ? null : row.original.id)
              }
              className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              {isExpanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ getValue }) => formatDateTime(getValue<Date>()),
      },
      { accessorKey: "state", header: "State" },
      {
        accessorKey: "potTotal",
        header: "Pot",
        cell: ({ getValue }) => getValue<number>().toLocaleString(),
      },
      {
        accessorKey: "communityCards",
        header: "Community cards",
        cell: ({ getValue }) => {
          const cards = getValue<string[]>();
          return cards.length > 0 ? cards.join(" ") : "—";
        },
      },
      {
        accessorKey: "id",
        header: "Game ID",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-zinc-400">{getValue<string>()}</span>
        ),
      },
    ],
    [expandedGameId],
  );

  return (
    <DataTable
      columns={columns}
      data={data?.rows ?? []}
      totalCount={data?.totalCount ?? 0}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      isLoading={isLoading}
      emptyMessage="No games found."
      isRowExpanded={(row) => expandedGameId === row.id}
      renderSubRow={(row) => <GameEventsSubRow gameId={row.id} />}
    />
  );
}
