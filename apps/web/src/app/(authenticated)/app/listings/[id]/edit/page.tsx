"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useListing } from "../../../../../../lib/react-query/hooks";
import { ListingForm } from "../../../../../../components/listings/ListingForm";

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const { data: listing, isLoading } = useListing(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-96 rounded-[14px]" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="mx-auto max-w-2xl text-center py-16">
        <p className="muted">Listing not found.</p>
        <Link
          href={"/app/listings" as any}
          className="mt-4 inline-block text-sm text-[color:var(--accent)] hover:underline"
        >
          ← Back to My Listings
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={"/app/listings" as any}
          className="text-xs muted hover:text-[color:var(--accent)]"
        >
          ← My Listings
        </Link>
        <h2 className="mt-2 h2">Edit listing</h2>
        <p className="text-sm muted truncate">{listing.title}</p>
      </div>
      <div className="card card-pad">
        <ListingForm mode="edit" listing={listing} />
      </div>
    </div>
  );
}
