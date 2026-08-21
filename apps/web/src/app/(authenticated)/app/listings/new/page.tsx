import Link from "next/link";
import { SellerGate } from "../../../../../components/seller-gate";
import { ListingForm } from "../../../../../components/listings/ListingForm";

export const metadata = { title: "New Listing — Forumo" };

export default function NewListingPage() {
  return (
    <SellerGate>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link
            href={"/app/listings" as any}
            className="text-xs muted hover:text-[color:var(--accent)]"
          >
            ← My Listings
          </Link>
          <h2 className="mt-2 h2">New listing</h2>
          <p className="text-sm muted">
            Fill in the details below to list your item.
          </p>
        </div>
        <div className="card card-pad">
          <ListingForm mode="create" />
        </div>
      </div>
    </SellerGate>
  );
}
