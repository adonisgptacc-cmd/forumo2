import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

const schema = readFileSync("apps/backend/prisma/schema.prisma", "utf8");
const hash = createHash("sha256").update(schema).digest("hex").slice(0, 12);
console.log(`Schema hash: ${hash}`);

execSync("pnpm --filter backend prisma:generate", { stdio: "inherit" });
const status = execSync("git status --porcelain -- apps/backend/node_modules/.prisma 2>&1 || true", {
  encoding: "utf8",
});
if (status.trim()) {
  console.error("Prisma client drift detected — run pnpm --filter backend prisma:generate and commit");
  process.exit(1);
}
console.log("Prisma client in sync");
