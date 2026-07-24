// Shared, server-driven data table.
//
// Controlled: the parent owns data + query state (page, pageSize, sort, global
// search, per-column filters) and refetches whenever the table reports a
// change. The table renders the toolbar, sortable headers with per-column
// filter popovers, column visibility, and footer pagination (chevron arrows +
// "Page X of Y").
//
// Everything is opt-in via `enable*` flags so this works as the single table
// for the whole app — from a full server-paginated workspace down to a plain
// static list.
//
// Column config:
//   {
//     key,                         // unique; also the default sort field + filter param
//     header,                      // string | node
//     accessor?: (row) => value,   // default cell value; defaults to row[key]
//     cell?: (row) => node,        // custom cell renderer
//     sortable?: bool,             // clickable header sort (server-side)
//     sortField?: string,          // sort value sent to the API (defaults to key)
//     filter?: {                   // per-column filter popover (funnel icon)
//       type: "text" | "number" | "date" | "select",
//       param?: string,            // query param key (defaults to key)
//       options?: [{ value, label }],  // for type "select"
//       placeholder?: string,
//     },
//     align?: "left" | "right" | "center",
//     className?, width?,          // applied to <th>/<td>
//     hideable?: bool,             // include in the Columns menu (default true)
//   }
//
// Feature flags: enablePagination, enableGlobalSearch, enableColumnFilters,
// enableColumnVisibility (all default true).
//
// Helpers `linkColumn` (redirect column), `selectionColumn` (checkbox column),
// `actionsColumn` (row menu) build common column shapes — see bottom of file.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";
import { Popover } from "@headlessui/react";
import Button from "./Button";
import Input from "./Input";
import Select from "./Select";
import Spinner from "./Spinner";
import EmptyState from "./EmptyState";
import Dropdown, { DropdownItem } from "./Dropdown";
import ColumnsMenu, { useColumnVisibility } from "./ColumnsMenu";
import { cn } from "./cn";

const alignClass = (col) =>
  col.align === "right"
    ? "text-right"
    : col.align === "center"
    ? "text-center"
    : "text-left";

const alignJustify = (col) =>
  col.align === "right"
    ? "justify-end"
    : col.align === "center"
    ? "justify-center"
    : "justify-start";

const getValue = (col, row) =>
  col.accessor ? col.accessor(row) : row?.[col.key];

const PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 100];

