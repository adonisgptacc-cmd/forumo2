"use client";

import type { ListingSearchParams } from "@forumo/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ErrorBoundary } from "../../components/ErrorBoundary";
import { ListingCard } from "../../components/listings/ListingCard";
import {
  ListingFilters,
  type FiltersState,
} from "../../components/listings/ListingFilters";
import { useListings } from "../../lib/react-query/hooks";

const PAGE_SIZE = 24;

const DEFAULTS: FiltersState = {
  keyword: undefined,
  sellerId: undefined,
  status: undefined,
  page: 1,
  pageSize: PAGE_SIZE,
  minPriceCents: undefined,
  maxPriceCents: undefined,
  tags: [],
  sort: undefined,
  categories: [],
  conditions: [],
};

function buildUrl(filters: FiltersState): string {
  const p = new URLSearchParams();
  if (filters.keyword) p.set("keyword", filters.keyword);
  if (filters.sort) p.set("sort", filters.sort);
  if (filters.status) p.set("status", filters.status);
  if (filters.minPriceCents)
    p.set("minPriceCents", String(filters.minPriceCents));
  if (filters.maxPriceCents)
    p.set("maxPriceCents", String(filters.maxPriceCents));
  if (filters.page && filters.page > 1) p.set("page", String(filters.page));
  (filters.categories ?? []).forEach((c) => p.append("categories", c));
  (filters.tags ?? []).forEach((t) => p.append("tags", t));
  (filters.conditions ?? []).forEach((c) => p.append("condition", c));
  const qs = p.toString();
  return qs ? `/listings?${qs}` : "/listings";
}

function toApiFilters(filters: FiltersState): Partial<ListingSearchParams> {
  const { conditions, ...rest } = filters;
  const conditionTags = conditions ?? [];
  return {
    ...rest,
    tags: [...(rest.tags ?? []), ...conditionTags],
  };
}

