import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD ?? 'Admin@forumo2026!', 10);
  const sellerPassword = await bcrypt.hash('seller123', 10);
  const buyerPassword = await bcrypt.hash('buyer123', 10);

  // ── Admin user ──────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@forumo.africa' },
    update: {},
    create: {
      id: randomUUID(),
      name: 'Forumo Admin',
      email: 'admin@forumo.africa',
      passwordHash: adminPassword,
      kycStatus: 'APPROVED',
      role: 'ADMIN',
    },
  });
  console.log(`✓ Admin:  ${admin.email}  (role: ${admin.role})`);

  // ── Dev users ────────────────────────────────────────────────────
  const seller = await prisma.user.upsert({
    where: { email: 'seller@example.com' },
    update: {},
    create: {
      id: randomUUID(),
      name: 'John Seller',
      email: 'seller@example.com',
      passwordHash: sellerPassword,
      kycStatus: 'APPROVED',
      role: 'SELLER',
    },
  });
  console.log(`✓ Seller: ${seller.email}`);

  const buyer = await prisma.user.upsert({
    where: { email: 'buyer@example.com' },
    update: {},
    create: {
      id: randomUUID(),
      name: 'Jane Buyer',
      email: 'buyer@example.com',
      passwordHash: buyerPassword,
      kycStatus: 'APPROVED',
      role: 'BUYER',
    },
  });
  console.log(`✓ Buyer:  ${buyer.email}`);

  // ── Categories ───────────────────────────────────────────────────
  const categories = ['Electronics', 'Fashion', 'Home & Kitchen', 'Sports', 'Books', 'Vehicles', 'Agriculture'];
  for (const name of categories) {
    await prisma.listingCategory.upsert({
      where: { name },
      update: {},
      create: { name, description: `${name} listings` },
    });
  }
  console.log(`✓ Categories: ${categories.join(', ')}`);

  // ── Sample listings ──────────────────────────────────────────────
  const sampleListings = [
    { title: 'Vintage Leather Jacket', description: 'Classic vintage leather jacket in excellent condition.', priceCents: 15000 },
    { title: 'iPhone 14 Pro Max', description: 'Apple iPhone 14 Pro Max, 256GB, Space Black. Like new condition.', priceCents: 120000 },
    { title: 'Wooden Dining Table', description: 'Beautiful handcrafted wooden dining table, seats 6 people.', priceCents: 45000 },
    { title: 'Mountain Bike - Trek', description: 'Trek mountain bike, 2022 model, 21-speed, great for trails.', priceCents: 50000 },
    { title: 'Vintage Analog Camera', description: 'Canon AE-1 35mm camera with original lens, fully functional.', priceCents: 25000 },
    { title: 'Yoga Mat & Equipment Set', description: 'Complete yoga set with mat, blocks, straps, and carrying bag.', priceCents: 8000 },
  ];

  for (const data of sampleListings) {
    const existing = await prisma.listing.findFirst({ where: { title: data.title, sellerId: seller.id } });
    if (!existing) {
      await prisma.listing.create({
        data: { ...data, id: randomUUID(), sellerId: seller.id, status: 'PUBLISHED', moderationStatus: 'APPROVED' },
      });
    }
    console.log(`✓ Listing: ${data.title}`);
  }

  console.log('\nSeeding complete!');
  console.log('\nDev credentials:');
  console.log('  admin@forumo.africa  /  Admin@forumo2026!');
  console.log('  seller@example.com   /  seller123');
  console.log('  buyer@example.com    /  buyer123');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
