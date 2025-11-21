import type { ListingSearchParams } from '@forumo/shared';

import { ListingExplorer } from './listing-explorer';

type ListingsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function normalizeSearchParams(params: ListingsPageProps['searchParams']): Partial<ListingSearchParams> {
  const normalized: Partial<ListingSearchParams> = {};
  if (!params) {
    return normalized;
  }
  for (const [key, value] of Object.entries(params)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (!single) continue;
    if (key === 'page' || key === 'pageSize') {
      normalized[key as 'page' | 'pageSize'] = Number(single);
    } else if (key === 'minPriceCents' || key === 'maxPriceCents') {
      normalized[key as 'minPriceCents' | 'maxPriceCents'] = Number(single);
    } else if (key === 'tags') {
      const tags = Array.isArray(value) ? value : [value];
      normalized.tags = tags.flatMap((tag) => String(tag).split(',')).map((tag) => tag.trim()).filter(Boolean);
    } else {
      normalized[key as keyof ListingSearchParams] = single as never;
    }
  }
  return normalized;
}

export default function ListingsIndex({ searchParams }: ListingsPageProps) {
  const initialParams = normalizeSearchParams(searchParams);
  return (
    <main>
      <ListingExplorer initialParams={initialParams} />
    </main>
  );
}
