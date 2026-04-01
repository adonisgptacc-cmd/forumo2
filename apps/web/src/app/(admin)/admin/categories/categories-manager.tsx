'use client';

import { useState } from 'react';
import { useCategories, useTags, useCategoryMutations, useTagMutations } from '../../../../lib/react-query/hooks';
import type { ListingCategory, ListingTag } from '@forumo/shared';

export function CategoriesManager() {
  const { data: categories = [], isLoading: catLoading } = useCategories();
  const { data: tags = [], isLoading: tagLoading } = useTags();
  const catMutations = useCategoryMutations();
  const tagMutations = useTagMutations();

  const [tab, setTab] = useState<'categories' | 'tags'>('categories');

  // Category form state
  const [catSlug, setCatSlug] = useState('');
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catParent, setCatParent] = useState('');
  const [editingCat, setEditingCat] = useState<ListingCategory | null>(null);

  // Tag form state
  const [tagSlug, setTagSlug] = useState('');
  const [tagLabel, setTagLabel] = useState('');
  const [editingTag, setEditingTag] = useState<ListingTag | null>(null);

  function resetCatForm() {
    setCatSlug(''); setCatName(''); setCatDesc(''); setCatParent(''); setEditingCat(null);
  }

  function resetTagForm() {
    setTagSlug(''); setTagLabel(''); setEditingTag(null);
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {(['categories', 'tags'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-t text-sm font-medium ${tab === t ? 'border-b-2 border-amber-400 text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'categories' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Category form */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
            <h3 className="font-semibold">{editingCat ? 'Edit category' : 'New category'}</h3>
            <div className="space-y-3">
              {!editingCat && (
                <input
                  placeholder="Slug (e.g. electronics)"
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              )}
              <input
                placeholder="Name"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
              <input
                placeholder="Description (optional)"
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
              <select
                value={catParent}
                onChange={(e) => setCatParent(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="">No parent (top-level)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {catMutations.create.isError && (
              <p className="text-xs text-red-400">{(catMutations.create.error as Error)?.message}</p>
            )}
            {catMutations.update.isError && (
              <p className="text-xs text-red-400">{(catMutations.update.error as Error)?.message}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (editingCat) {
                    await catMutations.update.mutateAsync({
                      id: editingCat.id,
                      name: catName || undefined,
                      description: catDesc || undefined,
                      parentId: catParent || undefined,
                    });
                    resetCatForm();
                  } else {
                    if (!catSlug || !catName) return;
                    await catMutations.create.mutateAsync({
                      slug: catSlug,
                      name: catName,
                      description: catDesc || undefined,
                      parentId: catParent || undefined,
                    });
                    resetCatForm();
                  }
                }}
                disabled={catMutations.create.isPending || catMutations.update.isPending}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
              >
                {editingCat ? 'Update' : 'Create'}
              </button>
              {editingCat && (
                <button onClick={resetCatForm} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Category list */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-2">
            <h3 className="font-semibold">Categories ({categories.length})</h3>
            {catLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : categories.length === 0 ? (
              <p className="text-sm text-slate-500">No categories yet.</p>
            ) : (
              <ul className="space-y-2 max-h-80 overflow-y-auto">
                {categories.map((cat) => (
                  <li key={cat.id} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{cat.name}</p>
                      <p className="text-xs text-slate-500">{cat.slug}{cat.parentId ? ' · subcategory' : ''}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingCat(cat);
                          setCatName(cat.name);
                          setCatDesc(cat.description ?? '');
                          setCatParent(cat.parentId ?? '');
                        }}
                        className="rounded px-2 py-1 text-xs text-amber-400 hover:bg-amber-400/10"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => catMutations.remove.mutate(cat.id)}
                        disabled={catMutations.remove.isPending}
                        className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-400/10 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === 'tags' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Tag form */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
            <h3 className="font-semibold">{editingTag ? 'Edit tag' : 'New tag'}</h3>
            <div className="space-y-3">
              {!editingTag && (
                <input
                  placeholder="Slug (e.g. handmade)"
                  value={tagSlug}
                  onChange={(e) => setTagSlug(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              )}
              <input
                placeholder="Label"
                value={tagLabel}
                onChange={(e) => setTagLabel(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
            {tagMutations.create.isError && (
              <p className="text-xs text-red-400">{(tagMutations.create.error as Error)?.message}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (editingTag) {
                    await tagMutations.update.mutateAsync({ id: editingTag.id, label: tagLabel || undefined });
                    resetTagForm();
                  } else {
                    if (!tagSlug || !tagLabel) return;
                    await tagMutations.create.mutateAsync({ slug: tagSlug, label: tagLabel });
                    resetTagForm();
                  }
                }}
                disabled={tagMutations.create.isPending || tagMutations.update.isPending}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
              >
                {editingTag ? 'Update' : 'Create'}
              </button>
              {editingTag && (
                <button onClick={resetTagForm} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Tag list */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-2">
            <h3 className="font-semibold">Tags ({tags.length})</h3>
            {tagLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : tags.length === 0 ? (
              <p className="text-sm text-slate-500">No tags yet.</p>
            ) : (
              <ul className="space-y-2 max-h-80 overflow-y-auto">
                {tags.map((tag) => (
                  <li key={tag.id} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{tag.label}</p>
                      <p className="text-xs text-slate-500">{tag.slug}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingTag(tag); setTagLabel(tag.label); }}
                        className="rounded px-2 py-1 text-xs text-amber-400 hover:bg-amber-400/10"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => tagMutations.remove.mutate(tag.id)}
                        disabled={tagMutations.remove.isPending}
                        className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-400/10 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
