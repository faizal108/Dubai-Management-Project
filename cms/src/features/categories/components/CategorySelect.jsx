// src/features/categories/components/CategorySelect.jsx
// Kind-filtered category dropdown, reused by the donation / expense /
// other-income forms. Loads active categories for the given `kind` (+ optional
// foundation scope for SUPERADMIN).

import React, { useEffect, useMemo, useState } from "react";
import { Select } from "../../../components/ui";
import { listCategories } from "../api";

const CategorySelect = ({
  value,
  onChange,
  kind,
  foundationId,
  disabled,
  error,
  placeholder = "— Select category —",
}) => {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = { page: 1, pageSize: 100, kind };
        if (foundationId) params.foundationId = foundationId;
        const res = await listCategories(params);
        if (!cancelled) setCategories(res?.items ?? []);
      } catch (err) {
        console.error("Fetch categories (select) error:", err);
        if (!cancelled) setCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, foundationId]);

  const options = useMemo(
    () => [
      { value: "", label: placeholder },
      ...categories
        .filter((c) => !c.isDeleted)
        .map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories, placeholder]
  );

  return (
    <Select
      value={value || ""}
      onChange={onChange}
      options={options}
      disabled={disabled}
      error={!!error}
    />
  );
};

export default CategorySelect;
