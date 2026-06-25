// src/features/audits/pages/AuditLog.jsx
// SUPERADMIN-only audit trail viewer. Server-side paginated with filter bar
// and expandable rows that render before/after JSON snapshots side by side.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronRightIcon as ChevronCollapsedIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

import { listAudits } from "../api";
import { listFoundations } from "../../foundations/api";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  Select,
  Spinner,
} from "../../../components/ui";

const ACTIONS = ["CREATE", "UPDATE", "DELETE", "RESTORE", "LOGIN", "LOGOUT"];
const ENTITIES = ["Foundation", "User", "Donor", "Donation"];
const PAGE_SIZE = 20;

// Maps an audit action to a Badge variant for consistent semantic coloring.
const ACTION_VARIANT = {
  CREATE: "success",
  UPDATE: "primary",
  DELETE: "danger",
  RESTORE: "warning",
  LOGIN: "default",
  LOGOUT: "default",
};

const formatDateTime = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

// Pretty JSON viewer. Falls back to em-dash when the snapshot is empty.
const JsonBlock = ({ value }) => {
  if (value === null || value === undefined) {
    return <div className="italic text-muted-foreground">—</div>;
  }
  return (
    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-muted/40 p-3 text-xs text-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
};

const AuditLog = () => {
  // Filters.
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [entityId, setEntityId] = useState("");
  const [foundationId, setFoundationId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // List state.
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isFetching, setIsFetching] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());

  // Foundations list for the picker.
  const [foundations, setFoundations] = useState([]);

  const dq = useDebounced(q);
  const dEntityId = useDebounced(entityId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listFoundations({ page: 1, pageSize: 100 });
        if (!cancelled) setFoundations(res?.items ?? []);
      } catch (err) {
        console.error("Load foundations error:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchList = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await listAudits({
        page,
        pageSize: PAGE_SIZE,
        q: dq.trim() || undefined,
        action: action || undefined,
        entity: entity || undefined,
        entityId: dEntityId.trim() || undefined,
        foundationId: foundationId || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
      });
      setItems(res?.items ?? []);
      setTotal(res?.total ?? 0);
      setTotalPages(res?.totalPages ?? 1);
    } catch (err) {
      console.error("Fetch audits error:", err);
    } finally {
      setIsFetching(false);
    }
  }, [page, dq, action, entity, dEntityId, foundationId, from, to]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Reset to page 1 whenever any filter changes.
  useEffect(() => {
    setPage(1);
  }, [dq, action, entity, dEntityId, foundationId, from, to]);

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setQ("");
    setAction("");
    setEntity("");
    setEntityId("");
    setFoundationId("");
    setFrom("");
    setTo("");
  };

  const hasFilters = useMemo(
    () =>
      Boolean(q || action || entity || entityId || foundationId || from || to),
    [q, action, entity, entityId, foundationId, from, to]
  );

  const actionOptions = [
    { value: "", label: "All actions" },
    ...ACTIONS.map((a) => ({ value: a, label: a })),
  ];
  const entityOptions = [
    { value: "", label: "All entities" },
    ...ENTITIES.map((e) => ({ value: e, label: e })),
  ];
  const foundationOptions = [
    { value: "", label: "All foundations" },
    ...foundations.map((f) => ({ value: f.id, label: f.name })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        subtitle="Immutable trail of administrative actions across the platform."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchList}
            disabled={isFetching}
            leftIcon={
              <ArrowPathIcon
                className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
            }
          >
            {isFetching ? "Loading…" : "Refresh"}
          </Button>
        }
      />

      {/* Filter bar */}
      <Card>
        <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Search">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="entity or id"
            />
          </FormField>
          <FormField label="Action">
            <Select
              value={action}
              onChange={(v) => setAction(v)}
              options={actionOptions}
              placeholder="All actions"
            />
          </FormField>
          <FormField label="Entity">
            <Select
              value={entity}
              onChange={(v) => setEntity(v)}
              options={entityOptions}
              placeholder="All entities"
            />
          </FormField>
          <FormField label="Entity ID">
            <Input
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder="exact id"
            />
          </FormField>
          <FormField label="Foundation">
            <Select
              value={foundationId}
              onChange={(v) => setFoundationId(v)}
              options={foundationOptions}
              placeholder="All foundations"
            />
          </FormField>
          <FormField label="From">
            <Input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </FormField>
          <FormField label="To">
            <Input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </FormField>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="w-full"
            >
              Clear filters
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Table */}
      <Card className="relative overflow-hidden">
        {isFetching && items.length > 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/70 backdrop-blur-sm">
            <Spinner size="lg" />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-8 px-3 py-3"></th>
                <th className="px-3 py-3 text-left">When</th>
                <th className="px-3 py-3 text-left">Actor</th>
                <th className="px-3 py-3 text-left">Action</th>
                <th className="px-3 py-3 text-left">Entity</th>
                <th className="px-3 py-3 text-left">Entity ID</th>
                <th className="px-3 py-3 text-left">Foundation</th>
              </tr>
            </thead>
            <tbody>
              {isFetching && items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center">
                    <div className="flex justify-center">
                      <Spinner size="lg" />
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10">
                    <EmptyState
                      title="No audit entries"
                      description="No entries match the current filters. Adjust filters and try again."
                    />
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const isOpen = expanded.has(row.id);
                  return (
                    <React.Fragment key={row.id}>
                      <tr className="border-t border-border hover:bg-muted/40">
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => toggleExpand(row.id)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={isOpen ? "Collapse" : "Expand"}
                          >
                            {isOpen ? (
                              <ChevronDownIcon className="h-4 w-4" />
                            ) : (
                              <ChevronCollapsedIcon className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-foreground">
                          {formatDateTime(row.createdAt)}
                        </td>
                        <td className="px-3 py-2.5 text-foreground">
                          {row.actor?.fullName ||
                            row.actor?.email ||
                            row.actor?.username ||
                            row.actorId ||
                            "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge
                            variant={ACTION_VARIANT[row.action] || "default"}
                          >
                            {row.action}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-foreground">
                          {row.entity}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                          {row.entityId ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-foreground">
                          {row.foundationName ?? "—"}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-muted/30">
                          <td></td>
                          <td colSpan={6} className="px-3 py-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div>
                                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Before
                                </div>
                                <JsonBlock value={row.before} />
                              </div>
                              <div>
                                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  After
                                </div>
                                <JsonBlock value={row.after} />
                              </div>
                            </div>
                            {(row.ipAddress || row.userAgent) && (
                              <div className="mt-3 space-y-0.5 text-xs text-muted-foreground">
                                {row.ipAddress && (
                                  <div>
                                    <span className="font-semibold text-foreground">
                                      IP:
                                    </span>{" "}
                                    {row.ipAddress}
                                  </div>
                                )}
                                {row.userAgent && (
                                  <div className="truncate">
                                    <span className="font-semibold text-foreground">
                                      UA:
                                    </span>{" "}
                                    {row.userAgent}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <div>
            {total === 0
              ? "0 entries"
              : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(
                  page * PAGE_SIZE,
                  total
                )} of ${total}`}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isFetching}
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <span>
              Page {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isFetching}
              aria-label="Next page"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AuditLog;
