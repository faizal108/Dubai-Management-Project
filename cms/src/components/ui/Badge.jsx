import React from "react";
import { cn } from "./cn";

const variants = {
  default: "bg-muted text-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  outline: "border border-border text-foreground",
};

const sizes = {
  sm: "h-5 px-1.5 text-[10px]",
  md: "h-6 px-2 text-xs",
  lg: "h-7 px-2.5 text-sm",
};

export default function Badge({
  variant = "default",
  size = "md",
  className,
  children,
  ...rest
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium uppercase tracking-wide",
        variants[variant] || variants.default,
        sizes[size] || sizes.md,
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
