'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateListingDto,
  CreateOrderDto,
  CreateReviewDto,
  ListingSearchParams,
  ListingSearchResponse,
  SafeListing,
  SafeMessageThread,
  SafeOrder,
  SendMessageDto,
  UpdateListingDto,
  ListingReviewResponse,
  PaginatedResponse,
} from '@forumo/shared';
import { useSession } from 'next-auth/react';
import { useMemo } from 'react';

import { createApiClient } from '../api-client';
import { MessagingLayer } from '../messaging-layer';
import { queryKeys } from './query-keys';

function useApi(accessToken?: string | null) {
  return useMemo(() => createApiClient(accessToken), [accessToken]);
}

function useMessagingLayer(accessToken?: string | null) {
  return useMemo(() => new MessagingLayer(accessToken), [accessToken]);
}

export function useCurrentUser() {
  const { data, status } = useSession();
  return { user: data?.user, accessToken: data?.accessToken, status };
}

export function useListings(params: Partial<ListingSearchParams>) {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<ListingSearchResponse>({
    queryKey: queryKeys.listings(params),
    queryFn: () => api.listings.search(params),
  });
}

export function useListing(id: string | null) {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<SafeListing | null>({
    queryKey: id ? queryKeys.listing(id) : ['listing', null],
    queryFn: () => (id ? api.listings.get(id) : Promise.resolve(null)),
    enabled: Boolean(id),
  });
}

export function useListingReviews(listingId: string | null) {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<ListingReviewResponse | null>({
    queryKey: listingId ? queryKeys.listingReviews(listingId) : ['listing', null, 'reviews'],
    queryFn: () => (listingId ? api.reviews.forListing(listingId) : Promise.resolve(null)),
    enabled: Boolean(listingId),
  });
}

export function useReviewMutations() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();

  const createReview = useMutation({
    mutationFn: (payload: CreateReviewDto) => api.reviews.create(payload),
    onSuccess: (review) => {
      client.invalidateQueries({ queryKey: queryKeys.listingReviews(review.listingId) });
      client.invalidateQueries({ queryKey: queryKeys.sellerReviewRollup(review.recipientId) });
    },
  });

  return { createReview };
}

export function useListingMutations() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (payload: CreateListingDto) => api.listings.create(payload),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['listings'], exact: false });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateListingDto }) => api.listings.update(id, payload),
    onSuccess: (_, { id }) => {
      client.invalidateQueries({ queryKey: queryKeys.listing(id) });
      client.invalidateQueries({ queryKey: ['listings'], exact: false });
    },
  });

  return { createMutation, updateMutation };
}

export function useOrders() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<SafeOrder[]>({
    queryKey: queryKeys.orders,
    queryFn: () => api.orders.list(),
  });
}

export function useCreateOrder() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrderDto) => api.orders.create(payload),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.orders }),
  });
}

export function useMessageThreads(userId?: string, page = 1) {
  const { accessToken, user } = useCurrentUser();
  const messaging = useMessagingLayer(accessToken);
  const targetUserId = userId ?? user?.id;
  return useQuery<PaginatedResponse<SafeMessageThread>>({
    queryKey: queryKeys.threads(targetUserId, page),
    queryFn: () => messaging.listThreads({ userId: targetUserId ?? undefined, page }),
    enabled: Boolean(accessToken),
  });
}

export function useThread(id: string | null) {
  const { accessToken } = useCurrentUser();
  const messaging = useMessagingLayer(accessToken);
  return useQuery<SafeMessageThread | null>({
    queryKey: id ? queryKeys.thread(id) : ['thread', null],
    queryFn: () => (id ? messaging.getThread(id) : Promise.resolve(null)),
    enabled: Boolean(id && accessToken),
    refetchInterval: 30000,
  });
}

export function useSendMessage(threadId: string) {
  const { accessToken, user } = useCurrentUser();
  const messaging = useMessagingLayer(accessToken);
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, attachments }: { payload: SendMessageDto; attachments?: Blob[] }) =>
      messaging.sendMessage(threadId, payload, attachments),
    onSuccess: (_, { payload }) => {
      client.invalidateQueries({ queryKey: queryKeys.thread(threadId) });
      client.invalidateQueries({ queryKey: ['threads'], exact: false });
    },
  });
}