export function ListingExplorer({
  initialParams,
}: {
  initialParams: Partial<ListingSearchParams> & { conditions?: string[] };
}) {
  const [filters, setFilters] = useState<FiltersState>({
    ...DEFAULTS,
    ...initialParams,
    conditions: initialParams.conditions ?? [],
  });

  const [searchInput, setSearchInput] = useState(initialParams.keyword ?? "");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apiFilters = useMemo(() => toApiFilters(filters), [filters]);
  const { data, isLoading, isError, error, isFetching } =
    useListings(apiFilters);

  const { showingFrom, showingTo } = useMemo(() => {
    if (!data || data.data.length === 0)
      return { showingFrom: 0, showingTo: 0 };
    const start = (data.page - 1) * data.pageSize + 1;
    return { showingFrom: start, showingTo: start + data.data.length - 1 };
  }, [data]);

  function applyFilters(next: FiltersState) {
    setFilters(next);
    router.replace(buildUrl(next) as any, { scroll: false });
  }

  function handleFilterChange(patch: Partial<FiltersState>) {
    const next = { ...filters, ...patch };
    applyFilters(next);
  }

  function handleReset() {
    setSearchInput("");
    applyFilters({ ...DEFAULTS });
  }

  function goToPage(page: number) {
    applyFilters({ ...filters, page });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmed = searchInput.trim() || undefined;
      if (trimmed === filters.keyword) return;
      applyFilters({ ...filters, keyword: trimmed, page: 1 });
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const activeFilterCount = countActiveFilters(filters);

  return (
    <div className="px-4 py-6 space-y-4 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Marketplace</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {filters.keyword
              ? `Results for "${filters.keyword}"`
              : "Browse all listings on Forumo"}
          </p>
        </div>
        <Link
          className="btn-forumo text-sm whitespace-nowrap shrink-0"
          href="/listings/new"
        >
          + New listing
        </Link>
      </div>

      {/* Search bar */}
      <div className="card-forumo">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1 relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
            <input
              type="text"
              className="input-forumo pl-9"
              placeholder="Search titles, descriptions, or tags…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="md:hidden flex items-center gap-2 px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4h18M7 8h10M11 12h4"
              />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-forumo-orange text-white text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Active filter chips */}
        <ActiveFilterChips
          filters={filters}
          onRemove={(key) =>
            handleFilterChange({
              [key]:
                key === "conditions" || key === "categories" || key === "tags"
                  ? []
                  : undefined,
              page: 1,
            })
          }
        />
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar filters — desktop always visible, mobile drawer */}
        <div
          className={`w-56 shrink-0 card-forumo ${sidebarOpen ? "block" : "hidden"} md:block`}
        >
          <ListingFilters
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleReset}
          />
        </div>

        {/* Results */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Result count + pagination top */}
          {!isLoading && data && data.data.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-y-2 text-sm text-slate-500">
              <p>
                Showing {showingFrom}–{showingTo} of {data.total} result
                {data.total !== 1 ? "s" : ""}
              </p>
              <PaginationControls
                page={data.page}
                pageCount={data.pageCount}
                onPrev={() => goToPage(data.page - 1)}
                onNext={() => goToPage(data.page + 1)}
              />
            </div>
          )}

          {isLoading ? (
            <SkeletonGrid />
          ) : isError ? (
            <div className="card-forumo text-center py-12">
              <p className="text-red-600 font-medium">
                Could not load listings
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {(error as Error | undefined)?.message ?? "Please try again."}
              </p>
            </div>
          ) : data && data.data.length > 0 ? (
            <>
              <div
                className="stagger grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                aria-busy={isFetching}
              >
                {data.data.map((listing) => (
                  <ErrorBoundary
                    key={listing.id}
                    fallback={
                      <div className="card-forumo flex items-center justify-center aspect-square text-xs text-slate-400 text-center p-4">
                        Could not load this item
                      </div>
                    }
                  >
                    <ListingCard listing={listing} />
                  </ErrorBoundary>
                ))}
              </div>

              <div className="flex items-center justify-center pt-2">
                <PaginationControls
                  page={data.page}
                  pageCount={data.pageCount}
                  onPrev={() => goToPage(data.page - 1)}
                  onNext={() => goToPage(data.page + 1)}
                  showPageNumbers
                />
              </div>
            </>
          ) : (
            <div className="card-forumo text-center py-16 space-y-3">
              <p className="text-slate-500 font-medium">
                No listings matched your search
              </p>
              <p className="text-sm text-slate-400">
                Try different keywords, adjust filters, or
              </p>
              <Link
                className="btn-forumo inline-block mt-2 text-sm"
                href="/listings/new"
              >
                Create a listing
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card-forumo space-y-3 p-0 overflow-hidden">
          <div className="skeleton aspect-square rounded-none" />
          <div className="p-3 space-y-2">
            <div className="skeleton h-3.5 w-full" />
            <div className="skeleton h-3.5 w-3/4" />
            <div className="skeleton h-4 w-1/2 mt-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PaginationControls({
  page,
  pageCount,
  onPrev,
  onNext,
  showPageNumbers = false,
}: {
  page: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
  showPageNumbers?: boolean;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center gap-3 text-sm">
      <button
        type="button"
        onClick={onPrev}
        disabled={page <= 1}
        className="text-forumo-link disabled:text-[color:var(--ink-3)] hover:underline disabled:no-underline disabled:cursor-default"
      >
        ← Prev
      </button>
      {showPageNumbers && (
        <span className="text-slate-400">
          Page {page} of {pageCount}
        </span>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={page >= pageCount}
        className="text-forumo-link disabled:text-[color:var(--ink-3)] hover:underline disabled:no-underline disabled:cursor-default"
      >
        Next →
      </button>
    </div>
  );
}

function countActiveFilters(filters: FiltersState): number {
  let n = 0;
  if (filters.status) n++;
  if (filters.minPriceCents) n++;
  if (filters.maxPriceCents) n++;
  if ((filters.conditions?.length ?? 0) > 0) n++;
  if ((filters.categories?.length ?? 0) > 0) n++;
  if ((filters.tags?.length ?? 0) > 0) n++;
  if (filters.sort) n++;
  return n;
}

function ActiveFilterChips({
  filters,
  onRemove,
}: {
  filters: FiltersState;
  onRemove: (key: keyof FiltersState) => void;
}) {
  const chips: { label: string; key: keyof FiltersState }[] = [];
  if (filters.status)
    chips.push({ label: `Status: ${filters.status}`, key: "status" });
  if (filters.sort) chips.push({ label: `Sort: ${filters.sort}`, key: "sort" });
  if (filters.minPriceCents)
    chips.push({
      label: `Min: ${(filters.minPriceCents / 100).toFixed(0)}`,
      key: "minPriceCents",
    });
  if (filters.maxPriceCents)
    chips.push({
      label: `Max: ${(filters.maxPriceCents / 100).toFixed(0)}`,
      key: "maxPriceCents",
    });
  if ((filters.conditions?.length ?? 0) > 0)
    chips.push({
      label: `Condition: ${(filters.conditions ?? []).join(", ")}`,
      key: "conditions",
    });
  if ((filters.categories?.length ?? 0) > 0)
    chips.push({
      label: `Categories: ${(filters.categories ?? []).join(", ")}`,
      key: "categories",
    });
  if ((filters.tags?.length ?? 0) > 0)
    chips.push({
      label: `Tags: ${(filters.tags ?? []).join(", ")}`,
      key: "tags",
    });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 text-xs bg-forumo-orange/10 text-forumo-orange border border-forumo-orange/30 rounded-full px-3 py-1"
        >
          {chip.label}
          <button
            type="button"
            onClick={() => onRemove(chip.key)}
            className="ml-1 text-forumo-orange/70 hover:text-forumo-orange font-bold leading-none"
            aria-label={`Remove ${chip.label} filter`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
