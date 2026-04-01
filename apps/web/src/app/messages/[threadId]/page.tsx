import { redirect } from 'next/navigation';

export default async function ThreadRedirect({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  redirect(`/app/messages/${threadId}`);
}
