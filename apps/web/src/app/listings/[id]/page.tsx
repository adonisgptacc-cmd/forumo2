import { ListingDetail } from './listing-detail';

type ListingRouteParams = Promise<{ id: string }> | { id: string };

export default async function ListingDetailPage({ params }: { params: ListingRouteParams }) {
  const resolvedParams = await params;
  return (
    <main className="space-y-6">
      <ListingDetail id={resolvedParams.id} />
    </main>
  );
}
