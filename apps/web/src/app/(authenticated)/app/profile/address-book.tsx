"use client";

import { useState } from "react";
import {
  useAddresses,
  useAddressMutations,
} from "../../../../lib/react-query/hooks";

interface Address {
  id: string;
  label?: string;
  fullName: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  type: string;
  isDefault: boolean;
}

const EMPTY_FORM = {
  label: "",
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  type: "SHIPPING",
  isDefault: false,
};

export function AddressBook() {
  const { data: addresses = [], isLoading } = useAddresses();
  const mutations = useAddressMutations();
  const [editing, setEditing] = useState<string | null>(null); // address id or 'new'
  const [form, setForm] = useState(EMPTY_FORM);

  function openNew() {
    setForm(EMPTY_FORM);
    setEditing("new");
  }

  function openEdit(addr: Address) {
    setForm({
      label: addr.label ?? "",
      fullName: addr.fullName,
      phone: addr.phone ?? "",
      line1: addr.line1,
      line2: addr.line2 ?? "",
      city: addr.city,
      state: addr.state ?? "",
      postalCode: addr.postalCode ?? "",
      country: addr.country,
      type: addr.type,
      isDefault: addr.isDefault,
    });
    setEditing(addr.id);
  }

  function cancel() {
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    const payload = {
      ...form,
      label: form.label || undefined,
      phone: form.phone || undefined,
      line2: form.line2 || undefined,
      state: form.state || undefined,
      postalCode: form.postalCode || undefined,
    };
    if (editing === "new") {
      await mutations.create.mutateAsync(payload);
    } else if (editing) {
      await mutations.update.mutateAsync({ id: editing, ...payload });
    }
    cancel();
  }

  if (isLoading) {
    return <div className="skeleton h-24 rounded-[14px]" />;
  }

  return (
    <div className="card card-pad space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium subtle">Saved addresses</h3>
        {editing === null && (
          <button
            onClick={openNew}
            className="text-xs text-[color:var(--accent)] hover:text-[color:var(--accent-2)]"
          >
            + Add address
          </button>
        )}
      </div>

      {/* Address list */}
      {addresses.length === 0 && editing === null && (
        <p className="text-sm muted">No addresses saved yet.</p>
      )}
      {(addresses as Address[]).map((addr) => (
        <div
          key={addr.id}
          className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-2)] px-4 py-3 space-y-1"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-[color:var(--ink)]">
                  {addr.fullName}
                </p>
                {addr.isDefault && (
                  <span className="rounded-full bg-[color:var(--accent-bg)] border border-transparent px-2 py-0.5 text-[10px] text-[color:var(--accent-2)]">
                    Default
                  </span>
                )}
                {addr.label && (
                  <span className="rounded-full bg-[color:var(--line)] px-2 py-0.5 text-[10px] text-[color:var(--ink-2)]">
                    {addr.label}
                  </span>
                )}
              </div>
              <p className="text-xs muted">
                {addr.line1}
                {addr.line2 ? `, ${addr.line2}` : ""}, {addr.city}
                {addr.state ? `, ${addr.state}` : ""} {addr.postalCode ?? ""},{" "}
                {addr.country}
              </p>
              {addr.phone && <p className="text-xs muted">{addr.phone}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => openEdit(addr)}
                className="text-xs text-[color:var(--accent)] hover:text-[color:var(--accent-2)]"
              >
                Edit
              </button>
              <button
                onClick={() => mutations.remove.mutate(addr.id)}
                disabled={mutations.remove.isPending}
                className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Add / Edit form */}
      {editing !== null && (
        <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-2)] p-4 space-y-3">
          <p className="text-xs font-medium subtle">
            {editing === "new" ? "New address" : "Edit address"}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Label (e.g. Home)"
              value={form.label}
              onChange={(e) =>
                setForm((f) => ({ ...f, label: e.target.value }))
              }
              className="col-span-2 rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
            />
            <input
              placeholder="Full name *"
              value={form.fullName}
              onChange={(e) =>
                setForm((f) => ({ ...f, fullName: e.target.value }))
              }
              className="rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
            />
            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              className="rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
            />
            <input
              placeholder="Street address *"
              value={form.line1}
              onChange={(e) =>
                setForm((f) => ({ ...f, line1: e.target.value }))
              }
              className="col-span-2 rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
            />
            <input
              placeholder="Apartment, suite, etc."
              value={form.line2}
              onChange={(e) =>
                setForm((f) => ({ ...f, line2: e.target.value }))
              }
              className="col-span-2 rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
            />
            <input
              placeholder="City *"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              className="rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
            />
            <input
              placeholder="State / Province"
              value={form.state}
              onChange={(e) =>
                setForm((f) => ({ ...f, state: e.target.value }))
              }
              className="rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
            />
            <input
              placeholder="Postal code"
              value={form.postalCode}
              onChange={(e) =>
                setForm((f) => ({ ...f, postalCode: e.target.value }))
              }
              className="rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
            />
            <input
              placeholder="Country *"
              value={form.country}
              onChange={(e) =>
                setForm((f) => ({ ...f, country: e.target.value }))
              }
              className="rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
            >
              <option value="SHIPPING">Shipping</option>
              <option value="BILLING">Billing</option>
              <option value="BOTH">Both</option>
            </select>
            <label className="flex items-center gap-2 text-sm subtle cursor-pointer">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isDefault: e.target.checked }))
                }
                className="rounded border-[color:var(--line-2)] accent-[var(--accent)] focus:ring-[color:var(--accent)]"
              />
              Set as default
            </label>
          </div>

          {(mutations.create.isError || mutations.update.isError) && (
            <p className="text-xs text-red-600">
              {((mutations.create.error ?? mutations.update.error) as Error)
                ?.message ?? "Failed to save address"}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={
                !form.fullName ||
                !form.line1 ||
                !form.city ||
                !form.country ||
                mutations.create.isPending ||
                mutations.update.isPending
              }
              className="btn btn-primary btn-sm"
            >
              {mutations.create.isPending || mutations.update.isPending
                ? "Saving…"
                : "Save address"}
            </button>
            <button onClick={cancel} className="btn btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
