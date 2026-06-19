import type { ListingSearchParams } from '@forumo/shared';

import { ListingExplorer } from './listing-explorer';

type ListingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined> | undefined>;
};

function normalizeSearchParams(
  params: Record<string, string | string[] | undefined> | undefined,
): Partial<ListingSearchParams> & { conditions: string[] } {
  const normalized: Partial<ListingSearchParams> = {};
  const conditions: string[] = [];

  if (!params) return { ...normalized, conditions };

  for (const [key, value] of Object.entries(params)) {
    const vals = Array.isArray(value) ? value : [value];
    const single = vals[0];
    if (!single) continue;

    if (key === 'condition') {
      const all = Array.isArray(value) ? value : [value];
      conditions.push(...all.filter(Boolean).map(String));
    } else if (key === 'page' || key === 'pageSize') {
      normalized[key as 'page' | 'pageSize'] = Number(single);
    } else if (key === 'minPriceCents' || key === 'maxPriceCents') {
      normalized[key as 'minPriceCents' | 'maxPriceCents'] = Number(single);
    } else if (key === 'tags' || key === 'categories') {
      const all = Array.isArray(value) ? value : [value];
      normalized[key as 'tags' | 'categories'] = all
        .flatMap((v) => String(v).split(','))
        .map((v) => v.trim())
        .filter(Boolean);
    } else {
      normalized[key as keyof ListingSearchParams] = single as never;
    }
  }

  return { ...normalized, conditions };
}

export default async function ListingsIndex({ searchParams }: ListingsPageProps) {
  const resolvedParams = await searchParams;
  const initialParams = normalizeSearchParams(resolvedParams);
  return (
    <main>
      <ListingExplorer initialParams={initialParams} />
    </main>
  );
}
