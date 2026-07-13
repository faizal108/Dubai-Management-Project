import React, { forwardRef } from "react";
import { cn } from "./cn";

const Textarea = forwardRef(function Textarea(
  { className, rows = 4, error, ...rest },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
        "text-foreground placeholder:text-muted-foreground shadow-soft",
        "transition-colors focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        error && "border-danger focus-visible:ring-danger",
        className
      )}
      {...rest}
    />
  );
});

export default Textarea;
