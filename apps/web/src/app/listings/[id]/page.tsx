import type { Metadata } from "next";
import { createApiClient } from "../../../lib/api-client";
import { ListingDetail } from "./listing-detail";
import { ErrorBoundary } from "../../../components/ErrorBoundary";

type ListingRouteParams = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: ListingRouteParams;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const api = createApiClient();
    const listing = await api.listings.get(id);
    const price = new Intl.NumberFormat("en", {
      style: "currency",
      currency: listing.currency ?? "USD",
    }).format((listing.priceCents ?? 0) / 100);
    const title = `${listing.title} — ${price} | Forumo`;
    const description = listing.description
      ? listing.description.slice(0, 160)
      : `Buy ${listing.title} on Forumo — Africa's escrow-protected marketplace.`;
    const image = listing.images?.[0]?.url;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        ...(image
          ? {
              images: [
                { url: image, width: 800, height: 800, alt: listing.title },
              ],
            }
          : {}),
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title,
        description,
        ...(image ? { images: [image] } : {}),
      },
    };
  } catch {
    return { title: "Listing — Forumo" };
  }
}

export default async function ListingDetailPage({
  params,
}: {
  params: ListingRouteParams;
}) {
  const resolvedParams = await params;
  return (
    <main className="space-y-6">
      <ErrorBoundary>
        <ListingDetail id={resolvedParams.id} />
      </ErrorBoundary>
    </main>
  );
}
