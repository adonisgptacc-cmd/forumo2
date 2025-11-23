'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { createApiClient } from '../../../../lib/api-client';
import { authOptions } from '../../../../lib/auth';

const allowedRoles = ['ADMIN', 'MODERATOR'];

async function getAdminApi() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login?callbackUrl=/admin');
  }
  if (!allowedRoles.includes((session.user as any).role)) {
    redirect('/unauthorized');
  }
  return createApiClient(session.accessToken);
}

export async function reviewListing(formData: FormData) {
  const listingId = String(formData.get('listingId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const notes = formData.get('notes');

  if (!listingId || !decision) {
    throw new Error('Missing listing id or decision');
  }

  const api = await getAdminApi();
  await api.admin.reviewListing(listingId, {
    moderationStatus: decision as 'APPROVED' | 'REJECTED' | 'FLAGGED' | 'PENDING',
    moderationNotes: typeof notes === 'string' && notes.length ? notes : null,
  });

  revalidatePath('/admin/moderations');
}
