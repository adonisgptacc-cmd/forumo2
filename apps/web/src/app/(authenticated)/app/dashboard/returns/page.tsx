import { SellerReturnsView } from "./seller-returns-view";

export const metadata = { title: "Return Requests — Forumo" };

export default function SellerReturnsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Return Requests</h2>
        <p className="text-sm text-slate-400">
          Manage incoming return requests from buyers
        </p>
      </div>
      <SellerReturnsView />
    </div>
  );
}
