import React from "react";
import { InboxIcon } from "@heroicons/react/24/outline";
import { cn } from "./cn";

export default function EmptyState({
  icon,
  title = "Nothing here yet",
  description,
  action,
  className,
}) {
  const Icon = icon || InboxIcon;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center",
        className
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {React.isValidElement(icon) ? icon : <Icon className="h-6 w-6" />}
      </span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
