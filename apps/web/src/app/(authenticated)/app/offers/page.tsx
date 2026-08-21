import { OffersBoard } from "./offers-board";

export const metadata = { title: "My Offers — Forumo" };

export default function OffersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Offers</h2>
        <p className="text-sm text-slate-400">
          Manage offers you&apos;ve sent and received
        </p>
      </div>
      <OffersBoard />
    </div>
  );
}
