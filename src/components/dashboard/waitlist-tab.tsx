import { type ColumnDef, type PaginationState } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { DataTable, formatDateTime } from "~/components/dashboard/data-table";
import { Button } from "~/components/ui/button";
import { api } from "~/utils/api";

import { DASHBOARD_PAGE_SIZE } from "~/components/dashboard/constants";

type WaitlistRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  instagram: string | null;
  createdAt: Date;
};

interface WaitlistTabProps {
  pagination: PaginationState;
  onPaginationChange: (pagination: PaginationState) => void;
}

const checkboxClassName = "size-4 cursor-pointer accent-white";

export function WaitlistTab({
  pagination,
  onPaginationChange,
}: WaitlistTabProps) {
  const page = pagination.pageIndex + 1;
  const utils = api.useUtils();
  const { data, isLoading } = api.dashboard.listWaitlist.useQuery({
    page,
    pageSize: DASHBOARD_PAGE_SIZE,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  const deleteEntries = api.dashboard.deleteWaitlistEntries.useMutation({
    onSuccess: async () => {
      setSelectedIds(new Set());
      await utils.dashboard.listWaitlist.invalidate();
    },
    onError: (error) => alert(error.message),
  });

  const rows = data?.rows ?? [];
  const allOnPageSelected =
    rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllOnPage = () => {
    setSelectedIds(
      allOnPageSelected ? new Set() : new Set(rows.map((r) => r.id)),
    );
  };

  const columns: ColumnDef<WaitlistRow>[] = [
    {
      id: "select",
      header: () => (
        <input
          type="checkbox"
          aria-label="Select all on this page"
          className={checkboxClassName}
          checked={allOnPageSelected}
          onChange={toggleAllOnPage}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          aria-label={`Select ${row.original.email}`}
          className={checkboxClassName}
          checked={selectedIds.has(row.original.id)}
          onChange={() => toggleRow(row.original.id)}
        />
      ),
    },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "email", header: "Email" },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ getValue }) => getValue<string | null>() ?? "—",
    },
    {
      accessorKey: "instagram",
      header: "Instagram",
      cell: ({ getValue }) => {
        const value = getValue<string | null>();
        return value ? `@${value}` : "—";
      },
    },
    {
      accessorKey: "createdAt",
      header: "Signed up",
      cell: ({ getValue }) => formatDateTime(getValue<Date>()),
    },
  ];

  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-4">
      <div className="flex min-h-9 items-center justify-between gap-4">
        <p className="text-sm text-zinc-400">
          {selectedCount > 0
            ? `${selectedCount} selected`
            : "Select entries to remove spam signups."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={selectedCount === 0 || deleteEntries.isPending}
          onClick={() => {
            const noun = selectedCount === 1 ? "entry" : "entries";
            if (
              !confirm(`Permanently delete ${selectedCount} waitlist ${noun}?`)
            )
              return;
            deleteEntries.mutate({ ids: [...selectedIds] });
          }}
          className="border-red-500/30 bg-transparent text-red-300 hover:bg-red-500/10 hover:text-red-200"
        >
          <Trash2 className="size-4" />
          {deleteEntries.isPending ? "Deleting…" : "Delete selected"}
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        totalCount={data?.totalCount ?? 0}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        isLoading={isLoading}
        emptyMessage="No waitlist entries yet."
      />
    </div>
  );
}
