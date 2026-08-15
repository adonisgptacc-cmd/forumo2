export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(cents / 100);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const ORDER_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#fef9c3', text: '#854d0e' },
  CONFIRMED: { bg: '#dbeafe', text: '#1d4ed8' },
  PAID: { bg: '#dcfce7', text: '#15803d' },
  FULFILLED: { bg: '#e0f2fe', text: '#0369a1' },
  DELIVERED: { bg: '#d1fae5', text: '#065f46' },
  COMPLETED: { bg: '#f0fdf4', text: '#16a34a' },
  CANCELLED: { bg: '#fee2e2', text: '#dc2626' },
  REFUNDED: { bg: '#f3e8ff', text: '#7c3aed' },
  DISPUTED: { bg: '#fff7ed', text: '#c2410c' },
};

export const OFFER_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#fef9c3', text: '#854d0e' },
  ACCEPTED: { bg: '#dcfce7', text: '#15803d' },
  DECLINED: { bg: '#fee2e2', text: '#dc2626' },
  EXPIRED: { bg: '#f3f4f6', text: '#6b7280' },
  CANCELLED: { bg: '#f3f4f6', text: '#6b7280' },
  COUNTERED: { bg: '#dbeafe', text: '#1e40af' },
};

export const LISTING_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#9ca3af',
  PUBLISHED: '#16a34a',
  PAUSED: '#eab308',
  SUSPENDED: '#ef4444',
};

export const KYC_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: '#fef3c7', text: '#92400e', label: 'Pending' },
  APPROVED: { bg: '#d1fae5', text: '#065f46', label: 'Approved' },
  REJECTED: { bg: '#fee2e2', text: '#991b1b', label: 'Rejected' },
};
