'use client';

import type { ListingSearchParams } from '@forumo/shared';
import { useCategories } from '../../lib/react-query/hooks';

const CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'LIKE_NEW', label: 'Like New' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
];

const SORT_OPTIONS = [
  { value: '', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'date_new', label: 'Newest First' },
  { value: 'date_old', label: 'Oldest First' },
];

export type FiltersState = Partial<ListingSearchParams> & { conditions?: string[] };

type ListingFiltersProps = {
  filters: FiltersState;
  onChange: (patch: Partial<FiltersState>) => void;
  onReset: () => void;
};

export function ListingFilters({ filters, onChange, onReset }: ListingFiltersProps) {
  const { data: categoriesData } = useCategories();
  const categories = categoriesData ?? [];

  function toggle<T extends string>(arr: T[] | undefined, value: T): T[] {
    const current = arr ?? [];
    return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  }

  const hasActiveFilters =
    !!filters.status ||
    !!filters.minPriceCents ||
    !!filters.maxPriceCents ||
    (filters.conditions?.length ?? 0) > 0 ||
    (filters.categories?.length ?? 0) > 0 ||
    (filters.tags?.length ?? 0) > 0 ||
    !!filters.sort;

  return (
    <aside className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Filters</h2>
        {hasActiveFilters && (
          <button type="button" onClick={onReset} className="text-xs text-forumo-link hover:underline">
            Clear all
          </button>
        )}
      </div>

      {/* Sort */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Sort by</p>
        <select
          className="input-forumo w-full text-sm"
          value={filters.sort ?? ''}
          onChange={(e) =>
            onChange({ sort: (e.target.value as ListingSearchParams['sort']) || undefined, page: 1 })
          }
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Price range */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Price range</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step="1"
            placeholder="Min"
            value={filters.minPriceCents ? filters.minPriceCents / 100 : ''}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onChange({ minPriceCents: Number.isFinite(v) && v > 0 ? Math.round(v * 100) : undefined, page: 1 });
            }}
            className="input-forumo text-sm w-full"
          />
          <span className="text-slate-400 text-xs shrink-0">to</span>
          <input
            type="number"
            min={0}
            step="1"
            placeholder="Max"
            value={filters.maxPriceCents ? filters.maxPriceCents / 100 : ''}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onChange({ maxPriceCents: Number.isFinite(v) && v > 0 ? Math.round(v * 100) : undefined, page: 1 });
            }}
            className="input-forumo text-sm w-full"
          />
        </div>
      </div>

      {/* Condition */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Condition</p>
        <div className="space-y-1.5">
          {CONDITIONS.map(({ value, label }) => {
            const checked = (filters.conditions ?? []).includes(value);
            return (
              <label key={value} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange({ conditions: toggle(filters.conditions, value), page: 1 })
                  }
                  className="rounded border-slate-300 text-forumo-orange focus:ring-forumo-orange"
                />
                <span className="text-sm text-slate-600 group-hover:text-slate-900">{label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Categories</p>
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {categories.map((cat) => {
              const checked = (filters.categories ?? []).includes(cat.slug);
              return (
                <label key={cat.id} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      onChange({ categories: toggle(filters.categories, cat.slug), page: 1 })
                    }
                    className="rounded border-slate-300 text-forumo-orange focus:ring-forumo-orange"
                  />
                  <span className="text-sm text-slate-600 group-hover:text-slate-900">{cat.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Listing status */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Listing status</p>
        <select
          className="input-forumo w-full text-sm"
          value={filters.status ?? ''}
          onChange={(e) =>
            onChange({ status: (e.target.value as ListingSearchParams['status']) || undefined, page: 1 })
          }
        >
          <option value="">Any</option>
          <option value="PUBLISHED">Published</option>
          <option value="PAUSED">Paused</option>
          <option value="DRAFT">Draft</option>
        </select>
      </div>
    </aside>
  );
}
