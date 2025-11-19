'use client';

import { useSession } from 'next-auth/react';
import { useMemo } from 'react';

import { createApiClient } from './api-client';

export function useApiClient() {
  const { data } = useSession();
  return useMemo(() => createApiClient(data?.accessToken), [data?.accessToken]);
}
