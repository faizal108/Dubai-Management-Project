// Reusable client-side data table.
//
// Features:
//   • Global search across all "searchable" columns
//   • Sortable headers (click to toggle asc → desc → none)
//   • Pagination with selectable page size
//   • Optional row selection with bulk-action bar
//   • Column visibility menu
//   • CSV export of the current (filtered + sorted) dataset
//
// This is intentionally client-side: the consumer passes the full `data`
// array and column configs, and the table handles UI. Existing server-side
// paged screens (DonationReport, ManageAdmins, …) keep their custom logic.
//
// Column config:
//   {
//     key: "name",
//     header: "Name",
//     accessor: (row) => row.name,   // for sort/search/CSV. Defaults to row[key].
//     cell:     (row) => <span>…</span>, // custom JSX. Defaults to accessor.
//     sortable: true,
//     searchable: true,
//     exportable: true,              // include in CSV. Defaults to true.
//     align: "left" | "right" | "center",
//     className: "w-32",             // applied to <th> and <td>
//   }

import React, { useMemo, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowDownTrayIcon,
  AdjustmentsHorizontalIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { Menu, Transition } from "@headlessui/react";
import Button from "./Button";
import Input from "./Input";
import Select from "./Select";
import Spinner from "./Spinner";
import { cn } from "./cn";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const getValue = (col, row) =>
  col.accessor ? col.accessor(row) : row?.[col.key];

const escapeCsv = (val) => {
  if (val === null || val === undefined) return "";
  const s = String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const downloadCsv = (filename, rows) => {
  const blob = new Blob(["\uFEFF" + rows.map((r) => r.join(",")).join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export default function PowerTable({
  data = [],
  columns = [],
  pageSize: initialPageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  selectable = false,
  rowKey = "id",
  bulkActions = [],
  onSelectionChange,
  exportFileName = "export",
  enableCsvExport = true,
  enableColumnToggle = true,
  enableSearch = true,
  searchPlaceholder = "Search…",
  emptyMessage = "No records to display.",
  isLoading = false,
  toolbarSlot,
  className,
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ key: null, dir: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [selected, setSelected] = useState(() => new Set());
  const [hiddenCols, setHiddenCols] = useState(() => new Set());

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenCols.has(c.key)),
    [columns, hiddenCols]
  );

  // 1) Filter
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.trim().toLowerCase();
    const searchableCols = columns.filter((c) => c.searchable);
    if (searchableCols.length === 0) return data;
    return data.filter((row) =>
      searchableCols.some((col) => {
        const v = getValue(col, row);
        return v != null && String(v).toLowerCase().includes(q);
      })
    );
  }, [data, columns, search]);

  // 2) Sort
  const sorted = useMemo(() => {
    if (!sort.key || !sort.dir) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = getValue(col, a);
      const bv = getValue(col, b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv), undefined, { numeric: true });
    });
    if (sort.dir === "desc") copy.reverse();
    return copy;
  }, [filtered, sort, columns]);

  // 3) Paginate
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, safePage, pageSize]);

  const toggleSort = (col) => {
    if (!col.sortable) return;
    setSort((prev) => {
      if (prev.key !== col.key) return { key: col.key, dir: "asc" };
      if (prev.dir === "asc") return { key: col.key, dir: "desc" };
      return { key: null, dir: null };
    });
  };

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r[rowKey]));

  const togglePageSelection = () => {
    const next = new Set(selected);
    if (allOnPageSelected) pageRows.forEach((r) => next.delete(r[rowKey]));
    else pageRows.forEach((r) => next.add(r[rowKey]));
    setSelected(next);
    onSelectionChange?.(Array.from(next));
  };

  const toggleRow = (row) => {
    const next = new Set(selected);
    const k = row[rowKey];
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setSelected(next);
    onSelectionChange?.(Array.from(next));
  };

  const selectedRows = useMemo(
    () => data.filter((r) => selected.has(r[rowKey])),
    [data, selected, rowKey]
  );

  const clearSelection = () => {
    setSelected(new Set());
    onSelectionChange?.([]);
  };

  const handleExportCsv = () => {
    const exportCols = columns.filter((c) => c.exportable !== false);
    const header = exportCols.map((c) => escapeCsv(c.header));
    const rows = sorted.map((row) =>
      exportCols.map((c) => escapeCsv(getValue(c, row)))
    );
    downloadCsv(`${exportFileName}.csv`, [header, ...rows]);
  };

  const alignClass = (col) =>
    col.align === "right"
      ? "text-right"
      : col.align === "center"
      ? "text-center"
      : "text-left";

  return (
    <div className={cn("space-y-3", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {enableSearch && (
            <Input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={searchPlaceholder}
              leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
              className="w-64"
            />
          )}
          {toolbarSlot}
        </div>
        <div className="flex items-center gap-2">
          {enableColumnToggle && (
            <Menu as="div" className="relative">
              <Menu.Button
                as={Button}
                variant="outline"
                size="sm"
                leftIcon={<AdjustmentsHorizontalIcon className="h-4 w-4" />}
              >
                Columns
              </Menu.Button>
              <Transition
                as={React.Fragment}
                enter="transition ease-out duration-100"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 z-30 mt-2 w-56 origin-top-right rounded-md border border-border bg-card p-1 shadow-lg focus:outline-none">
                  {columns.map((col) => (
                    <Menu.Item key={col.key}>
                      {() => (
                        <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted">
                          <input
                            type="checkbox"
                            checked={!hiddenCols.has(col.key)}
                            onChange={() => {
                              const next = new Set(hiddenCols);
                              if (next.has(col.key)) next.delete(col.key);
                              else next.add(col.key);
                              setHiddenCols(next);
                            }}
                            className="h-4 w-4 rounded border-border accent-primary"
                          />
                          {col.header}
                        </label>
                      )}
                    </Menu.Item>
                  ))}
                </Menu.Items>
              </Transition>
            </Menu>
          )}
          {enableCsvExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              leftIcon={<ArrowDownTrayIcon className="h-4 w-4" />}
              disabled={total === 0}
            >
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectable && selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm">
          <span className="font-medium text-primary">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            {bulkActions.map((action) => (
              <Button
                key={action.label}
                variant={action.variant || "outline"}
                size="sm"
                onClick={() => action.onClick(selectedRows, clearSelection)}
                leftIcon={action.icon}
              >
                {action.label}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="relative overflow-hidden rounded-md border border-border">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/70 backdrop-blur-sm">
            <Spinner size="lg" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-foreground">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {selectable && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={togglePageSelection}
                      className="h-4 w-4 rounded border-border accent-primary"
                      aria-label="Select all on page"
                    />
                  </th>
                )}
                {visibleColumns.map((col) => {
                  const isSorted = sort.key === col.key;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      className={cn(
                        "px-4 py-3",
                        alignClass(col),
                        col.sortable && "cursor-pointer select-none",
                        col.className
                      )}
                      onClick={() => toggleSort(col)}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {col.header}
                        {col.sortable && (
                          <span className="text-muted-foreground/70">
                            {isSorted && sort.dir === "asc" ? (
                              <ArrowUpIcon className="h-3.5 w-3.5" />
                            ) : isSorted && sort.dir === "desc" ? (
                              <ArrowDownIcon className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronUpDownIcon className="h-3.5 w-3.5 opacity-60" />
                            )}
                          </span>
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && !isLoading ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => {
                  const k = row[rowKey];
                  const isSelected = selected.has(k);
                  return (
                    <tr
                      key={k}
                      className={cn(
                        "border-t border-border transition-colors",
                        isSelected ? "bg-primary/5" : "hover:bg-muted/40"
                      )}
                    >
                      {selectable && (
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(row)}
                            className="h-4 w-4 rounded border-border accent-primary"
                            aria-label="Select row"
                          />
                        </td>
                      )}
                      {visibleColumns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            "px-4 py-2.5",
                            alignClass(col),
                            col.className
                          )}
                        >
                          {col.cell ? col.cell(row) : getValue(col, row)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <Select
              value={String(pageSize)}
              onChange={(v) => {
                setPageSize(Number(v));
                setPage(1);
              }}
              options={pageSizeOptions.map((n) => ({
                value: String(n),
                label: String(n),
              }))}
              className="w-20"
            />
          </div>
          <span>
            {total === 0
              ? "0 results"
              : `${(safePage - 1) * pageSize + 1}–${Math.min(
                  safePage * pageSize,
                  total
                )} of ${total}`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <span className="min-w-[5rem] text-center">
              Page {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              aria-label="Next page"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
