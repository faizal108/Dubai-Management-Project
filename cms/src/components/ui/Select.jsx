import React, { Fragment } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { cn } from "./cn";

/**
 * Headless UI-based themed select.
 * options: [{ value, label, disabled?, description? }]
 */
export default function Select({
  value,
  onChange,
  options = [],
  placeholder = "Select…",
  disabled = false,
  error,
  className,
  buttonClassName,
  id,
  name,
}) {
  const selected = options.find((o) => o.value === value) || null;

  return (
    <Listbox value={value} onChange={onChange} disabled={disabled} name={name}>
      <div className={cn("relative", className)}>
        <Listbox.Button
          id={id}
          className={cn(
            "relative flex h-9 w-full items-center justify-between rounded-md border border-input bg-background pl-3 pr-9 text-left text-sm text-foreground shadow-soft",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-danger focus-visible:ring-danger",
            buttonClassName
          )}
        >
          <span
            className={cn(
              "block truncate",
              !selected && "text-muted-foreground"
            )}
          >
            {selected ? selected.label : placeholder}
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronUpDownIcon
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
          </span>
        </Listbox.Button>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-75"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card py-1 text-sm shadow-lg focus:outline-none">
            {options.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No options
              </div>
            )}
            {options.map((opt) => (
              <Listbox.Option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className={({ active, selected: isSel }) =>
                  cn(
                    "relative cursor-pointer select-none py-2 pl-9 pr-3",
                    opt.disabled && "cursor-not-allowed opacity-50",
                    active
                      ? "bg-primary/10 text-primary"
                      : isSel
                      ? "text-primary"
                      : "text-foreground"
                  )
                }
              >
                {({ selected: isSel }) => (
                  <>
                    <span
                      className={cn(
                        "block truncate",
                        isSel ? "font-medium" : "font-normal"
                      )}
                    >
                      {opt.label}
                    </span>
                    {opt.description && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {opt.description}
                      </span>
                    )}
                    {isSel && (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-primary">
                        <CheckIcon className="h-4 w-4" aria-hidden="true" />
                      </span>
                    )}
                  </>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  );
}
