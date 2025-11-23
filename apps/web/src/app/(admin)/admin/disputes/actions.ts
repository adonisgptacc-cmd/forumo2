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

export async function resolveDispute(formData: FormData) {
  const disputeId = String(formData.get('disputeId') ?? '');
  const status = String(formData.get('status') ?? '');
  const resolution = formData.get('resolution');

  if (!disputeId || !status) {
    throw new Error('Missing dispute id or status');
  }

  const api = await getAdminApi();
  await api.admin.resolveDispute(disputeId, {
    status: status as 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'ESCALATED',
    resolution: typeof resolution === 'string' && resolution.length ? resolution : null,
  });

  revalidatePath('/admin/disputes');
}
