import React, { forwardRef } from "react";
import { Link } from "react-router-dom";
import Spinner from "./Spinner";
import { cn } from "./cn";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50";

const variants = {
  primary:
    "bg-primary text-primary-foreground shadow-soft hover:bg-primary-hover",
  secondary:
    "bg-muted text-foreground hover:bg-muted/80",
  outline:
    "border border-border bg-transparent text-foreground hover:bg-muted",
  ghost:
    "bg-transparent text-foreground hover:bg-muted",
  danger:
    "bg-danger text-danger-foreground shadow-soft hover:bg-danger/90",
  success:
    "bg-success text-success-foreground shadow-soft hover:bg-success/90",
  link:
    "bg-transparent text-primary underline-offset-4 hover:underline px-0 h-auto",
};

const sizes = {
  xs: "h-7 px-2 text-xs",
  sm: "h-8 px-3 text-sm",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-5 text-base",
  icon: "h-9 w-9 p-0",
};

const Button = forwardRef(function Button(
  {
    as,
    to,
    href,
    type = "button",
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    className,
    children,
    ...rest
  },
  ref
) {
  const classes = cn(
    base,
    variants[variant] || variants.primary,
    sizes[size] || sizes.md,
    fullWidth && "w-full",
    className
  );

  const content = (
    <>
      {loading ? (
        <Spinner size={size === "lg" ? "md" : "sm"} className="text-current" />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </>
  );

  if (as === "link" || to) {
    return (
      <Link ref={ref} to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }

  if (as === "a" || href) {
    return (
      <a ref={ref} href={href} className={classes} {...rest}>
        {content}
      </a>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={classes}
      {...rest}
    >
      {content}
    </button>
  );
});

export default Button;
