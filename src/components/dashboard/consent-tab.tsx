import { type ColumnDef, type PaginationState } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable, formatDateTime } from "~/components/dashboard/data-table";
import { DASHBOARD_PAGE_SIZE } from "~/components/dashboard/constants";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

type ConsentRow = {
  id: string;
  displayName: string;
  email: string;
  mediaConsent: boolean;
  mediaConsentUpdatedAt: Date | null;
};

interface ConsentTabProps {
  pagination: PaginationState;
  onPaginationChange: (pagination: PaginationState) => void;
}

function ConsentBadge({ value }: { value: boolean }) {
  return (
    <Badge
      className={cn(
        "rounded-full px-2.5",
        value
          ? "border-green-500/30 bg-green-500/15 text-green-300"
          : "border-white/10 bg-white/5 text-zinc-400",
      )}
    >
      {value ? "Yes" : "No"}
    </Badge>
  );
}

export function ConsentTab({
  pagination,
  onPaginationChange,
}: ConsentTabProps) {
  const page = pagination.pageIndex + 1;
  const utils = api.useUtils();
  const { data, isLoading } = api.dashboard.listConsent.useQuery({
    page,
    pageSize: DASHBOARD_PAGE_SIZE,
  });

  const setConsent = api.dashboard.setConsent.useMutation({
    onSuccess: () => utils.dashboard.listConsent.invalidate(),
    onError: (error) => alert(error.message),
  });

  const columns = useMemo<ColumnDef<ConsentRow>[]>(
    () => [
      { accessorKey: "displayName", header: "Display name" },
      { accessorKey: "email", header: "Email" },
      {
        accessorKey: "mediaConsent",
        header: "Recording & media consent",
        cell: ({ getValue }) => <ConsentBadge value={getValue<boolean>()} />,
      },
      {
        id: "lastChanged",
        header: "Last changed",
        cell: ({ row }) => {
          const { mediaConsent, mediaConsentUpdatedAt } = row.original;
          if (!mediaConsentUpdatedAt) {
            return <span className="text-zinc-500">Never</span>;
          }
          return (
            <span>
              {formatDateTime(mediaConsentUpdatedAt)}
              <span className="ml-2 text-xs text-zinc-500">
                (was {mediaConsent ? "No" : "Yes"})
              </span>
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const { id, mediaConsent, displayName } = row.original;
          const isUpdating =
            setConsent.isPending && setConsent.variables?.userId === id;
          return (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUpdating}
              onClick={() => {
                const next = !mediaConsent;
                const verb = next ? "opt in" : "opt out";
                if (!confirm(`Change ${displayName} to ${verb}?`)) return;
                setConsent.mutate({ userId: id, mediaConsent: next });
              }}
              className="border-white/10 bg-transparent text-white hover:bg-white/10"
            >
              {isUpdating
                ? "Saving…"
                : mediaConsent
                  ? "Set to No"
                  : "Set to Yes"}
            </Button>
          );
        },
      },
    ],
    [setConsent],
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
