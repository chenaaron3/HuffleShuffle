import { type ColumnDef, type PaginationState } from "@tanstack/react-table";
import { DataTable, formatDateTime } from "~/components/dashboard/data-table";
import { api, type RouterOutputs } from "~/utils/api";

import { DASHBOARD_PAGE_SIZE } from "~/components/dashboard/constants";

type ContactRow = RouterOutputs["dashboard"]["listContacts"]["rows"][number];

interface ContactsTabProps {
  pagination: PaginationState;
  onPaginationChange: (pagination: PaginationState) => void;
}

const PREFERRED_LABELS: Record<ContactRow["preferredContact"], string> = {
  phone: "Text",
  instagram: "Instagram",
  email: "Email",
};

const columns: ColumnDef<ContactRow>[] = [
  {
    id: "player",
    header: "Player",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span>{row.original.displayName}</span>
        {row.original.name && row.original.name !== row.original.displayName ? (
          <span className="text-xs text-zinc-500">{row.original.name}</span>
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: "preferredContact",
    header: "Preferred",
    cell: ({ getValue }) => (
      <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-xs text-amber-200">
        {PREFERRED_LABELS[getValue<ContactRow["preferredContact"]>()]}
      </span>
    ),
  },
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
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ getValue }) => formatDateTime(getValue<string>()),
  },
];

export function ContactsTab({
  pagination,
  onPaginationChange,
}: ContactsTabProps) {
  const { data, isLoading } = api.dashboard.listContacts.useQuery({
    page: pagination.pageIndex + 1,
    pageSize: DASHBOARD_PAGE_SIZE,
  });

  return (
    <DataTable
      columns={columns}
      data={data?.rows ?? []}
      totalCount={data?.totalCount ?? 0}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      isLoading={isLoading}
      emptyMessage="No contacts yet."
    />
  );
}
