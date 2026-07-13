import React, { forwardRef } from "react";
import { cn } from "./cn";

export const inputBase =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm " +
  "text-foreground placeholder:text-muted-foreground shadow-soft " +
  "transition-colors focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const Input = forwardRef(function Input(
  { className, type = "text", error, leftIcon, rightIcon, ...rest },
  ref
) {
  if (leftIcon || rightIcon) {
    return (
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          type={type}
          className={cn(
            inputBase,
            leftIcon && "pl-9",
            rightIcon && "pr-9",
            error && "border-danger focus-visible:ring-danger",
            className
          )}
          {...rest}
        />
        {rightIcon && (
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">
            {rightIcon}
          </span>
        )}
      </div>
    );
  }

  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        inputBase,
        error && "border-danger focus-visible:ring-danger",
        className
      )}
      {...rest}
    />
  );
});

export default Input;
