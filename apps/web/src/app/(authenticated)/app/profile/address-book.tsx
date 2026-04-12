'use client';

import { useState } from 'react';
import { useAddresses, useAddressMutations } from '../../../../lib/react-query/hooks';

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
  label: '',
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  type: 'SHIPPING',
  isDefault: false,
};

export function AddressBook() {
  const { data: addresses = [], isLoading } = useAddresses();
  const mutations = useAddressMutations();
  const [editing, setEditing] = useState<string | null>(null); // address id or 'new'
  const [form, setForm] = useState(EMPTY_FORM);

  function openNew() {
    setForm(EMPTY_FORM);
    setEditing('new');
  }

  function openEdit(addr: Address) {
    setForm({
      label: addr.label ?? '',
      fullName: addr.fullName,
      phone: addr.phone ?? '',
      line1: addr.line1,
      line2: addr.line2 ?? '',
      city: addr.city,
      state: addr.state ?? '',
      postalCode: addr.postalCode ?? '',
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
    if (editing === 'new') {
      await mutations.create.mutateAsync(payload);
    } else if (editing) {
      await mutations.update.mutateAsync({ id: editing, ...payload });
    }
    cancel();
  }

  if (isLoading) {
    return <div className="h-24 rounded-xl bg-slate-800 animate-pulse" />;
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300">Saved addresses</h3>
        {editing === null && (
          <button onClick={openNew} className="text-xs text-amber-400 hover:text-amber-300">
            + Add address
          </button>
        )}
      </div>

      {/* Address list */}
      {addresses.length === 0 && editing === null && (
        <p className="text-sm text-slate-500">No addresses saved yet.</p>
      )}
      {(addresses as Address[]).map((addr) => (
        <div key={addr.id} className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white">{addr.fullName}</p>
                {addr.isDefault && (
                  <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] text-amber-400">
                    Default
                  </span>
                )}
                {addr.label && (
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                    {addr.label}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}
                {addr.state ? `, ${addr.state}` : ''} {addr.postalCode ?? ''}, {addr.country}
              </p>
              {addr.phone && <p className="text-xs text-slate-500">{addr.phone}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => openEdit(addr)} className="text-xs text-amber-400 hover:text-amber-300">Edit</button>
              <button
                onClick={() => mutations.remove.mutate(addr.id)}
                disabled={mutations.remove.isPending}
                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Add / Edit form */}
      {editing !== null && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 space-y-3">
          <p className="text-xs font-medium text-slate-300">{editing === 'new' ? 'New address' : 'Edit address'}</p>

          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Label (e.g. Home)" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              className="col-span-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none" />
            <input placeholder="Full name *" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none" />
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none" />
            <input placeholder="Street address *" value={form.line1} onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
              className="col-span-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none" />
            <input placeholder="Apartment, suite, etc." value={form.line2} onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
              className="col-span-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none" />
            <input placeholder="City *" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none" />
            <input placeholder="State / Province" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none" />
            <input placeholder="Postal code" value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none" />
            <input placeholder="Country *" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none" />
          </div>

          <div className="flex items-center gap-2">
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none">
              <option value="SHIPPING">Shipping</option>
              <option value="BILLING">Billing</option>
              <option value="BOTH">Both</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500" />
              Set as default
            </label>
          </div>

          {(mutations.create.isError || mutations.update.isError) && (
            <p className="text-xs text-red-400">
              {((mutations.create.error ?? mutations.update.error) as Error)?.message ?? 'Failed to save address'}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!form.fullName || !form.line1 || !form.city || !form.country || mutations.create.isPending || mutations.update.isPending}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
            >
              {mutations.create.isPending || mutations.update.isPending ? 'Saving…' : 'Save address'}
            </button>
            <button onClick={cancel} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
