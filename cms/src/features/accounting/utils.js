// src/features/accounting/utils.js
// Shared formatting helpers for the accounting workspace.

export const formatAmount = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return v ?? "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Compact display in Indian numbering (Cr / L / K). Used on stat tiles where
// a raw ₹ figure would overflow.
export const formatCompact = (value) => {
  const n = Number(value) || 0;
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(2)} L`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)} K`;
  return n.toFixed(2);
};

export const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
};

export const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

// Turn a browser <input type=date> value into an ISO timestamp for the API.
// Empty inputs collapse to undefined so withQuery drops the key.
export const toIsoDate = (v) => (v ? new Date(v).toISOString() : undefined);
