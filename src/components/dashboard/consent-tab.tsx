import { type ColumnDef, type PaginationState } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable, formatDateTime } from "~/components/dashboard/data-table";
import { DASHBOARD_PAGE_SIZE } from "~/components/dashboard/constants";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

type ConsentKind = "recording" | "socialMedia";

type ConsentRow = {
  id: string;
  displayName: string;
  email: string;
  recordingConsent: boolean;
  recordingConsentUpdatedAt: Date | null;
  socialMediaConsent: boolean | null;
  socialMediaConsentUpdatedAt: Date | null;
};

interface ConsentTabProps {
  pagination: PaginationState;
  onPaginationChange: (pagination: PaginationState) => void;
}

const KIND_LABELS: Record<ConsentKind, string> = {
  recording: "game recording",
  socialMedia: "social media features",
};

function ConsentBadge({ value }: { value: boolean | null }) {
  return (
    <Badge
      className={cn(
        "rounded-full px-2.5",
        value === true && "border-green-500/30 bg-green-500/15 text-green-300",
        value === false && "border-white/10 bg-white/5 text-zinc-300",
        value === null && "border-white/10 bg-transparent text-zinc-500",
      )}
    >
      {value === null ? "Not answered" : value ? "Yes" : "No"}
    </Badge>
  );
}

interface ConsentCellProps {
  row: ConsentRow;
  kind: ConsentKind;
  isUpdating: boolean;
  onChange: (row: ConsentRow, kind: ConsentKind, value: boolean) => void;
}

function ConsentCell({ row, kind, isUpdating, onChange }: ConsentCellProps) {
  const value =
    kind === "recording" ? row.recordingConsent : row.socialMediaConsent;
  const updatedAt =
    kind === "recording"
      ? row.recordingConsentUpdatedAt
      : row.socialMediaConsentUpdatedAt;
  const next = value !== true;

  return (
    <div className="flex items-center gap-3">
      <div className="min-w-28 space-y-1">
        <ConsentBadge value={value} />
        <p className="text-xs text-zinc-500">
          {updatedAt ? `Changed ${formatDateTime(updatedAt)}` : "Never changed"}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isUpdating}
        onClick={() => onChange(row, kind, next)}
        className="border-white/10 bg-transparent text-white hover:bg-white/10"
      >
        {isUpdating ? "Saving…" : next ? "Set to Yes" : "Set to No"}
      </Button>
    </div>
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

  const columns = useMemo<ColumnDef<ConsentRow>[]>(() => {
    const handleChange = (
      row: ConsentRow,
      kind: ConsentKind,
      value: boolean,
    ) => {
      const answer = value ? "Yes" : "No";
      if (!confirm(`Set ${row.displayName}'s ${KIND_LABELS[kind]} consent to ${answer}?`))
        return;
      setConsent.mutate({ userId: row.id, kind, value });
    };
    const isUpdating = (row: ConsentRow, kind: ConsentKind) =>
      setConsent.isPending &&
      setConsent.variables?.userId === row.id &&
      setConsent.variables.kind === kind;

    return [
      { accessorKey: "displayName", header: "Display name" },
      { accessorKey: "email", header: "Email" },
      {
        id: "recording",
        header: "Game recording (required)",
        cell: ({ row }) => (
          <ConsentCell
            row={row.original}
            kind="recording"
            isUpdating={isUpdating(row.original, "recording")}
            onChange={handleChange}
          />
        ),
      },
      {
        id: "socialMedia",
        header: "Social media features",
        cell: ({ row }) => (
          <ConsentCell
            row={row.original}
            kind="socialMedia"
            isUpdating={isUpdating(row.original, "socialMedia")}
            onChange={handleChange}
          />
        ),
      },
    ];
  }, [setConsent]);

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
