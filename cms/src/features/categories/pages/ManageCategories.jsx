// src/features/categories/pages/ManageCategories.jsx
// Unified category admin. One tab per kind (Income / Expense / Other Income),
// each a small table with inline create/edit + soft-delete/restore. SUPERADMIN
// picks a foundation to scope the lists + creates.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { PlusIcon, PencilIcon, TrashIcon, ArrowUturnLeftIcon } from "@heroicons/react/24/outline";

import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  restoreCategory,
} from "../api";
import { listFoundations } from "../../foundations/api";
import { useAuth } from "../../../context/AuthContext";
import { usePermissions } from "../../../hooks/usePermissions";
import { ROLES } from "../../../constants/roles";
import { PERMISSIONS } from "../../../constants/permissions";
import {
  Badge,
  Button,
  Card,
  CardBody,
  ConfirmDialog,
  Dropdown,
  DropdownItem,
  EmptyState,
  FormField,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Tabs,
  Textarea,
} from "../../../components/ui";
import { EllipsisVerticalIcon, TagIcon } from "@heroicons/react/24/outline";

const KINDS = [
  { key: "INCOME", label: "Income" },
  { key: "EXPENSE", label: "Expense" },
  { key: "OTHER_INCOME", label: "Other Donation" },
];

function CategoryTab({ kind, foundationId, canManage }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: 1, pageSize: 100, kind };
      if (foundationId) params.foundationId = foundationId;
      if (includeDeleted) params.includeDeleted = true;
      const res = await listCategories(params);
      setItems(res?.items ?? []);
    } catch (err) {
      console.error("Fetch categories error:", err);
    } finally {
      setLoading(false);
    }
  }, [kind, foundationId, includeDeleted]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "" });
    setModalOpen(true);
  };
  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name, description: c.description || "" });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id, {
          name: form.name.trim(),
          description: form.description.trim() || null,
        });
        toast.success("Category updated.");
      } else {
        const payload = { kind, name: form.name.trim() };
        if (form.description.trim()) payload.description = form.description.trim();
        if (foundationId) payload.foundationId = foundationId;
        await createCategory(payload);
        toast.success("Category created.");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      console.error("Save category error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      await deleteCategory(confirmDeleteId);
      toast.info("Category deleted.");
      setConfirmDeleteId(null);
      await load();
    } catch (err) {
      console.error("Delete category error:", err);
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (c) => {
    try {
      await restoreCategory(c.id);
      toast.success("Category restored.");
      await load();
    } catch (err) {
      console.error("Restore category error:", err);
    }
  };

  return (
    <Card>
      <CardBody>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Show deleted
          </label>
          {canManage && (
            <Button size="sm" leftIcon={<PlusIcon className="h-4 w-4" />} onClick={openCreate}>
              Add category
            </Button>
          )}
        </div>

        <div className="relative overflow-x-auto">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
              <Spinner />
            </div>
          )}
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                {canManage && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 4 : 3} className="px-4 py-10 text-center">
                    <EmptyState
                      icon={TagIcon}
                      title="No categories yet"
                      description="Add a category with the button above."
                    />
                  </td>
                </tr>
              )}
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2.5 font-medium">{c.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.description || "—"}</td>
                  <td className="px-4 py-2.5">
                    {c.isDeleted ? (
                      <Badge variant="danger">Deleted</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-2.5 text-right">
                      <Dropdown
                        trigger={
                          <button
                            type="button"
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Row actions"
                          >
                            <EllipsisVerticalIcon className="h-5 w-5" />
                          </button>
                        }
                      >
                        {c.isDeleted ? (
                          <DropdownItem
                            icon={<ArrowUturnLeftIcon className="h-4 w-4" />}
                            onClick={() => handleRestore(c)}
                          >
                            Restore
                          </DropdownItem>
                        ) : (
                          <>
                            <DropdownItem
                              icon={<PencilIcon className="h-4 w-4" />}
                              onClick={() => openEdit(c)}
                            >
                              Edit
                            </DropdownItem>
                            <DropdownItem
                              icon={<TrashIcon className="h-4 w-4" />}
                              danger
                              onClick={() => setConfirmDeleteId(c.id)}
                            >
                              Delete
                            </DropdownItem>
                          </>
                        )}
                      </Dropdown>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>

      <Modal
        open={modalOpen}
        onClose={() => (saving ? null : setModalOpen(false))}
        title={editing ? "Edit category" : "Add category"}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="category-form" loading={saving} disabled={!form.name.trim()}>
              {editing ? "Update" : "Create"}
            </Button>
          </>
        }
      >
        <form id="category-form" onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Name" required>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Zakat / Rent / Foodgrain"
              disabled={saving}
              autoFocus
            />
          </FormField>
          <FormField label="Description">
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              disabled={saving}
            />
          </FormField>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDeleteId}
        onClose={() => (deleting ? null : setConfirmDeleteId(null))}
        onConfirm={handleDelete}
        title="Delete category?"
        description="Soft-delete this category. Categories in use by existing records can't be deleted."
        confirmLabel="Delete"
        loading={deleting}
      />
    </Card>
  );
}

export default function ManageCategories() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const isSuperadmin = user?.role === ROLES.SUPERADMIN;
  const canManage = can(PERMISSIONS.CATEGORY_MANAGE);

  const [foundations, setFoundations] = useState([]);
  const [selectedFoundationId, setSelectedFoundationId] = useState("");

  useEffect(() => {
    if (!isSuperadmin) return;
    (async () => {
      try {
        const res = await listFoundations({ page: 1, pageSize: 100 });
        setFoundations(res?.items ?? []);
      } catch (err) {
        console.error("Fetch foundations error:", err);
      }
    })();
  }, [isSuperadmin]);

  const foundationOptions = useMemo(
    () => [
      { value: "", label: "Select foundation…" },
      ...foundations.map((f) => ({ value: f.id, label: f.name })),
    ],
    [foundations]
  );

  const scopedFoundationId = isSuperadmin ? selectedFoundationId || undefined : undefined;

  const tabs = KINDS.map((k) => ({
    key: k.key,
    label: k.label,
    content:
      isSuperadmin && !selectedFoundationId ? (
        <Card>
          <CardBody className="py-10 text-center text-sm text-muted-foreground">
            Pick a foundation above to manage its categories.
          </CardBody>
        </Card>
      ) : (
        <CategoryTab kind={k.key} foundationId={scopedFoundationId} canManage={canManage} />
      ),
  }));

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Categories"
        subtitle="Manage the categories used to classify income, expenses, and in-kind receipts."
        actions={
          isSuperadmin && (
            <div className="w-56">
              <Select
                value={selectedFoundationId}
                onChange={setSelectedFoundationId}
                options={foundationOptions}
              />
            </div>
          )
        }
      />
      <Tabs tabs={tabs} />
    </div>
  );
}