export default function DataTable({
  columns = [],
  rows = [],
  rowKey = "id",
  total = 0,
  page = 1,
  pageSize = 20,
  loading = false,
  // sort (controlled): { by, dir } where by is a column.sortField/key
  sort = { by: null, dir: null },
  onSortChange,
  // global search (controlled value, debounced internally on change)
  globalSearch = "",
  onGlobalSearchChange,
  enableGlobalSearch = true,
  searchPlaceholder = "Search…",
  // per-column filters (controlled object keyed by filter param)
  columnFilters = {},
  onColumnFiltersChange,
  enableColumnFilters = true,
  // pagination
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  enablePagination = true,
  // column visibility
  enableColumnVisibility = true,
  defaultHiddenKeys = [],
  // row interaction
  onRowClick,
  rowClassName,
  // slots + misc
  toolbarSlot,
  toolbarEnd,
  emptyTitle = "No records",
  emptyDescription = "Nothing matches the current filters.",
  emptyIcon,
  debounceMs = 350,
  className,
}) {
  const { hidden, toggle } = useColumnVisibility(defaultHiddenKeys);

  const [searchInput, setSearchInput] = useState(globalSearch || "");
  const [filterInputs, setFilterInputs] = useState(columnFilters || {});
  const searchTimer = useRef();
  const filterTimer = useRef();
  const lastPushedSearch = useRef(globalSearch || "");
  const lastPushedFilters = useRef(columnFilters || {});

  const pushSearch = (v) => {
    setSearchInput(v);
    lastPushedSearch.current = v;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => onGlobalSearchChange?.(v), debounceMs);
  };

  const pushFilters = (next, immediate) => {
    setFilterInputs(next);
    lastPushedFilters.current = next;
    clearTimeout(filterTimer.current);
    if (immediate) onColumnFiltersChange?.(next);
    else filterTimer.current = setTimeout(() => onColumnFiltersChange?.(next), debounceMs);
  };

  const setFilterValue = (param, value, immediate) => {
    const next = { ...filterInputs };
    if (value === "" || value === undefined || value === null) delete next[param];
    else next[param] = value;
    pushFilters(next, immediate);
  };

  // Adopt external resets (e.g. a parent "Clear" button) without clobbering
  // live typing — compare against the last value we pushed up.
  useEffect(() => {
    const incoming = globalSearch || "";
    if (incoming !== lastPushedSearch.current) {
      lastPushedSearch.current = incoming;
      setSearchInput(incoming);
    }
  }, [globalSearch]);

  useEffect(() => {
    const incoming = columnFilters || {};
    if (JSON.stringify(incoming) !== JSON.stringify(lastPushedFilters.current)) {
      lastPushedFilters.current = incoming;
      setFilterInputs(incoming);
    }
  }, [columnFilters]);

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hidden.has(c.key)),
    [columns, hidden]
  );
  const hideableColumns = useMemo(
    () => columns.filter((c) => c.hideable !== false && c.header),
    [columns]
  );

  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));
  const fromRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRow = Math.min(page * pageSize, total);

  const cycleSort = (col) => {
    if (!col.sortable || !onSortChange) return;
    const field = col.sortField || col.key;
    if (sort.by !== field) return onSortChange({ by: field, dir: "asc" });
    if (sort.dir === "asc") return onSortChange({ by: field, dir: "desc" });
    return onSortChange({ by: null, dir: null });
  };

  const sortIcon = (col) => {
    const field = col.sortField || col.key;
    if (sort.by !== field)
      return <ChevronUpDownIcon className="h-3.5 w-3.5 opacity-50" />;
    return sort.dir === "asc" ? (
      <ArrowUpIcon className="h-3.5 w-3.5" />
    ) : (
      <ArrowDownIcon className="h-3.5 w-3.5" />
    );
  };

  const colSpan = visibleColumns.length || 1;
  const showColumnsMenu = enableColumnVisibility && hideableColumns.length > 0;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Toolbar */}
      {(enableGlobalSearch || toolbarSlot || toolbarEnd || showColumnsMenu) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {enableGlobalSearch && (
              <Input
                type="search"
                value={searchInput}
                onChange={(e) => pushSearch(e.target.value)}
                placeholder={searchPlaceholder}
                leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
                className="w-full sm:w-72"
              />
            )}
            {toolbarSlot}
          </div>
          <div className="flex items-center gap-2">
            {toolbarEnd}
            {showColumnsMenu && (
              <ColumnsMenu columns={hideableColumns} hidden={hidden} onToggle={toggle} />
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="relative overflow-x-auto rounded-md border border-border">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <Spinner />
          </div>
        )}
        <table className="min-w-full text-left text-sm text-foreground">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {visibleColumns.map((col) => {
                const param = col.filter?.param || col.key;
                const filterActive =
                  col.filter &&
                  filterInputs[param] !== undefined &&
                  filterInputs[param] !== "";
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={col.width ? { width: col.width } : undefined}
                    className={cn("px-4 py-2.5 font-medium", alignClass(col), col.className)}
                  >
                    <div className={cn("flex items-center gap-1", alignJustify(col))}>
                      {col.sortable ? (
                        <button
                          type="button"
                          onClick={() => cycleSort(col)}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          <span>{col.header}</span>
                          <span className="text-muted-foreground/70">{sortIcon(col)}</span>
                        </button>
                      ) : (
                        <span>{col.header}</span>
                      )}
                      {enableColumnFilters && col.filter && (
                        <FilterPopover
                          col={col}
                          param={param}
                          active={filterActive}
                          value={filterInputs[param] ?? ""}
                          onChange={setFilterValue}
                        />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-10 text-center">
                  <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row[rowKey]}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "hover:bg-muted/40",
                    onRowClick && "cursor-pointer",
                    typeof rowClassName === "function" ? rowClassName(row) : rowClassName
                  )}
                >
                  {visibleColumns.map((col) => (
                    <td
                      key={col.key}
                      className={cn("px-4 py-2.5", alignClass(col), col.className)}
                    >
                      {col.cell ? col.cell(row) : getValue(col, row) ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer / pagination */}
      {enablePagination && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Rows:</span>
            <div className="w-20">
              <Select
                value={String(pageSize)}
                onChange={(v) => onPageSizeChange?.(Number(v))}
                options={pageSizeOptions.map((n) => ({ value: String(n), label: String(n) }))}
              />
            </div>
            <span className="ml-1">
              {total === 0 ? "0 results" : `${fromRow}–${toRow} of ${total}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange?.(Math.max(1, page - 1))}
              disabled={page <= 1 || loading}
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <span className="min-w-[6rem] text-center text-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange?.(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages || loading}
              aria-label="Next page"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Funnel-icon filter popover shown on a filterable column header. Keeps the
// header row a fixed height (no inline filter row widening columns). The panel
// is portaled/anchored so it escapes the table's overflow container.
function FilterPopover({ col, param, active, value, onChange }) {
  const label = typeof col.header === "string" ? col.header : "column";
  return (
    <Popover className="relative inline-flex">
      <Popover.Button
        as="button"
        type="button"
        aria-label={`Filter ${label}`}
        className={cn(
          "rounded p-0.5 outline-none transition-colors hover:bg-muted",
          active ? "text-primary" : "text-muted-foreground/50 hover:text-foreground"
        )}
      >
        <FunnelIcon className="h-3.5 w-3.5" />
      </Popover.Button>
      <Popover.Panel
        anchor={{ to: "bottom end", gap: 6 }}
        className="z-50 w-56 rounded-md border border-border bg-card p-2 text-left shadow-lg focus:outline-none"
      >
        {({ close }) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
              {active && (
                <button
                  type="button"
                  onClick={() => onChange(param, "", true)}
                  className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <XMarkIcon className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
            {col.filter.type === "select" ? (
              <div className="max-h-60 overflow-auto">
                {(col.filter.options || []).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(param, opt.value, true);
                      close();
                    }}
                    className={cn(
                      "block w-full rounded px-2 py-1.5 text-left text-sm normal-case hover:bg-muted",
                      String(opt.value) === String(value)
                        ? "font-medium text-primary"
                        : "text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <Input
                autoFocus
                type={
                  col.filter.type === "number"
                    ? "number"
                    : col.filter.type === "date"
                    ? "date"
                    : "search"
                }
                value={value}
                onChange={(e) =>
                  onChange(param, e.target.value, col.filter.type === "date")
                }
                onKeyDown={(e) => e.key === "Enter" && close()}
                placeholder={col.filter.placeholder || `Filter ${label}…`}
                className="h-8 normal-case"
              />
            )}
          </div>
        )}
      </Popover.Panel>
    </Popover>
  );
}

// ── Column helpers ─────────────────────────────────────────────────────────

// A navigate-link cell: renders a react-router <Link>.
export function linkColumn({ to, text, ...col }) {
  return {
    ...col,
    cell: (row) => (
      <Link
        to={typeof to === "function" ? to(row) : to}
        className="font-medium text-primary hover:underline"
      >
        {typeof text === "function" ? text(row) : text ?? getValue(col, row)}
      </Link>
    ),
  };
}

// A selection checkbox column. Parent owns the selected set + toggles so it can
// keep records across pages (see SearchDonation).
export function selectionColumn({
  isSelected,
  onToggleRow,
  pageRows = [],
  allSelected = false,
  onToggleAll,
  disabled = false,
}) {
  return {
    key: "_select",
    hideable: false,
    width: "2.5rem",
    header: (
      <input
        type="checkbox"
        checked={allSelected}
        onChange={(e) => onToggleAll?.(pageRows, e.target.checked)}
        disabled={disabled || pageRows.length === 0}
        aria-label="Select all rows on this page"
        className="h-4 w-4 rounded border-border accent-primary"
      />
    ),
    cell: (row) => (
      <input
        type="checkbox"
        checked={isSelected(row)}
        onChange={() => onToggleRow(row)}
        onClick={(e) => e.stopPropagation()}
        disabled={disabled}
        aria-label="Select row"
        className="h-4 w-4 rounded border-border accent-primary"
      />
    ),
  };
}

// An actions column: renders a three-dots dropdown from `items(row)` where each
// item is { label, icon?, onClick, danger?, disabled?, hidden? }.
export function actionsColumn({ header = "", items, width = "4rem", ...col }) {
  return {
    key: "_actions",
    hideable: false,
    header,
    align: "right",
    width,
    ...col,
    cell: (row) => {
      const list = (items(row) || []).filter((it) => it && !it.hidden);
      if (list.length === 0) return null;
      return (
        <Dropdown
          trigger={
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Row actions"
            >
              <span className="text-lg leading-none">⋮</span>
            </button>
          }
        >
          {list.map((it, i) => (
            <DropdownItem
              key={it.key || it.label || i}
              onClick={it.onClick}
              disabled={it.disabled}
              danger={it.danger}
              icon={it.icon}
            >
              {it.label}
            </DropdownItem>
          ))}
        </Dropdown>
      );
    },
  };
}
