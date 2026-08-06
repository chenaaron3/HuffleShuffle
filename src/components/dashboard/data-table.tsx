import { Fragment, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  totalCount: number;
  pagination: PaginationState;
  onPaginationChange: (pagination: PaginationState) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  renderSubRow?: (row: TData) => ReactNode;
  isRowExpanded?: (row: TData) => boolean;
}

export function DataTable<TData>({
  columns,
  data,
  totalCount,
  pagination,
  onPaginationChange,
  isLoading = false,
  emptyMessage = "No results.",
  renderSubRow,
  isRowExpanded,
}: DataTableProps<TData>) {
  const pageCount = Math.max(1, Math.ceil(totalCount / pagination.pageSize));
  const pageIndex = pagination.pageIndex;
  const rangeStart = totalCount === 0 ? 0 : pageIndex * pagination.pageSize + 1;
  const rangeEnd = Math.min(totalCount, (pageIndex + 1) * pagination.pageSize);

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: { pagination },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(pagination) : updater;
      onPaginationChange(next);
    },
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-zinc-900/80">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 font-medium text-zinc-300"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-zinc-400"
                >
                  Loading…
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-zinc-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <tr
                    className={cn(
                      "border-b border-white/5 hover:bg-white/5",
                      isRowExpanded?.(row.original) && "bg-white/5",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-zinc-200">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                  {renderSubRow && isRowExpanded?.(row.original) ? (
                    <tr className="border-b border-white/5">
                      <td colSpan={columns.length} className="px-4 py-3">
                        {renderSubRow(row.original)}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-400">
          {totalCount === 0
            ? "0 results"
            : `${rangeStart}–${rangeEnd} of ${totalCount}`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage() || isLoading}
            className="border-white/10 bg-transparent text-white hover:bg-white/10"
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <span className="text-sm text-zinc-400">
            Page {pageIndex + 1} of {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage() || isLoading}
            className="border-white/10 bg-transparent text-white hover:bg-white/10"
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export { formatDateTime };
