import React, { useId } from "react";
import { cn } from "./cn";

export default function FormField({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}) {
  const auto = useId();
  const id = htmlFor || auto;

  // Inject id + aria-invalid into the first child if it's a single element.
  let control = children;
  if (React.Children.count(children) === 1 && React.isValidElement(children)) {
    control = React.cloneElement(children, {
      id: children.props.id || id,
      "aria-invalid": error ? true : undefined,
      "aria-describedby":
        error || hint ? `${id}-desc` : children.props["aria-describedby"],
    });
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium text-foreground"
        >
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      {control}
      {(error || hint) && (
        <p
          id={`${id}-desc`}
          className={cn(
            "text-xs",
            error ? "text-danger" : "text-muted-foreground"
          )}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}
