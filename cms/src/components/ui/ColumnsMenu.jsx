// Standalone column-visibility menu.
//
// Extracted from PowerTable so pages using a raw <table> can still offer the
// "Columns" toggle. Callers own the hidden-set state and decide how to filter
// their <thead>/<tbody> cells against it.
//
// Usage:
//   const [hidden, setHidden] = useState(() => new Set());
//   const toggle = (key) => setHidden((prev) => {
//     const next = new Set(prev);
//     if (next.has(key)) next.delete(key); else next.add(key);
//     return next;
//   });
//   <ColumnsMenu columns={[{ key: "paidOn", header: "Paid On" }, …]}
//                hidden={hidden} onToggle={toggle} />
//
// `useColumnVisibility(keys)` is a tiny convenience hook that returns
// `{ hidden, toggle, isVisible }` for the common case.

import React, { useCallback, useState } from "react";
import { Menu, Transition } from "@headlessui/react";
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import Button from "./Button";

export function useColumnVisibility(initialHiddenKeys = []) {
  const [hidden, setHidden] = useState(() => new Set(initialHiddenKeys));
  const toggle = useCallback((key) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const isVisible = useCallback((key) => !hidden.has(key), [hidden]);
  return { hidden, toggle, isVisible };
}

export default function ColumnsMenu({
  columns = [],
  hidden,
  onToggle,
  buttonLabel = "Columns",
  size = "sm",
  variant = "outline",
  align = "right",
  className,
}) {
  if (!columns.length) return null;
  const alignClass = align === "left" ? "left-0 origin-top-left" : "right-0 origin-top-right";
  return (
    <Menu as="div" className={`relative ${className || ""}`}>
      <Menu.Button
        as={Button}
        variant={variant}
        size={size}
        leftIcon={<AdjustmentsHorizontalIcon className="h-4 w-4" />}
      >
        {buttonLabel}
      </Menu.Button>
      <Transition
        as={React.Fragment}
        enter="transition ease-out duration-100"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-95"
      >
        <Menu.Items
          className={`absolute ${alignClass} z-30 mt-2 w-56 rounded-md border border-border bg-card p-1 shadow-lg focus:outline-none`}
        >
          {columns.map((col) => (
            <Menu.Item key={col.key}>
              {() => (
                <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={!hidden.has(col.key)}
                    onChange={() => onToggle(col.key)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  {col.header}
                </label>
              )}
            </Menu.Item>
          ))}
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
