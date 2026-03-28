import { useDeferredValue, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import type { ColumnDef, SortDirection } from "@tanstack/react-table";

interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  searchPlaceholder: string;
}

function SortIcon({ direction }: { direction: SortDirection | false }) {
  if (!direction) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
        <path d="M7 15l5 5 5-5" />
        <path d="M7 9l5-5 5 5" />
      </svg>
    );
  }

  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-sky-500">
      {direction === "asc" ? <path d="M7 14l5-5 5 5" /> : <path d="M7 10l5 5 5-5" />}
    </svg>
  );
}

export function DataTable<TData>({ data, columns, searchPlaceholder }: DataTableProps<TData>) {
  const [globalFilter, setGlobalFilter] = useState("");
  const deferredFilter = useDeferredValue(globalFilter);
  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter: deferredFilter
    },
    globalFilterFn: (row, _columnId, filterValue) =>
      JSON.stringify(row.original).toLowerCase().includes(String(filterValue).toLowerCase()),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-500">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <input
          type="search"
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-xl border border-ink-900/8 bg-white/80 py-3 pl-10 pr-4 text-sm text-ink-900 outline-none transition placeholder:text-ink-500 focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-500/10"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink-900/8 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-900/6 text-left text-sm">
            <thead className="bg-sand-50 text-ink-600">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider">
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1.5 transition hover:text-ink-950"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIcon direction={header.column.getIsSorted()} />
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-ink-900/4">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="align-top transition hover:bg-sky-500/[0.02]">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-ink-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {table.getRowModel().rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink-400">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p className="text-sm text-ink-500">No rows match the current filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
