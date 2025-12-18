import { ThreadRoom } from './thread-room';

export default async function ThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  return (
    <div className="space-y-4">
      <ThreadRoom threadId={threadId} />
    </div>
  );
}
