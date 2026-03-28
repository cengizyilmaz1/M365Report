import { useDeferredValue, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";

interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  searchPlaceholder: string;
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
      <div className="rounded-[1.4rem] border border-ink-900/8 bg-white/90 p-2 shadow-sm">
        <input
          type="search"
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-xl border border-transparent bg-sand-100 px-4 py-3 text-sm text-ink-900 outline-none transition focus:border-sky-400 focus:bg-white"
        />
      </div>
      <div className="overflow-hidden rounded-[1.5rem] border border-ink-900/10 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-900/8 text-left text-sm">
            <thead className="bg-sand-100/90 text-ink-700">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-4 py-3 font-semibold">
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-2"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-ink-900/6">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="align-top transition hover:bg-sand-100/70">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-ink-800">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {table.getRowModel().rows.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-ink-700">No rows match the current filter.</div>
        )}
      </div>
    </div>
  );
}
