import { ThreadPageClient } from './client-page';

export default async function ThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  return <ThreadPageClient threadId={threadId} />;
}
