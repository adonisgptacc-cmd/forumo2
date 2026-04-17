import type { Metadata } from 'next';
import { createApiClient } from '../../../lib/api-client';
import { AuctionDetailClient } from './auction-detail-client';

type AuctionRouteParams = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: AuctionRouteParams }): Promise<Metadata> {
  const { id } = await params;
  try {
    const api = createApiClient();
    const auction = await api.auctions.get(id) as any;
    const title = auction?.listing?.title ?? 'Live Auction';
    const startingPrice = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: 'USD',
    }).format((auction?.startingBidCents ?? 0) / 100);
    const metaTitle = `${title} — Live Auction from ${startingPrice} | Forumo`;
    const description = auction?.listing?.description
      ? auction.listing.description.slice(0, 160)
      : `Bid on ${title} — live auction on Forumo, Africa's escrow-protected marketplace.`;
    const image = auction?.listing?.images?.[0]?.url;

    return {
      title: metaTitle,
      description,
      openGraph: {
        title: metaTitle,
        description,
        type: 'website',
        ...(image ? { images: [{ url: image, width: 800, height: 800, alt: title }] } : {}),
      },
      twitter: {
        card: image ? 'summary_large_image' : 'summary',
        title: metaTitle,
        description,
        ...(image ? { images: [image] } : {}),
      },
    };
  } catch {
    return { title: 'Live Auction — Forumo' };
  }
}

export default async function AuctionDetailPage({ params }: { params: AuctionRouteParams }) {
  const { id } = await params;
  return (
    <main>
      <AuctionDetailClient auctionId={id} />
    </main>
  );
}
