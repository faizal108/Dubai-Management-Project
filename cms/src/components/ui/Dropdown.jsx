import React, { Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import { Link } from "react-router-dom";
import { cn } from "./cn";

export function Dropdown({ trigger, align = "right", className, children }) {
  // Headless UI v2's `anchor` prop renders Menu.Items in a portal positioned
  // via floating-ui, so the menu escapes the parent table's overflow-auto
  // container instead of expanding it and triggering a scrollbar.
  const anchorTo = align === "left" ? "bottom start" : "bottom end";
  return (
    <Menu as="div" className={cn("inline-block text-left", className)}>
      <Menu.Button as={Fragment}>{trigger}</Menu.Button>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items
          anchor={{ to: anchorTo, gap: 6 }}
          className={cn(
            "z-50 w-56 divide-y divide-border rounded-md border border-border bg-card text-card-foreground shadow-lg focus:outline-none",
            align === "left" ? "origin-top-left" : "origin-top-right"
          )}
        >
          {children}
        </Menu.Items>
      </Transition>
    </Menu>
  );
}

export function DropdownSection({ children, className }) {
  return <div className={cn("py-1", className)}>{children}</div>;
}

export function DropdownItem({
  as,
  to,
  href,
  onClick,
  disabled,
  danger,
  icon,
  children,
  className,
}) {
  const classes = (active) =>
    cn(
      "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
      disabled
        ? "cursor-not-allowed text-muted-foreground/60"
        : danger
        ? active
          ? "bg-danger/10 text-danger"
          : "text-danger"
        : active
        ? "bg-muted text-foreground"
        : "text-foreground",
      className
    );

  return (
    <Menu.Item disabled={disabled}>
      {({ active }) => {
        const inner = (
          <>
            {icon && <span className="h-4 w-4 shrink-0">{icon}</span>}
            <span className="flex-1 text-left">{children}</span>
          </>
        );
        if (to)
          return (
            <Link to={to} className={classes(active)}>
              {inner}
            </Link>
          );
        if (href)
          return (
            <a href={href} className={classes(active)}>
              {inner}
            </a>
          );
        return (
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={classes(active)}
          >
            {inner}
          </button>
        );
      }}
    </Menu.Item>
  );
}

export function DropdownLabel({ children, className }) {
  return (
    <div
      className={cn(
        "px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}

export default Dropdown;
