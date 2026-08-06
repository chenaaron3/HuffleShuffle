import { type ColumnDef, type PaginationState } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable, formatDateTime } from "~/components/dashboard/data-table";
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

export function WaitlistTab({ pagination, onPaginationChange }: WaitlistTabProps) {
  const page = pagination.pageIndex + 1;
  const { data, isLoading } = api.dashboard.listWaitlist.useQuery({
    page,
    pageSize: DASHBOARD_PAGE_SIZE,
  });

  const columns = useMemo<ColumnDef<WaitlistRow>[]>(
    () => [
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
      emptyMessage="No waitlist entries yet."
    />
  );
}
