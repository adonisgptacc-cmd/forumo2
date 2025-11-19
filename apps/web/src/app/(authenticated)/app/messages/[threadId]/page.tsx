import { ThreadRoom } from './thread-room';

export default function ThreadPage({ params }: { params: { threadId: string } }) {
  return (
    <div className="space-y-4">
      <ThreadRoom threadId={params.threadId} />
    </div>
  );
}
