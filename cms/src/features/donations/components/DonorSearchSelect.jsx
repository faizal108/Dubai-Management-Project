// src/features/donations/components/DonorSearchSelect.jsx
// Combobox-based donor selector for the donation flow. Operators can search
// the foundation's roster by name, PAN, or mobile; results are debounced
// against the list endpoint. Selection is optional — the parent can also
// capture a fresh donor inline (Tier 3 flow) and skip this combobox entirely.

import React, { Fragment, useEffect, useRef, useState } from "react";
import { Combobox, Transition } from "@headlessui/react";
import { ChevronUpDownIcon, CheckIcon } from "@heroicons/react/24/outline";
import { listDonors } from "../../donors/api";
import { FormField, Spinner, inputBase, cn } from "../../../components/ui";

const DonorSearchSelect = ({ donor, onSelect, disabled, fieldError }) => {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const seqRef = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setItems([]);
      setLoading(false);
      return;
    }
    const mySeq = ++seqRef.current;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const page = await listDonors({ q: term, pageSize: 10 });
        if (mySeq !== seqRef.current) return;
        setItems(page?.items ?? []);
      } catch (err) {
        if (mySeq !== seqRef.current) return;
        console.error("Donor search error:", err);
        setItems([]);
      } finally {
        if (mySeq === seqRef.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  // Display prefers fullName; PAN (Tier 1) or phone (Tier 2) drops in as the
  // muted secondary identifier so Tier 3 donors (name-only) still render.
  const displayValue = (d) => {
    if (!d) return "";
    const secondary = d.pan || d.phone;
    return secondary ? `${d.fullName} — ${secondary}` : d.fullName;
  };

  return (
    <div className="md:col-span-2">
      <FormField
        label="Search existing donor"
        error={fieldError}
        hint="Optional — leave blank and enter donor details below to add a new donor."
      >
        <Combobox value={donor || null} onChange={onSelect} disabled={disabled}>
          <div className="relative">
            <Combobox.Input
              className={cn(
                inputBase,
                "pr-10",
                fieldError && "border-danger focus-visible:ring-danger"
              )}
              displayValue={displayValue}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, PAN, or mobile"
              autoComplete="off"
            />
            <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground">
              <ChevronUpDownIcon className="h-4 w-4" />
            </Combobox.Button>
            <Transition
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
              afterLeave={() => setQuery("")}
            >
              <Combobox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card py-1 text-sm text-card-foreground shadow-lg focus:outline-none">
                {loading && (
                  <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground">
                    <Spinner size="xs" />
                    Searching…
                  </div>
                )}
                {!loading && query.trim() === "" && items.length === 0 && (
                  <div className="px-3 py-2 text-muted-foreground">
                    Type a name, PAN, or mobile to search.
                  </div>
                )}
                {!loading && query.trim() !== "" && items.length === 0 && (
                  <div className="px-3 py-2 text-muted-foreground">
                    No donors match “{query}”. Enter details below to add a new donor.
                  </div>
                )}
                {items.map((d) => (
                  <Combobox.Option
                    key={d.id}
                    value={d}
                    className={({ active }) =>
                      cn(
                        "relative cursor-pointer select-none px-3 py-2",
                        active ? "bg-muted text-foreground" : "text-foreground"
                      )
                    }
                  >
                    {({ selected }) => (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {d.fullName}
                          </div>
                          {(d.pan || d.phone) && (
                            <div className="font-mono text-xs text-muted-foreground">
                              {d.pan || d.phone}
                            </div>
                          )}
                        </div>
                        {selected && (
                          <CheckIcon className="h-4 w-4 shrink-0 text-primary" />
                        )}
                      </div>
                    )}
                  </Combobox.Option>
                ))}
              </Combobox.Options>
            </Transition>
          </div>
        </Combobox>
      </FormField>
    </div>
  );
};

export default DonorSearchSelect;
