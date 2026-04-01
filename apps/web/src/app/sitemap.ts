import type { MetadataRoute } from 'next';
import { createApiClient } from '../lib/api-client';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forumo.africa';
  const now = new Date();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${base}/listings`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/auctions`, lastModified: now, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ];

  // Dynamic listing pages
  let listingPages: MetadataRoute.Sitemap = [];
  try {
    const api = createApiClient();
    const result = await api.listings.search({ status: 'PUBLISHED', pageSize: 200 });
    listingPages = result.data.map((listing) => ({
      url: `${base}/listings/${listing.id}`,
      lastModified: new Date(listing.updatedAt ?? listing.createdAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch {
    // API unavailable during build — skip dynamic pages
  }

  // Shop pages are user-generated; we skip them in the static sitemap
  // and rely on search engines to discover them via listing page links.
  const shopPages: MetadataRoute.Sitemap = [];

  return [...staticPages, ...listingPages, ...shopPages];
}
