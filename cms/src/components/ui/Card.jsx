import React from "react";
import { cn } from "./cn";

export function Card({ className, children, ...rest }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground shadow-card",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...rest }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-b border-border px-6 py-4",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...rest }) {
  return (
    <h3
      className={cn(
        "text-base font-semibold leading-tight tracking-tight text-foreground",
        className
      )}
      {...rest}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...rest }) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...rest}>
      {children}
    </p>
  );
}

export function CardBody({ className, children, ...rest }) {
  return (
    <div className={cn("px-6 py-5", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...rest }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-t border-border px-6 py-4",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export default Card;
