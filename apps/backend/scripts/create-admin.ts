/**
 * Bootstrap script: create the first ADMIN user in a fresh production database.
 *
 * Usage:
 *   DATABASE_URL=<url> ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=<pass> \
 *     npx ts-node --project tsconfig.json scripts/create-admin.ts
 *
 * Or with pnpm from the repo root:
 *   pnpm --filter backend exec ts-node --project tsconfig.json scripts/create-admin.ts
 */
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error(
      "Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.",
    );
    console.error(
      "Usage: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=securepass npx ts-node scripts/create-admin.ts",
    );
    process.exit(1);
  }

  if (password.length < 12) {
    console.error("Error: ADMIN_PASSWORD must be at least 12 characters.");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role === "ADMIN") {
      console.log(`Admin user already exists: ${email} (id: ${existing.id})`);
    } else {
      // Promote existing user to ADMIN
      await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
      console.log(
        `Promoted existing user to ADMIN: ${email} (id: ${existing.id})`,
      );
    }
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.create({
    data: {
      id: randomUUID(),
      email,
      name: "Admin",
      passwordHash,
      role: "ADMIN",
      kycStatus: "APPROVED",
    },
  });

  console.log(`\n✓ Admin user created successfully`);
  console.log(`  ID:    ${admin.id}`);
  console.log(`  Email: ${admin.email}`);
  console.log(`  Role:  ${admin.role}`);
  console.log("\nStore the password securely — it cannot be recovered.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Failed:", e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
