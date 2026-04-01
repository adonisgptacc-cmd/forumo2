import type { Metadata } from 'next';
import { createApiClient } from '../../../lib/api-client';
import { StorefrontView } from './shop-view';

type ShopRouteParams = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: ShopRouteParams }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const api = createApiClient();
    const storefront = await api.storefronts.get(slug);
    const title = `${storefront.name} — Forumo Shop`;
    const description = storefront.description
      ? storefront.description.slice(0, 160)
      : `Shop ${storefront.name} on Forumo — Africa's escrow-protected marketplace.`;
    const image = storefront.bannerUrl ?? storefront.logoUrl;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        ...(image ? { images: [{ url: image, width: 1200, height: 630, alt: storefront.name }] } : {}),
      },
      twitter: {
        card: image ? 'summary_large_image' : 'summary',
        title,
        description,
        ...(image ? { images: [image] } : {}),
      },
    };
  } catch {
    return { title: 'Shop — Forumo' };
  }
}

export default function StorefrontPage() {
  return <StorefrontView />;
}
