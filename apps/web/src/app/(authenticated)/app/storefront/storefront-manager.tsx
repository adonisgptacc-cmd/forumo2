'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  useMyStorefront,
  useMyCollections,
  useStorefrontMutations,
  useCollectionMutations,
} from '../../../../lib/react-query/hooks';

export function StorefrontManager() {
  const { data: storefront, isLoading } = useMyStorefront();
  const { data: collections = [] } = useMyCollections();
  const sfMutations = useStorefrontMutations();
  const colMutations = useCollectionMutations();

  // Storefront form
  const [sfName, setSfName] = useState('');
  const [sfSlug, setSfSlug] = useState('');
  const [sfDesc, setSfDesc] = useState('');
  const [sfEditing, setSfEditing] = useState(false);

  // Collection form
  const [colName, setColName] = useState('');
  const [colSlug, setColSlug] = useState('');
  const [colDesc, setColDesc] = useState('');
  const [editingCol, setEditingCol] = useState<string | null>(null);

  useEffect(() => {
    if (storefront) {
      setSfName(storefront.name);
      setSfDesc(storefront.description ?? '');
    }
  }, [storefront]);

  if (isLoading) {
    return <div className="h-40 rounded-xl bg-slate-800 animate-pulse" />;
  }

  return (
    <div className="space-y-8">
      {/* Storefront section */}
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            {storefront ? 'My Storefront' : 'Create Storefront'}
          </h3>
          {storefront && !sfEditing && (
            <div className="flex gap-2">
              <Link
                href={`/shops/${storefront.slug}` as any}
                className="text-xs text-amber-400 hover:underline"
                target="_blank"
              >
                View public page →
              </Link>
              <button
                onClick={() => setSfEditing(true)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {storefront && !sfEditing ? (
          <div className="space-y-1">
            <p className="font-medium">{storefront.name}</p>
            <p className="text-xs text-slate-500">@{storefront.slug}</p>
            {storefront.description && <p className="text-sm text-slate-400">{storefront.description}</p>}
            <button
              onClick={() => sfMutations.remove.mutate()}
              disabled={sfMutations.remove.isPending}
              className="mt-2 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              {sfMutations.remove.isPending ? 'Deleting…' : 'Delete storefront'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {!storefront && (
              <input
                placeholder="Slug (e.g. my-shop)"
                value={sfSlug}
                onChange={(e) => setSfSlug(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
            )}
            <input
              placeholder="Store name"
              value={sfName}
              onChange={(e) => setSfName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
            <textarea
              placeholder="Description (optional)"
              value={sfDesc}
              onChange={(e) => setSfDesc(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
            {(sfMutations.create.isError || sfMutations.update.isError) && (
              <p className="text-xs text-red-400">
                {((sfMutations.create.error ?? sfMutations.update.error) as Error)?.message}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (storefront) {
                    await sfMutations.update.mutateAsync({ name: sfName, description: sfDesc || undefined });
                    setSfEditing(false);
                  } else {
                    if (!sfSlug || !sfName) return;
                    await sfMutations.create.mutateAsync({ slug: sfSlug, name: sfName, description: sfDesc || undefined });
                  }
                }}
                disabled={sfMutations.create.isPending || sfMutations.update.isPending}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
              >
                {storefront ? 'Save changes' : 'Create storefront'}
              </button>
              {sfEditing && (
                <button onClick={() => setSfEditing(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Collections section */}
      {storefront && (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 space-y-4">
          <h3 className="font-semibold">Collections</h3>

          {/* New collection form */}
          <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 space-y-3">
            <p className="text-xs text-slate-400 font-medium">{editingCol ? 'Edit collection' : 'New collection'}</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Name"
                value={colName}
                onChange={(e) => setColName(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
              {!editingCol && (
                <input
                  placeholder="Slug"
                  value={colSlug}
                  onChange={(e) => setColSlug(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              )}
            </div>
            <input
              placeholder="Description (optional)"
              value={colDesc}
              onChange={(e) => setColDesc(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (editingCol) {
                    await colMutations.update.mutateAsync({ id: editingCol, name: colName || undefined, description: colDesc || undefined });
                  } else {
                    if (!colName || !colSlug) return;
                    await colMutations.create.mutateAsync({ name: colName, slug: colSlug, description: colDesc || undefined });
                  }
                  setColName(''); setColSlug(''); setColDesc(''); setEditingCol(null);
                }}
                disabled={colMutations.create.isPending || colMutations.update.isPending}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
              >
                {editingCol ? 'Save' : 'Create'}
              </button>
              {editingCol && (
                <button
                  onClick={() => { setColName(''); setColSlug(''); setColDesc(''); setEditingCol(null); }}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Collection list */}
          {collections.length === 0 ? (
            <p className="text-sm text-slate-500">No collections yet.</p>
          ) : (
            <ul className="space-y-2">
              {collections.map((col) => (
                <li key={col.id} className="flex items-center justify-between rounded-lg border border-slate-800 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{col.name}</p>
                    <p className="text-xs text-slate-500">{col.slug} · {col.productIds.length} products</p>
                    {col.description && <p className="text-xs text-slate-500">{col.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditingCol(col.id); setColName(col.name); setColDesc(col.description ?? ''); }}
                      className="rounded px-2 py-1 text-xs text-amber-400 hover:bg-amber-400/10"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => colMutations.remove.mutate(col.id)}
                      disabled={colMutations.remove.isPending}
                      className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-400/10 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
