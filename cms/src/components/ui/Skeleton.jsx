import React from "react";
import { cn } from "./cn";

export default function Skeleton({ className, ...rest }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...rest}
    />
  );
}
