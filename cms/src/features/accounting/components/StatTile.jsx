// src/features/accounting/components/StatTile.jsx
// Compact KPI tile shared across the accounting workspace. Mirrors the Dashboard
// StatCard shape so the two workspaces feel like one product.

import React from "react";
import { Card, CardBody } from "../../../components/ui";
import { formatCompact } from "../utils";

const TONES = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  muted: "bg-muted text-muted-foreground",
};

const StatTile = ({
  title,
  value,
  icon: Icon,
  tone = "primary",
  isCurrency = false,
  hint,
  displayValue,
}) => (
  <Card className="h-full">
    <CardBody className="flex items-center gap-4">
      {Icon && (
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
            TONES[tone] || TONES.primary
          }`}
        >
          <Icon className="h-6 w-6" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-foreground">
          {displayValue ?? `${isCurrency ? "₹" : ""}${formatCompact(value)}`}
        </p>
        {hint ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </CardBody>
  </Card>
);

export default StatTile;
