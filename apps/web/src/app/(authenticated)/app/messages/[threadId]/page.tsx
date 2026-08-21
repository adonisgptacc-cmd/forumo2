import Link from "next/link";

import { ThreadRoom } from "./thread-room";
import { ErrorBoundary } from "../../../../../components/ErrorBoundary";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  return (
    <div className="space-y-4">
      <div>
        <Link
          href={"/app/messages" as any}
          className="text-sm text-amber-400 hover:text-amber-300"
        >
          ← Back to inbox
        </Link>
      </div>
      <ErrorBoundary>
        <ThreadRoom threadId={threadId} />
      </ErrorBoundary>
    </div>
  );
}
