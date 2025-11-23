import { SafeListing, SafeMessageThread } from '@forumo/shared';

export const brandColors = {
  primary: '#0ea5e9',
  background: '#f8fafc',
  card: '#ffffff',
  text: '#0f172a',
  border: '#e2e8f0',
  muted: '#475569',
  success: '#16a34a',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
};

export const mobileNavigationTheme = {
  dark: false,
  colors: {
    primary: brandColors.primary,
    background: brandColors.background,
    card: brandColors.card,
    text: brandColors.text,
    border: brandColors.border,
    notification: '#f97316',
  },
};

export const onboardingHighlights = [
  'Verify your identity to unlock faster payouts and avoid order holds.',
  'Explore curated listings with pricing transparency and seller context.',
  'Chat with buyers and sellers to keep deals moving and disputes minimal.',
];

export const demoListings: SafeListing[] = [
  {
    id: '11111111-2222-3333-4444-555555555555',
    sellerId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    title: 'Vintage Camera Kit',
    description: 'A carefully maintained 35mm film camera with two lenses and carrying case.',
    priceCents: 18999,
    currency: 'USD',
    status: 'PUBLISHED',
    moderationStatus: 'APPROVED',
    location: 'Portland, OR',
    metadata: { condition: 'Excellent' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    variants: [],
    images: [],
  },
  {
    id: '66666666-7777-8888-9999-000000000000',
    sellerId: 'ffffffff-1111-2222-3333-444444444444',
    title: 'Handmade Ceramic Set',
    description: 'Small batch mugs and plates fired locally with food-safe glaze.',
    priceCents: 7200,
    currency: 'USD',
    status: 'PUBLISHED',
    moderationStatus: 'APPROVED',
    location: 'Austin, TX',
    metadata: { pieces: 6 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    variants: [],
    images: [],
  },
];

export const demoThreads: SafeMessageThread[] = [
  {
    id: '123e4567-e89b-12d3-a456-426614174000',
    listingId: demoListings[0].id,
    subject: 'Availability question',
    metadata: null,
    createdAt: new Date().toISOString(),
    participants: [
      {
        id: '8d260194-a10f-4f3a-93e2-8858b4552c32',
        threadId: '123e4567-e89b-12d3-a456-426614174000',
        userId: 'guest-user-id',
        role: 'BUYER',
      },
      {
        id: '76b8e5bf-1ed3-4b58-9db2-48e8bcb792f2',
        threadId: '123e4567-e89b-12d3-a456-426614174000',
        userId: demoListings[0].sellerId,
        role: 'SELLER',
      },
    ],
    messages: [
      {
        id: 'a1f09c73-5e0f-4214-b8b3-2b9416e3de88',
        threadId: '123e4567-e89b-12d3-a456-426614174000',
        authorId: 'guest-user-id',
        body: 'Hi there! Is the camera still available this month?',
        status: 'SENT',
        moderationStatus: 'APPROVED',
        moderationNotes: null,
        metadata: null,
        createdAt: new Date().toISOString(),
        attachments: [],
        receipts: [],
      },
      {
        id: 'd7b5b7f8-1eb9-4c0d-bf4c-0dfe9d5749f4',
        threadId: '123e4567-e89b-12d3-a456-426614174000',
        authorId: demoListings[0].sellerId,
        body: 'Yes! I can ship within two business days.',
        status: 'DELIVERED',
        moderationStatus: 'APPROVED',
        moderationNotes: null,
        metadata: null,
        createdAt: new Date().toISOString(),
        attachments: [],
        receipts: [],
      },
    ],
  },
];
