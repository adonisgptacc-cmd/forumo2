import { ThreadRoom } from './thread-room';
import { ErrorBoundary } from '../../../../../components/ErrorBoundary';

export default async function ThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  return (
    <div className="space-y-4">
      <ErrorBoundary>
        <ThreadRoom threadId={threadId} />
      </ErrorBoundary>
    </div>
  );
}
