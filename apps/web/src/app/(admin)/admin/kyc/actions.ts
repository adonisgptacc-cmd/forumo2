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

export async function reviewKycSubmission(formData: FormData) {
  const submissionId = String(formData.get('submissionId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const reason = formData.get('reason');

  if (!submissionId || !decision) {
    throw new Error('Missing submission id or decision');
  }

  const api = await getAdminApi();

  if (decision === 'APPROVED') {
    await api.admin.reviewKycSubmission(submissionId, { status: 'APPROVED' });
  } else {
    await api.admin.reviewKycSubmission(submissionId, {
      status: 'REJECTED',
      rejectionReason: typeof reason === 'string' && reason.length ? reason : null,
    });
  }

  revalidatePath('/admin/kyc');
}
