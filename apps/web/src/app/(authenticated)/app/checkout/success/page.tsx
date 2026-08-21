import { Suspense } from "react";
import { SuccessContent } from "./success-content";

export default function CheckoutSuccessPage() {
  return (
    <div className="px-4 py-6">
      <Suspense
        fallback={
          <div className="card-forumo text-center py-16 space-y-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mx-auto" />
            <p className="text-slate-500">Loading…</p>
          </div>
        }
      >
        <SuccessContent />
      </Suspense>
    </div>
  );
}
