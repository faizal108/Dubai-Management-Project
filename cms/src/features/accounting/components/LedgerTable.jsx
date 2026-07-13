// src/features/accounting/components/LedgerTable.jsx
// Shared card + raw-table renderer used by the income / expense ledger and
// cash / bank book pages. Column visibility, overlay spinner, pagination
// footer, and empty-state markup all live here so each page only supplies
// its column list and its data fetch.

import React from "react";
import { BanknotesIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  ColumnsMenu,
  EmptyState,
  Spinner,
  useColumnVisibility,
} from "../../../components/ui";

const LedgerTable = ({
  title,
  totalLabel,
  totalAmount,
  totalAmountLabel = "Total",
  columns,
  rows,
  isFetching,
  page,
  totalPages,
  total,
  onPageChange,
  onRefresh,
  emptyTitle = "No entries yet",
  emptyDescription = "Once matching transactions post to the ledger they will appear here.",
  headerExtras,
}) => {
  const { hidden, toggle } = useColumnVisibility();
  const visibleCols = columns.filter((c) => !hidden.has(c.key));

  return (
    <Card className="relative overflow-visible">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-3">
            <CardTitle>{title}</CardTitle>
            {typeof totalAmount === "number" && (
              <span className="text-sm text-muted-foreground">
                {totalAmountLabel}:{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  ₹
                  {totalAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                {totalLabel ? (
                  <span className="ml-1 text-xs">· {totalLabel}</span>
                ) : null}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {headerExtras}
            <ColumnsMenu
              columns={columns.filter((c) => c.header)}
              hidden={hidden}
              onToggle={toggle}
            />
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={isFetching}
                leftIcon={
                  <ArrowPathIcon
                    className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
                  />
                }
              >
                Refresh
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardBody>
        <div className="relative overflow-x-auto">
          {isFetching && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
              <Spinner />
            </div>
          )}
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {visibleCols.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-2.5 font-medium ${
                      col.align === "right" ? "text-right" : ""
                    } ${col.className || ""}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {!isFetching && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={visibleCols.length}
                    className="px-4 py-10 text-center"
                  >
                    <EmptyState
                      icon={BanknotesIcon}
                      title={emptyTitle}
                      description={emptyDescription}
                    />
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/40">
                  {visibleCols.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-2.5 ${
                        col.align === "right" ? "text-right" : ""
                      }`}
                    >
                      {col.cell ? col.cell(row) : row[col.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>

      <CardFooter className="justify-between">
        <span className="text-sm text-muted-foreground">
          Page {page} of {totalPages} · {total} total
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1 || isFetching}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages || isFetching}
          >
            Next
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default LedgerTable;
