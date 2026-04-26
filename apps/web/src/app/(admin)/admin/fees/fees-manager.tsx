'use client';

import { useState } from 'react';
import { useFeeSchedules, useFeeScheduleMutations } from '../../../../lib/react-query/hooks';
import { useCategories } from '../../../../lib/react-query/hooks';
import type { FeeSchedule, CreateFeeScheduleDto } from '@forumo/shared';

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const EMPTY_FORM: CreateFeeScheduleDto = {
  name: '',
  categoryId: null,
  feePercent: 5,
  fixedFeeCents: 0,
  minFeeCents: 0,
  maxFeeCents: null,
};

export function FeesManager() {
  const { data: schedules = [], isLoading } = useFeeSchedules();
  const { data: categories = [] } = useCategories();
  const { create, update, remove } = useFeeScheduleMutations();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FeeSchedule | null>(null);
  const [form, setForm] = useState<CreateFeeScheduleDto>(EMPTY_FORM);
  const [calcSubtotal, setCalcSubtotal] = useState('');

  const activeGlobal = schedules.find((s) => s.isActive && s.categoryId === null);
  const activeCategoryIds = new Set(
    schedules.filter((s) => s.isActive && s.categoryId !== null).map((s) => s.categoryId!),
  );
  const uncoveredCategories = categories.filter(
    (c) => !activeCategoryIds.has(c.id) && activeGlobal === undefined,
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(schedule: FeeSchedule) {
    setEditing(schedule);
    setForm({
      name: schedule.name,
      categoryId: schedule.categoryId,
      feePercent: schedule.feePercent,
      fixedFeeCents: schedule.fixedFeeCents,
      minFeeCents: schedule.minFeeCents,
      maxFeeCents: schedule.maxFeeCents,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      await update.mutateAsync({ id: editing.id, payload: form });
    } else {
      await create.mutateAsync(form);
    }
    closeForm();
  }

  function calcFee(subtotalCents: number, schedule: FeeSchedule): number {
    if (subtotalCents <= 0) return 0;
    const percentPart = Math.round((subtotalCents * schedule.feePercent) / 100);
    let fee = Math.max(percentPart + schedule.fixedFeeCents, schedule.minFeeCents);
    if (schedule.maxFeeCents !== null && schedule.maxFeeCents !== undefined) {
      fee = Math.min(fee, schedule.maxFeeCents);
    }
    return fee;
  }

  const subtotalCents = Math.round(parseFloat(calcSubtotal || '0') * 100);
  const previewSchedule = activeGlobal ?? schedules.find((s) => s.isActive);

  return (
    <div className="space-y-6">
      {/* Warning: no active global fee schedule */}
      {!activeGlobal && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          No active global default fee schedule. Listings without a category-specific schedule will have 0% fee.
          {uncoveredCategories.length > 0 && (
            <span className="block mt-1 text-amber-300/80">
              Uncovered categories: {uncoveredCategories.map((c) => c.name).join(', ')}
            </span>
          )}
        </div>
      )}

      {/* Live fee calculator */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
        <h3 className="font-semibold text-sm text-slate-300">Live Fee Calculator</h3>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Item price"
              value={calcSubtotal}
              onChange={(e) => setCalcSubtotal(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-7 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>
          {previewSchedule && subtotalCents > 0 && (
            <p className="text-sm text-slate-300">
              Platform earns{' '}
              <span className="font-bold text-amber-400">
                {formatCents(calcFee(subtotalCents, previewSchedule))}
              </span>{' '}
              <span className="text-slate-500">({previewSchedule.feePercent}% + {formatCents(previewSchedule.fixedFeeCents)} fixed)</span>
            </p>
          )}
          {!previewSchedule && <p className="text-sm text-slate-500">No active schedule found</p>}
        </div>
      </div>

      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400 transition"
        >
          + Add Fee Schedule
        </button>
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 space-y-4">
            <h3 className="font-semibold text-white">{editing ? 'Edit Fee Schedule' : 'New Fee Schedule'}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                required
                placeholder="Schedule name (e.g. Electronics 8%)"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />

              <select
                value={form.categoryId ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value || null }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="">All categories (global default)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Fee % (0–50)</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.01"
                    required
                    value={form.feePercent}
                    onChange={(e) => setForm((f) => ({ ...f, feePercent: parseFloat(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Fixed fee (cents)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.fixedFeeCents ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, fixedFeeCents: parseInt(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Min fee (cents)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.minFeeCents ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, minFeeCents: parseInt(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Max fee (cents, optional)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.maxFeeCents ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, maxFeeCents: e.target.value ? parseInt(e.target.value) : null }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={create.isPending || update.isPending}
                  className="flex-1 rounded-lg bg-amber-500 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-50 transition"
                >
                  {create.isPending || update.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 rounded-lg border border-slate-700 py-2 text-sm text-slate-300 hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : schedules.length === 0 ? (
        <p className="text-slate-500 text-sm">No fee schedules yet. Create one to start collecting revenue.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs text-slate-400">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Fee %</th>
                <th className="px-4 py-3 font-medium">Fixed</th>
                <th className="px-4 py-3 font-medium">Min</th>
                <th className="px-4 py-3 font-medium">Max</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-medium text-white">{s.name}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {s.category ? s.category.name : <span className="text-amber-400">All categories</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{s.feePercent}%</td>
                  <td className="px-4 py-3 text-slate-300">{formatCents(s.fixedFeeCents)}</td>
                  <td className="px-4 py-3 text-slate-300">{formatCents(s.minFeeCents)}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {s.maxFeeCents !== null && s.maxFeeCents !== undefined ? formatCents(s.maxFeeCents) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        update.mutate({ id: s.id, payload: { isActive: !s.isActive } })
                      }
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.isActive
                          ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                          : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                      }`}
                    >
                      {s.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(s)}
                        className="text-xs text-amber-400 hover:text-amber-300"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove.mutate(s.id)}
                        disabled={remove.isPending}
                        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        Deactivate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
