"use client";

import { ErrorState } from "../../components/error-state";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-6">
      <ErrorState
        message={`Something went wrong: ${error.message}`}
        onRetry={reset}
      />
    </div>
  );
}
