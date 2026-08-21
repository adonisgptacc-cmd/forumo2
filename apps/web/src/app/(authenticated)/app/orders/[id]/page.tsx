import { Suspense } from "react";
import { OrderDetail } from "./order-detail";
import { ErrorBoundary } from "../../../../../components/ErrorBoundary";

export const metadata = { title: "Order Detail — Forumo" };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-24 rounded-[14px]" />
            ))}
          </div>
        }
      >
        <OrderDetail id={id} />
      </Suspense>
    </ErrorBoundary>
  );
}
