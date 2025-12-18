import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create sample users
  const sellerPassword = await bcrypt.hash('seller123', 10);
  const buyerPassword = await bcrypt.hash('buyer123', 10);

  const seller = await prisma.user.upsert({
    where: { email: 'seller@example.com' },
    update: {},
    create: {
      id: `user-seller-${Date.now()}`,
      name: 'John Seller',
      email: 'seller@example.com',
      passwordHash: sellerPassword,
      kycStatus: 'APPROVED',
      role: 'SELLER',
    },
  });

  const buyer = await prisma.user.upsert({
    where: { email: 'buyer@example.com' },
    update: {},
    create: {
      id: `user-buyer-${Date.now()}`,
      name: 'Jane Buyer',
      email: 'buyer@example.com',
      passwordHash: buyerPassword,
      kycStatus: 'APPROVED',
      role: 'BUYER',
    },
  });

  console.log(`Created seller: ${seller.email}`);
  console.log(`Created buyer: ${buyer.email}`);

  // Create sample listings
  const sampleListings = [
    {
      title: 'Vintage Leather Jacket',
      description: 'Classic vintage leather jacket in excellent condition. Perfect for any style.',
      sellerId: seller.id,
      status: 'PUBLISHED',
      priceCents: 15000,
    },
    {
      title: 'iPhone 14 Pro Max',
      description: 'Apple iPhone 14 Pro Max, 256GB, Space Black. Like new condition.',
      sellerId: seller.id,
      status: 'PUBLISHED',
      priceCents: 120000,
    },
    {
      title: 'Wooden Dining Table',
      description: 'Beautiful handcrafted wooden dining table, seats 6 people.',
      sellerId: seller.id,
      status: 'PUBLISHED',
      priceCents: 45000,
    },
    {
      title: 'Mountain Bike - Trek',
      description: 'Trek mountain bike, 2022 model, 21-speed, great for trails.',
      sellerId: seller.id,
      status: 'PUBLISHED',
      priceCents: 50000,
    },
    {
      title: 'Vintage Analog Camera',
      description: 'Canon AE-1 35mm camera with original lens, fully functional.',
      sellerId: seller.id,
      status: 'PUBLISHED',
      priceCents: 25000,
    },
    {
      title: 'Yoga Mat & Equipment Set',
      description: 'Complete yoga set with mat, blocks, straps, and carrying bag.',
      sellerId: seller.id,
      status: 'PUBLISHED',
      priceCents: 8000,
    },
  ];

  for (const listingData of sampleListings) {
    const listing = await prisma.listing.upsert({
      where: { id: `listing-${listingData.title.replace(/\s+/g, '-').toLowerCase()}` },
      update: {},
      create: {
        ...listingData,
        id: `listing-${listingData.title.replace(/\s+/g, '-').toLowerCase()}`,
      },
    });
    console.log(`Created listing: ${listing.title}`);
  }

  console.log('Seeding completed!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
