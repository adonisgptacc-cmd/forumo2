import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SCHEMA_PATH = join(ROOT, "apps/backend/prisma/schema.prisma");
const HASH_FILE = join(ROOT, ".prisma-schema-hash");

execSync("prisma generate --schema prisma/schema.prisma", { cwd: join(ROOT, "apps/backend"), stdio: "inherit" });

const schemaContent = readFileSync(SCHEMA_PATH, "utf8");
const hash = createHash("sha256").update(schemaContent).digest("hex");
writeFileSync(HASH_FILE, hash + "\n");
console.log(`Schema hash updated: ${hash.substring(0, 12)}`);
