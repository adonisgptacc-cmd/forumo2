import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd());
const SCHEMA_PATH = join(ROOT, "apps/backend/prisma/schema.prisma");
const HASH_FILE = join(ROOT, ".prisma-schema-hash");
const SCHEMA_HASH = createHash("sha256")
  .update(readFileSync(SCHEMA_PATH, "utf8"))
  .digest("hex");

console.log(`Schema hash: ${SCHEMA_HASH.slice(0, 12)}`);

if (!existsSync(HASH_FILE)) {
  console.error(
    ".prisma-schema-hash not found. Run: pnpm --filter backend prisma:generate to create it.",
  );
  process.exit(1);
}

const storedHash = readFileSync(HASH_FILE, "utf8").trim();
if (storedHash !== SCHEMA_HASH) {
  console.error(
    "Prisma schema drift detected — the schema has changed but the generated client may be out of sync.",
  );
  console.error(
    "Run: pnpm --filter backend prisma:generate && commit the updated .prisma-schema-hash",
  );
  process.exit(1);
}

// Hash match confirms client is in sync; lifecycle hooks ensure generate runs before typecheck/build/test
console.log("Prisma client in sync. No drift detected.");
